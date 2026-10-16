import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Room } from '../models/Room';
import { Bed } from '../models/Bed';
import { Patient } from '../models/Patient';
import { createRoomSchema, createBedSchema, updateBedSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';

// ==================== ROOMS ====================

export const getRooms = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rooms = await Room.find().sort({ building: 1, floor: 1, roomNumber: 1 });
    res.status(200).json({ success: true, data: { rooms } });
  } catch (err) {
    next(err);
  }
};

export const createRoom = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createRoomSchema.parse(req.body);
    const room = await Room.create(validated);

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'CREATE',
        'Room',
        room._id.toString(),
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
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'UPDATE',
        'Room',
        room._id.toString(),
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
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }

    // Delete associated beds
    await Bed.deleteMany({ room: room._id });

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DELETE',
        'Room',
        room._id.toString(),
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
    const status = req.query.status as string;
    const roomId = req.query.roomId as string;
    const ward = req.query.ward as string;

    const query: any = {};
    if (status) query.status = status;
    if (roomId) query.room = roomId;

    const beds = await Bed.find(query)
      .populate('room')
      .populate('currentPatient', 'name patientId gender phone')
      .sort({ bedNumber: 1 });

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
    const bed = await Bed.findById(req.params.id)
      .populate('room')
      .populate('currentPatient', 'name patientId bloodGroup gender phone address');

    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    res.status(200).json({ success: true, data: { bed } });
  } catch (err) {
    next(err);
  }
};

export const createBed = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createBedSchema.parse(req.body);
    const bed = await Bed.create({
      ...validated,
      status: 'available'
    });

    const populated = await Bed.findById(bed._id).populate('room');

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'CREATE',
        'Bed',
        bed._id.toString(),
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
    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    if (validated.status) bed.status = validated.status;
    if (validated.currentPatient !== undefined) {
      bed.currentPatient = validated.currentPatient ? (validated.currentPatient as any) : undefined;
      bed.assignedDate = validated.currentPatient ? new Date() : undefined;
    }

    await bed.save();
    const populated = await Bed.findById(bed._id).populate('room').populate('currentPatient', 'name patientId');

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'UPDATE',
        'Bed',
        bed._id.toString(),
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
    const { patientId } = req.body;
    if (!patientId) {
      res.status(400).json({ success: false, message: 'Patient ID is required' });
      return;
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    if (bed.status === 'occupied') {
      res.status(400).json({ success: false, message: 'Bed is already occupied' });
      return;
    }

    bed.status = 'occupied';
    bed.currentPatient = patient._id;
    bed.assignedDate = new Date();
    await bed.save();

    const populated = await Bed.findById(bed._id).populate('room').populate('currentPatient', 'name patientId');

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'ASSIGN_BED',
        'Bed',
        bed._id.toString(),
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
    const bed = await Bed.findById(req.params.id);
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    bed.status = 'available';
    bed.currentPatient = undefined;
    bed.assignedDate = undefined;
    await bed.save();

    const populated = await Bed.findById(bed._id).populate('room');

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DISCHARGE_BED',
        'Bed',
        bed._id.toString(),
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
    const bed = await Bed.findByIdAndDelete(req.params.id);
    if (!bed) {
      res.status(404).json({ success: false, message: 'Bed not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DELETE',
        'Bed',
        bed._id.toString(),
        `Deleted bed ${bed.bedNumber}`
      );
    }

    res.status(200).json({ success: true, message: 'Bed deleted successfully' });
  } catch (err) {
    next(err);
  }
};
