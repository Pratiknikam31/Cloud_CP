import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { Department } from '../models/Department';
import { Notification } from '../models/Notification';
import { createAppointmentSchema, updateAppointmentStatusSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';

export const getAppointments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, doctor, patient, department, date, dateFrom, dateTo, page = '1', limit = '20', sort = '-date' } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (doctor) filter.doctor = doctor;
    if (patient) filter.patient = patient;
    if (department) filter.department = department;
    if (date) {
      const d = new Date(String(date));
      filter.date = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(String(dateFrom));
      if (dateTo) filter.date.$lte = new Date(String(dateTo));
    }

    // Role-based filtering
    if (req.user?.role === 'patient') {
      const patientProfile = await Patient.findOne({ user: req.user.id });
      if (patientProfile) filter.patient = patientProfile._id;
    } else if (req.user?.role === 'doctor') {
      const doctorProfile = await Doctor.findOne({ user: req.user.id });
      if (doctorProfile) filter.doctor = doctorProfile._id;
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort(String(sort))
        .skip(skip)
        .limit(limitNum)
        .populate('patient', 'patientId name email phone')
        .populate({ path: 'doctor', select: 'doctorId name specialization consultationFee roomNumber', populate: { path: 'department', select: 'name code' } })
        .populate('department', 'name code'),
      Appointment.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      appointments,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient', 'patientId name email phone dob gender bloodGroup allergies medicalHistory')
      .populate({ path: 'doctor', select: 'doctorId name specialization consultationFee roomNumber department', populate: { path: 'department', select: 'name code' } })
      .populate('department', 'name code');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    return res.json({ success: true, appointment });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let body = { ...req.body };
    if (!body.patient && req.user) {
      const p = await Patient.findOne({ user: req.user._id });
      if (p) body.patient = p._id.toString();
    }
    // If doctor is passed by name instead of ObjectId
    if (body.doctor && !mongoose.Types.ObjectId.isValid(body.doctor)) {
      const doc = await Doctor.findOne({ name: { $regex: new RegExp(body.doctor, 'i') } });
      if (doc) body.doctor = doc._id.toString();
    }
    // If department is passed by name instead of ObjectId
    if (body.department && !mongoose.Types.ObjectId.isValid(body.department)) {
      const dept = await Department.findOne({ name: { $regex: new RegExp(body.department, 'i') } });
      if (dept) body.department = dept._id.toString();
    }

    const data = createAppointmentSchema.parse(body);
    const appointmentDate = new Date(data.date);


    // Check for conflicting appointments (same doctor, same date, same time slot)
    const conflict = await Appointment.findOne({
      doctor: data.doctor,
      date: {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lte: new Date(appointmentDate.setHours(23, 59, 59, 999)),
      },
      timeSlot: data.timeSlot,
      status: { $nin: ['cancelled', 'no_show', 'completed'] },
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked. Please choose a different time.',
      });
    }

    // Generate queue number for the day
    const dayStart = new Date(data.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(data.date);
    dayEnd.setHours(23, 59, 59, 999);

    const todayCount = await Appointment.countDocuments({
      doctor: data.doctor,
      date: { $gte: dayStart, $lte: dayEnd },
    });

    const count = await Appointment.countDocuments();
    const appointmentId = `APT-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

    const appointment = await Appointment.create({
      appointmentId,
      patient: data.patient,
      doctor: data.doctor,
      department: data.department,
      date: new Date(data.date),
      timeSlot: data.timeSlot,
      symptoms: data.symptoms,
      type: data.type,
      notes: data.notes,
      queueNumber: todayCount + 1,
    });

    // Create notification for doctor
    const doctor = await Doctor.findById(data.doctor);
    if (doctor) {
      await Notification.create({
        recipient: doctor.user,
        title: 'New Appointment Booked',
        message: `Appointment ${appointmentId} scheduled for ${new Date(data.date).toLocaleDateString()} at ${data.timeSlot}`,
        type: 'appointment',
        link: `/doctor/appointments`,
      });
    }

    await logAudit({
      user: req.user, action: 'APPOINTMENT_CREATED', entity: 'Appointment',
      entityId: appointment._id.toString(),
      description: `Appointment ${appointmentId} booked for ${new Date(data.date).toLocaleDateString()}`,
      ipAddress: req.ip,
    });

    const populated = await Appointment.findById(appointment._id)
      .populate('patient', 'patientId name')
      .populate('doctor', 'doctorId name specialization')
      .populate('department', 'name code');

    return res.status(201).json({ success: true, message: 'Appointment booked successfully', appointment: populated });
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateAppointmentStatusSchema.parse(req.body);
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    const previousStatus = appointment.status;
    appointment.status = data.status;
    if (data.notes) appointment.notes = data.notes;
    await appointment.save();

    // Notify patient on status change
    await Notification.create({
      recipient: (await Patient.findById(appointment.patient))?.user,
      title: 'Appointment Status Updated',
      message: `Your appointment ${appointment.appointmentId} has been updated to: ${data.status.replace('_', ' ')}`,
      type: 'appointment',
    });

    await logAudit({
      user: req.user, action: 'APPOINTMENT_STATUS_CHANGED', entity: 'Appointment',
      entityId: appointment._id.toString(),
      description: `Appointment ${appointment.appointmentId} status: ${previousStatus} → ${data.status}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Appointment status updated', appointment });
  } catch (error) {
    next(error);
  }
};

export const deleteAppointment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    await logAudit({
      user: req.user, action: 'APPOINTMENT_DELETED', entity: 'Appointment',
      entityId: appointment._id.toString(),
      description: `Appointment ${appointment.appointmentId} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    next(error);
  }
};

// GET /api/appointments/today-stats — dashboard statistics
export const getAppointmentStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    const dayStart = new Date(today.setHours(0, 0, 0, 0));
    const dayEnd = new Date(today.setHours(23, 59, 59, 999));

    const [todayTotal, todayCompleted, todayPending, weekTotal, monthTotal] = await Promise.all([
      Appointment.countDocuments({ date: { $gte: dayStart, $lte: dayEnd } }),
      Appointment.countDocuments({ date: { $gte: dayStart, $lte: dayEnd }, status: 'completed' }),
      Appointment.countDocuments({ date: { $gte: dayStart, $lte: dayEnd }, status: { $in: ['pending', 'confirmed'] } }),
      Appointment.countDocuments({
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      Appointment.countDocuments({
        date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return res.json({
      success: true,
      stats: { todayTotal, todayCompleted, todayPending, weekTotal, monthTotal },
    });
  } catch (error) {
    next(error);
  }
};
