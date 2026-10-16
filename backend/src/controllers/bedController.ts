import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { bedRepo, patientRepo, roomRepo } from '../repositories';
import { nowIso, queryAll, transactWrite, tx, TxOp } from '../db/dynamo';
import { changeUnique, claimUnique, releaseUnique, typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { KEY_ATTRIBUTES } from '../db/table';
import { IBed, IRoom } from '../types/entities';
import { createRoomSchema, createBedSchema, updateBedSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { AppError } from '../utils/errors';
import { retryOnConflict } from '../services/facilitiesFinanceService';
import { queryString } from '../utils/pagination';

// Rooms and beds are small catalogs (a hospital has tens to a few hundred),
// so listing them reads the whole GSI1 type partition with queryAll.
// Room numbers and bed numbers are kept unique with guard items
// (UNIQUE#ROOM#<number>, UNIQUE#BED#<number>) written in the same transaction.

const ROOM_TAKEN = 'Room number already exists';
const BED_TAKEN = 'Bed number already exists';

const publicBed = (bed: IBed): any => bedRepo.toPublic(bed);

// ==================== ROOMS ====================

export const getRooms = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // GSI1 sort key is building#floor#roomNumber, i.e. the original sort order.
    const items = await queryAll({ index: 'GSI1', pk: typePartition('ROOM') });
    const rooms = items.map((i) => roomRepo.fromItem(i));
    res.status(200).json({ success: true, data: { rooms } });
  } catch (err) {
    next(err);
  }
};

export const createRoom = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createRoomSchema.parse(req.body);
    const { entity: room, ops } = roomRepo.prepareCreate({ ...validated, roomNumber: validated.roomNumber.trim() });
    await transactWrite([...ops, claimUnique('ROOM', room.roomNumber, room._id, ROOM_TAKEN)]);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'CREATE',
        'Room',
        room._id,
        `Created room ${room.roomNumber} (${room.roomType})`
      );
    }

    res.status(201).json({ success: true, message: 'Room created successfully', data: { room } });
  } catch (err) {
    next(err);
  }
};

export const updateRoom = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Like the original findByIdAndUpdate(req.params.id, req.body) this accepts any
    // fields, except the ones that identify the record.
    // Internal DynamoDB attributes (PK/SK/GSI keys, version) are dropped too, so a
    // body cannot move the room into another index partition.
    const changes: Record<string, any> = { ...(req.body ?? {}) };
    for (const field of ['_id', 'createdAt', 'updatedAt', 'entityType', 'version', ...KEY_ATTRIBUTES]) delete changes[field];
    if (changes.roomNumber !== undefined) changes.roomNumber = String(changes.roomNumber).trim();

    const room = await roomRepo.update(req.params.id, () => changes as Partial<IRoom>, {
      // Renaming the room moves its uniqueness guard in the same transaction.
      extra: (current, next) => changeUnique('ROOM', current.roomNumber, next.roomNumber, current._id, ROOM_TAKEN),
    });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'UPDATE',
        'Room',
        room._id,
        `Updated room ${room.roomNumber}`
      );
    }

    res.status(200).json({ success: true, message: 'Room updated successfully', data: { room } });
  } catch (err) {
    next(err);
  }
};

export const deleteRoom = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const existing = await roomRepo.get(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    // Beds of this room (GSI2 ROOM#<id>). Each bed needs 2 deletes (bed + its guard).
    const beds = (await queryAll({ index: 'GSI2', pk: `ROOM#${existing._id}` })).map((i) => bedRepo.fromItem(i));
    const bedOps = (b: IBed): TxOp[] => [tx.delete(bedRepo.key(b._id).PK, bedRepo.key(b._id).SK), releaseUnique('BED', b.bedNumber)];

    // A transaction holds at most 100 writes. Normally the room and all its beds
    // go in one transaction; a room with more than ~45 beds has its extra beds
    // deleted in earlier batches first.
    const BEDS_WITH_ROOM = 45;
    const extraBeds = beds.slice(BEDS_WITH_ROOM);
    for (let i = 0; i < extraBeds.length; i += 50) {
      await transactWrite(extraBeds.slice(i, i + 50).flatMap(bedOps));
    }

    const room = await roomRepo.remove(existing._id, {
      extra: (current) => [releaseUnique('ROOM', current.roomNumber), ...beds.slice(0, BEDS_WITH_ROOM).flatMap(bedOps)],
    });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'DELETE',
        'Room',
        room._id,
        `Deleted room ${room.roomNumber}`
      );
    }

    res.status(200).json({ success: true, message: 'Room and associated beds deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ==================== BEDS ====================

export const getBeds = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = queryString(req.query.status);
    const roomId = queryString(req.query.roomId);
    const ward = queryString(req.query.ward);

    // Beds of one room come from GSI2 (ROOM#<id>), all beds from GSI1; both sorted by bedNumber.
    const items = roomId
      ? await queryAll({ index: 'GSI2', pk: `ROOM#${roomId}`, filter: (b) => !status || b.status === status })
      : await queryAll({ index: 'GSI1', pk: typePartition('BED'), filter: (b) => !status || b.status === status });
    const beds = items.map((i) => publicBed(bedRepo.fromItem(i)));

    await Promise.all([
      populate(beds, 'room', roomRepo),
      populate(beds, 'currentPatient', patientRepo, ['name', 'patientId', 'gender', 'phone']),
    ]);

    // Optional filter by ward / roomType
    let filteredBeds = beds;
    if (ward) {
      filteredBeds = beds.filter((b: any) => b.room && b.room.roomType === ward);
    }

    // Calculate statistics
    const totalBeds = beds.length;
    const occupied = beds.filter((b) => b.status === 'occupied').length;
    const available = beds.filter((b) => b.status === 'available').length;
    const reserved = beds.filter((b) => b.status === 'reserved').length;
    const maintenance = beds.filter((b) => b.status === 'maintenance').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        beds: filteredBeds,
        stats: {
          totalBeds,
          occupied,
          available,
          reserved,
          maintenance,
          occupancyRate
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getBedById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const found = await bedRepo.get(req.params.id);
    if (!found) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }
    const bed = publicBed(found);
    await Promise.all([
      populate([bed], 'room', roomRepo),
      populate([bed], 'currentPatient', patientRepo, ['name', 'patientId', 'bloodGroup', 'gender', 'phone', 'address']),
    ]);

    res.status(200).json({ success: true, data: { bed } });
  } catch (err) {
    next(err);
  }
};

export const createBed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createBedSchema.parse(req.body);
    if (!(await roomRepo.get(validated.room))) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    const { entity: bed, ops } = bedRepo.prepareCreate({
      bedNumber: validated.bedNumber.trim(),
      room: validated.room,
      status: 'available'
    });
    await transactWrite([...ops, claimUnique('BED', bed.bedNumber, bed._id, BED_TAKEN)]);

    const populated = publicBed(bed);
    await populate([populated], 'room', roomRepo);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'CREATE',
        'Bed',
        bed._id,
        `Created bed ${bed.bedNumber}`
      );
    }

    res.status(201).json({ success: true, message: 'Bed created successfully', data: { bed: populated } });
  } catch (err) {
    next(err);
  }
};

export const updateBed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = updateBedSchema.parse(req.body);
    const bed = await retryOnConflict(() =>
      bedRepo.update(req.params.id, () => {
        const patch: Partial<IBed> = {};
        if (validated.status) patch.status = validated.status;
        if (validated.currentPatient !== undefined) {
          patch.currentPatient = validated.currentPatient ? validated.currentPatient : undefined;
          patch.assignedDate = validated.currentPatient ? nowIso() : undefined;
        }
        return patch;
      })
    );
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    const populated = publicBed(bed);
    await Promise.all([
      populate([populated], 'room', roomRepo),
      populate([populated], 'currentPatient', patientRepo, ['name', 'patientId']),
    ]);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'UPDATE',
        'Bed',
        bed._id,
        `Updated bed ${bed.bedNumber} status to ${bed.status}`
      );
    }

    res.status(200).json({ success: true, message: 'Bed updated successfully', data: { bed: populated } });
  } catch (err) {
    next(err);
  }
};

export const assignBed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId } = req.body ?? {};
    if (!patientId) {
      res.status(400).json({ success: false, message: 'Patient ID is required' });
      return;
    }

    const patient = await patientRepo.get(String(patientId));
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    // The "already occupied" check runs inside the versioned update, so two
    // concurrent assignments of the same bed can never both succeed.
    const bed = await retryOnConflict(() =>
      bedRepo.update(req.params.id, (current) => {
        if (current.status === 'occupied') throw new AppError('Bed is already occupied', 400);
        return { status: 'occupied', currentPatient: patient._id, assignedDate: nowIso() };
      })
    );
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    const populated = publicBed(bed);
    await Promise.all([
      populate([populated], 'room', roomRepo),
      populate([populated], 'currentPatient', patientRepo, ['name', 'patientId']),
    ]);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'ASSIGN_BED',
        'Bed',
        bed._id,
        `Assigned bed ${bed.bedNumber} to patient ${patient.name}`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Bed assigned successfully',
      data: { bed: populated }
    });
  } catch (err) {
    next(err);
  }
};

export const dischargeBed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bed = await retryOnConflict(() =>
      bedRepo.update(req.params.id, () => ({ status: 'available', currentPatient: undefined, assignedDate: undefined }))
    );
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    const populated = publicBed(bed);
    await populate([populated], 'room', roomRepo);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'DISCHARGE_BED',
        'Bed',
        bed._id,
        `Discharged patient from bed ${bed.bedNumber}`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Bed discharged and marked available',
      data: { bed: populated }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteBed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bed = await bedRepo.remove(req.params.id, {
      extra: (current) => [releaseUnique('BED', current.bedNumber)],
    });
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'DELETE',
        'Bed',
        bed._id,
        `Deleted bed ${bed.bedNumber}`
      );
    }

    res.status(200).json({ success: true, message: 'Bed deleted successfully' });
  } catch (err) {
    next(err);
  }
};
