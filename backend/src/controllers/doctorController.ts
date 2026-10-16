import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Doctor } from '../models/Doctor';
import { User } from '../models/User';
import { createDoctorSchema, updateDoctorSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import bcrypt from 'bcryptjs';

export const getDoctors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, department, specialization, status, page = '1', limit = '20', sort = '-createdAt' } = req.query;
    const filter: any = {};

    if (search) {
      const s = String(search);
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { doctorId: { $regex: s, $options: 'i' } },
        { specialization: { $regex: s, $options: 'i' } },
      ];
    }
    if (department) filter.department = department;
    if (specialization) filter.specialization = { $regex: String(specialization), $options: 'i' };
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [doctors, total] = await Promise.all([
      Doctor.find(filter).sort(String(sort)).skip(skip).limit(limitNum).populate('department', 'name code'),
      Doctor.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      doctors,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const getDoctorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('department', 'name code description');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    return res.json({ success: true, doctor });
  } catch (error) {
    next(error);
  }
};

export const createDoctor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createDoctorSchema.parse(req.body);

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email is already registered' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    const user = await User.create({
      name: data.name, email: data.email, password: hashedPassword, role: 'doctor', phone: data.phone,
    });

    const count = await Doctor.countDocuments();
    const doctorId = `D-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    const doctor = await Doctor.create({
      doctorId,
      user: user._id,
      name: data.name,
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
      bio: data.bio,
    });

    await logAudit({
      user: req.user, action: 'DOCTOR_CREATED', entity: 'Doctor',
      entityId: doctor._id.toString(), description: `Doctor ${data.name} (${doctorId}) added`,
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
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).populate('department');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    if (data.name || data.phone) {
      await User.findByIdAndUpdate(doctor.user, {
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
      });
    }

    await logAudit({
      user: req.user, action: 'DOCTOR_UPDATED', entity: 'Doctor',
      entityId: doctor._id.toString(), description: `Doctor ${doctor.doctorId} updated`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Doctor updated successfully', doctor });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctor = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    await logAudit({
      user: req.user, action: 'DOCTOR_DELETED', entity: 'Doctor',
      entityId: doctor._id.toString(), description: `Doctor ${doctor.doctorId} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Doctor deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getDoctorSlots = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    return res.json({
      success: true,
      data: {
        availableDays: doctor.availableDays,
        availableTimeSlots: doctor.availableTimeSlots
      }
    });
  } catch (error) {
    next(error);
  }
};

