import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { departmentRepo, doctorRepo } from '../repositories';
import { createUserAccount, EMAIL_TAKEN, findUserByEmail } from '../repositories/userAccounts';
import { Item, queryPage, QueryOptions } from '../db/dynamo';
import { typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { IDoctor } from '../types/entities';
import { createDoctorSchema, updateDoctorSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { isDescending, paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newDoctorId } from '../utils/ids';
import { ConflictError } from '../utils/errors';
import { definedFields, isTakenByOther, syncUserNamePhone } from '../services/identityService';

const EMAIL_REGISTERED = 'Email is already registered';

export const getDoctors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = queryString(req.query.search);
    const department = queryString(req.query.department);
    const specialization = queryString(req.query.specialization)?.toLowerCase();
    const status = queryString(req.query.status);
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const descending = isDescending(req.query.sort, true);

    // Specialization keeps the original "contains, case-insensitive" match.
    const matches = (d: Item) =>
      (!department || d.department === department) &&
      (!specialization || String(d.specialization ?? '').toLowerCase().includes(specialization)) &&
      (!status || d.status === status);

    let doctors: any[];
    let nextCursor: string | undefined;
    if (search) {
      // Word-prefix search on name, specialization words and doctorId (single page, no cursor).
      // With extra filters we fetch more matches first so the page is still filled.
      const found = await doctorRepo.search(search, department || specialization || status ? 100 : limit);
      doctors = found
        .filter(matches)
        .slice(0, limit)
        .sort((a, b) => (descending ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
    } else {
      // Doctors of one department live in GSI2 (DEPT#<id>); otherwise list all on GSI1.
      // Both are sorted by creation time.
      const query: QueryOptions = department
        ? { index: 'GSI2', pk: `DEPT#${department}`, sk: { beginsWith: 'DOCTOR#' } }
        : { index: 'GSI1', pk: typePartition('DOCTOR') };
      const page = await queryPage({
        ...query,
        forward: !descending,
        limit,
        cursor,
        filter: specialization || status ? matches : undefined,
      });
      doctors = page.items.map((i) => doctorRepo.fromItem(i));
      nextCursor = page.nextCursor;
    }

    await populate(doctors, 'department', departmentRepo, ['name', 'code']);

    return res.json({
      success: true,
      doctors,
      pagination: paginationMeta(limit, doctors.length, nextCursor),
    });
  } catch (error) {
    next(error);
  }
};

export const getDoctorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doctor: any = await doctorRepo.get(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    await populate([doctor], 'department', departmentRepo, ['name', 'code', 'description']);
    return res.json({ success: true, doctor });
  } catch (error) {
    next(error);
  }
};

export const createDoctor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createDoctorSchema.parse(req.body);

    // Ids are plain strings now, so check the department exists (Mongo used to reject bad ids).
    if (!(await departmentRepo.get(data.department))) {
      return res.status(400).json({ success: false, message: 'Department not found' });
    }

    const existingUser = await findUserByEmail(data.email);
    if (existingUser) return res.status(400).json({ success: false, message: EMAIL_REGISTERED });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const doctorId = await newDoctorId();
    const userId = randomUUID();

    const { entity: doctor, ops } = doctorRepo.prepareCreate({
      doctorId,
      user: userId,
      name: data.name.trim(),
      email: data.email,
      phone: data.phone,
      specialization: data.specialization,
      department: data.department,
      qualification: data.qualification,
      experienceYears: data.experienceYears,
      consultationFee: data.consultationFee,
      availableDays: data.availableDays,
      availableTimeSlots: data.availableTimeSlots,
      roomNumber: data.roomNumber,
      rating: 4.8,
      profileImage: '',
      bio: data.bio ?? '',
      status: 'active',
    });

    // User + doctor profile in ONE transaction (no orphan user on failure).
    try {
      await createUserAccount(
        { _id: userId, name: data.name, email: data.email, password: hashedPassword, role: 'doctor', phone: data.phone },
        ops
      );
    } catch (err) {
      // The email guard lost a race with a concurrent request using the same email.
      if (err instanceof ConflictError && (err.message === EMAIL_TAKEN || (await isTakenByOther('EMAIL', data.email, userId)))) {
        return res.status(400).json({ success: false, message: EMAIL_REGISTERED });
      }
      throw err;
    }

    await logAudit({
      user: req.user, action: 'DOCTOR_CREATED', entity: 'Doctor',
      entityId: doctor._id, description: `Doctor ${data.name} (${doctorId}) added`,
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Doctor created successfully', doctor });
  } catch (error) {
    next(error);
  }
};

export const updateDoctor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateDoctorSchema.parse(req.body);
    if (data.department && !(await departmentRepo.get(data.department))) {
      return res.status(400).json({ success: false, message: 'Department not found' });
    }
    const patch: Partial<IDoctor> = definedFields(data) as Partial<IDoctor>;
    if (data.name) patch.name = data.name.trim();

    // Versioned write; changing the department also moves the doctor's GSI2 entry.
    const updated = await doctorRepo.update(req.params.id, () => patch);
    if (!updated) return res.status(404).json({ success: false, message: 'Doctor not found' });

    await syncUserNamePhone(updated.user, { name: data.name, phone: data.phone });

    await logAudit({
      user: req.user, action: 'DOCTOR_UPDATED', entity: 'Doctor',
      entityId: updated._id, description: `Doctor ${updated.doctorId} updated`,
      ipAddress: req.ip,
    });

    const doctor: any = { ...updated };
    await populate([doctor], 'department', departmentRepo);

    return res.json({ success: true, message: 'Doctor updated successfully', doctor });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doctor = await doctorRepo.remove(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    await logAudit({
      user: req.user, action: 'DOCTOR_DELETED', entity: 'Doctor',
      entityId: doctor._id, description: `Doctor ${doctor.doctorId} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Doctor deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getDoctorSlots = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doctor = await doctorRepo.get(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    return res.json({
      success: true,
      data: {
        availableDays: doctor.availableDays,
        availableTimeSlots: doctor.availableTimeSlots,
      },
    });
  } catch (error) {
    next(error);
  }
};
