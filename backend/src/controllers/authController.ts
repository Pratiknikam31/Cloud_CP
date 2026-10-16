import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUser } from '../types/entities';
import { departmentRepo, patientRepo, userRepo } from '../repositories';
import { createUserAccount, EMAIL_TAKEN, findUserByEmail } from '../repositories/userAccounts';
import { findDoctorByUser, findPatientByUser } from '../repositories/profiles';
import { populate } from '../db/populate';
import { STATS, statsAdd } from '../db/keys';
import { nowIso, TxOp } from '../db/dynamo';
import { newPatientId } from '../utils/ids';
import { ConflictError } from '../utils/errors';
import { env } from '../config/env';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/authValidator';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/auditLogger';

const generateToken = (user: IUser): string => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    env.jwtSecret(),
    { expiresIn: env.jwtExpiresIn() as jwt.SignOptions['expiresIn'] }
  );
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await findUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: EMAIL_TAKEN });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    // Auto-create patient profile if registering as patient (same transaction as the user)
    const userId = randomUUID();
    const extra: TxOp[] = [];
    if (validatedData.role === 'patient') {
      const patientId = await newPatientId();
      const { ops } = patientRepo.prepareCreate({
        patientId,
        user: userId,
        name: validatedData.name.trim(),
        email: validatedData.email.trim().toLowerCase(),
        phone: validatedData.phone || '555-0100',
        dob: new Date('1990-01-01').toISOString(),
        gender: 'other',
        bloodGroup: 'O+',
        address: '123 Health Ave, Medical City',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '555-0199'
        },
        insuranceProvider: '',
        insurancePolicyNumber: '',
        allergies: ['None'],
        medicalHistory: ['General checkup'],
        profileImage: '',
      });
      extra.push(...ops, statsAdd(STATS.totals, { patients: 1 }));
    }

    let user: IUser;
    try {
      user = await createUserAccount(
        {
          _id: userId,
          name: validatedData.name,
          email: validatedData.email,
          password: hashedPassword,
          role: validatedData.role,
          phone: validatedData.phone || '',
        },
        extra
      );
    } catch (err) {
      // The email guard lost a race with a concurrent registration.
      if (err instanceof ConflictError && err.message === EMAIL_TAKEN) {
        return res.status(400).json({ success: false, message: EMAIL_TAKEN });
      }
      throw err;
    }

    const token = generateToken(user);

    await logAudit({
      user,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user._id,
      description: `New user account created with role ${user.role}`,
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact Admin.' });
    }

    // lastLogin is informational; a concurrent update simply loses this timestamp.
    await userRepo.update(user._id, () => ({ lastLogin: nowIso() })).catch((err) => {
      if (!(err instanceof ConflictError)) throw err;
    });

    const token = generateToken(user);

    await logAudit({
      user,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user._id,
      description: `User ${user.email} logged in successfully`,
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await userRepo.get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let extraProfile: any = null;
    if (user.role === 'patient') {
      extraProfile = await findPatientByUser(user._id);
    } else if (user.role === 'doctor') {
      extraProfile = await findDoctorByUser(user._id);
      if (extraProfile) await populate([extraProfile], 'department', departmentRepo);
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      },
      profile: extraProfile
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { name, phone, avatar } = req.body;
    const user = await userRepo.update(req.user.id, () => {
      const patch: Partial<IUser> = {};
      if (name && typeof name === 'string') patch.name = name;
      if (phone && typeof phone === 'string') patch.phone = phone;
      if (avatar && typeof avatar === 'string') patch.avatar = avatar;
      return patch;
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await userRepo.get(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(newPassword, salt);
    await userRepo.update(user._id, (current) => {
      // Refuse if the password was changed by another request since we checked it.
      if (current.password !== user.password) throw new ConflictError('Password was changed by another request. Please retry.');
      return { password };
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
