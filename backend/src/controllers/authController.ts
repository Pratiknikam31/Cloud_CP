import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/authValidator';
import { AuthRequest } from '../middleware/auth';
import { logAudit } from '../utils/auditLogger';

const generateToken = (user: IUser): string => {
  const secret = process.env.JWT_SECRET || 'smarthospital_jwt_super_secret_key_2026_production_ready';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    secret,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
  );
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email address is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      role: validatedData.role,
      phone: validatedData.phone || '',
    });

    // Auto-create patient profile if registering as patient
    if (user.role === 'patient') {
      const count = await Patient.countDocuments();
      const patientId = `P-2026-${(count + 1).toString().padStart(4, '0')}`;

      await Patient.create({
        patientId,
        user: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '555-0100',
        dob: new Date('1990-01-01'),
        gender: 'other',
        bloodGroup: 'O+',
        address: '123 Health Ave, Medical City',
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Family',
          phone: '555-0199'
        },
        allergies: ['None'],
        medicalHistory: ['General checkup']
      });
    }

    const token = generateToken(user);

    await logAudit({
      user,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user._id.toString(),
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

    const user = await User.findOne({ email }).select('+password');
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

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    await logAudit({
      user,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user._id.toString(),
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

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let extraProfile = null;
    if (user.role === 'patient') {
      extraProfile = await Patient.findOne({ user: user._id });
    } else if (user.role === 'doctor') {
      extraProfile = await Doctor.findOne({ user: user._id }).populate('department');
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
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    await user.save();

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

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
