import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { doctorRepo, patientRepo, userRepo } from '../repositories';
import { createUserAccount, EMAIL_TAKEN, findUserByEmail } from '../repositories/userAccounts';
import { queryAll, queryPage } from '../db/dynamo';
import { STATS, statsAdd, typePartition } from '../db/keys';
import { IUser, UserRole } from '../types/entities';
import { createUserSchema, updateUserRoleSchema, updateUserStatusSchema } from '../validators/authValidator';
import { logAudit } from '../utils/auditLogger';
import { isDescending, paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newDoctorId, newPatientId } from '../utils/ids';
import { ConflictError } from '../utils/errors';

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = queryString(req.query.role);
    const search = queryString(req.query.search);
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const descending = isDescending(req.query.sort, true);

    const filter = (u: any) => {
      if (role && u.role !== role) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(s);
        const matchesEmail = u.email?.toLowerCase().includes(s);
        if (!matchesName && !matchesEmail) return false;
      }
      return true;
    };

    const page = await queryPage({
      index: 'GSI1',
      pk: typePartition('USER'),
      forward: !descending,
      limit,
      cursor,
      filter: role || search ? filter : undefined,
    });

    const users = page.items.map((i) => userRepo.toPublic(userRepo.fromItem(i)));

    res.status(200).json({
      success: true,
      users,
      pagination: paginationMeta(limit, users.length, page.nextCursor),
    });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const data = createUserSchema.parse(req.body);
    const cleanEmail = data.email.trim().toLowerCase();

    // Privilege Escalation Guard: Only an existing Super Admin can create Super Admins or Hospital Admins
    if ((data.role === 'super_admin' || data.role === 'hospital_admin') && caller.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only a Super Administrator can provision administrative accounts',
      });
      return;
    }

    const existing = await findUserByEmail(cleanEmail);
    if (existing) {
      res.status(400).json({ success: false, message: EMAIL_TAKEN });
      return;
    }

    const initialPassword = data.password || 'password123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(initialPassword, salt);
    const userId = randomUUID();

    const extraOps: any[] = [];

    // Auto-create profile if doctor or patient
    if (data.role === 'doctor') {
      const docId = await newDoctorId();
      const { ops } = doctorRepo.prepareCreate({
        doctorId: docId,
        user: userId,
        name: data.name.trim(),
        email: cleanEmail,
        phone: data.phone || '+1 555-0100',
        specialization: data.specialization || 'General Medicine',
        department: data.department || 'general',
        qualification: 'MD',
        experienceYears: 5,
        consultationFee: 100,
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        availableTimeSlots: [
          { start: '09:00', end: '13:00' },
          { start: '14:00', end: '17:00' },
        ],
        roomNumber: '101',
        rating: 5,
        profileImage: '',
        bio: `Dr. ${data.name.trim()} - Dedicated specialist.`,
        status: 'active',
      });
      extraOps.push(...ops);
    } else if (data.role === 'patient') {
      const patId = await newPatientId();
      const { ops } = patientRepo.prepareCreate({
        patientId: patId,
        user: userId,
        name: data.name.trim(),
        email: cleanEmail,
        phone: data.phone || '+1 555-0100',
        dob: '1990-01-01',
        gender: 'other',
        bloodGroup: 'O+',
        address: 'Medical City',
        emergencyContact: { name: 'Emergency Contact', relationship: 'Family', phone: '+1 555-0199' },
        insuranceProvider: '',
        insurancePolicyNumber: '',
        allergies: ['None'],
        medicalHistory: ['General checkup'],
        profileImage: '',
      });
      extraOps.push(...ops, statsAdd(STATS.totals, { patients: 1 }));
    }

    const newUser = await createUserAccount(
      {
        _id: userId,
        name: data.name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: data.role as UserRole,
        phone: data.phone || '',
      },
      extraOps
    );

    await logAudit({
      user: caller,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: newUser._id,
      description: `User account created: ${newUser.email} with role '${newUser.role}' by ${caller.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `User account for ${newUser.name} created successfully`,
      user: userRepo.toPublic(newUser),
      initialPassword,
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { role: newRole } = updateUserRoleSchema.parse(req.body);
    const targetUserId = req.params.id;

    const targetUser = await userRepo.get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Protection: Hospital admin cannot modify a Super Admin's account
    if (targetUser.role === 'super_admin' && caller.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only a Super Administrator can manage Super Admin accounts',
      });
      return;
    }

    // Protection: Hospital admin cannot promote anyone to Super Admin or Hospital Admin
    if ((newRole === 'super_admin' || newRole === 'hospital_admin') && caller.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only a Super Administrator can grant administrative roles',
      });
      return;
    }

    const previousRole = targetUser.role;
    const updated = await userRepo.update(targetUserId, () => ({ role: newRole as UserRole }));
    if (!updated) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await logAudit({
      user: caller,
      action: 'USER_ROLE_CHANGED',
      entity: 'User',
      entityId: updated._id,
      description: `Role changed for ${updated.email}: ${previousRole} → ${newRole} by ${caller.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `User role updated to ${newRole}`,
      user: userRepo.toPublic(updated),
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const caller = req.user;
    if (!caller) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { isActive } = updateUserStatusSchema.parse(req.body);
    const targetUserId = req.params.id;

    const targetUser = await userRepo.get(targetUserId);
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (targetUser.role === 'super_admin' && caller.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only a Super Administrator can modify Super Admin accounts',
      });
      return;
    }

    const updated = await userRepo.update(targetUserId, () => ({ isActive }));
    if (!updated) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    await logAudit({
      user: caller,
      action: 'USER_STATUS_CHANGED',
      entity: 'User',
      entityId: updated._id,
      description: `User ${updated.email} status changed to ${isActive ? 'Active' : 'Deactivated'} by ${caller.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: userRepo.toPublic(updated),
    });
  } catch (err) {
    next(err);
  }
};
