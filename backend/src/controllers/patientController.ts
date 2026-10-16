import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Patient } from '../models/Patient';
import { User } from '../models/User';
import { Appointment } from '../models/Appointment';
import { MedicalRecord } from '../models/MedicalRecord';
import { LabReport } from '../models/LabReport';
import { Prescription } from '../models/Prescription';
import { createPatientSchema, updatePatientSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import bcrypt from 'bcryptjs';

// GET /api/patients — list all patients with search, filter, pagination
export const getPatients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, gender, bloodGroup, page = '1', limit = '20', sort = '-createdAt' } = req.query;

    const filter: any = {};
    if (search) {
      const s = String(search);
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { patientId: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }
    if (gender) filter.gender = gender;
    if (bloodGroup) filter.bloodGroup = bloodGroup;

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));
    const skip = (pageNum - 1) * limitNum;

    const [patients, total] = await Promise.all([
      Patient.find(filter).sort(String(sort)).skip(skip).limit(limitNum).populate('user', 'name email role isActive lastLogin'),
      Patient.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      patients,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/patients/:id
export const getPatientById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('user', 'name email role isActive lastLogin');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    return res.json({ success: true, patient });
  } catch (error) {
    next(error);
  }
};

// POST /api/patients — create patient (also creates User account)
export const createPatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPatientSchema.parse(req.body);

    // Check for existing user
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Create user account
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);
    const user = await User.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: 'patient',
      phone: data.phone,
    });

    // Generate unique patient ID
    const count = await Patient.countDocuments();
    const patientId = `P-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

    const patient = await Patient.create({
      patientId,
      user: user._id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      dob: new Date(data.dob),
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      address: data.address,
      emergencyContact: data.emergencyContact,
      insuranceProvider: data.insuranceProvider,
      insurancePolicyNumber: data.insurancePolicyNumber,
      allergies: data.allergies,
      medicalHistory: data.medicalHistory,
    });

    await logAudit({
      user: req.user,
      action: 'PATIENT_CREATED',
      entity: 'Patient',
      entityId: patient._id.toString(),
      description: `Patient ${data.name} (${patientId}) registered`,
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Patient created successfully', patient });
  } catch (error) {
    next(error);
  }
};

// PUT /api/patients/:id
export const updatePatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updatePatientSchema.parse(req.body);
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    Object.assign(patient, data);
    if (data.dob) patient.dob = new Date(data.dob);
    await patient.save();

    // Sync user name/phone if changed
    if (data.name || data.phone) {
      await User.findByIdAndUpdate(patient.user, {
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
      });
    }

    await logAudit({
      user: req.user,
      action: 'PATIENT_UPDATED',
      entity: 'Patient',
      entityId: patient._id.toString(),
      description: `Patient ${patient.patientId} updated`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Patient updated successfully', patient });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/patients/:id
export const deletePatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    await Patient.findByIdAndDelete(req.params.id);

    await logAudit({
      user: req.user,
      action: 'PATIENT_DELETED',
      entity: 'Patient',
      entityId: patient._id.toString(),
      description: `Patient ${patient.patientId} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getPatientTimeline = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.id;
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const [appointments, medicalRecords, labReports, prescriptions] = await Promise.all([
      Appointment.find({ patient: patientId }).populate('doctor', 'name specialization').sort({ date: -1 }),
      MedicalRecord.find({ patient: patientId }).populate('doctor', 'name specialization').sort({ createdAt: -1 }),
      LabReport.find({ patient: patientId }).populate('doctor', 'name').populate('labTest', 'name category').sort({ createdAt: -1 }),
      Prescription.find({ patient: patientId }).populate('doctor', 'name').sort({ date: -1 })
    ]);

    const timeline = [
      ...appointments.map((a) => ({ type: 'appointment', date: a.date, data: a })),
      ...medicalRecords.map((m) => ({ type: 'medical_record', date: m.createdAt, data: m })),
      ...labReports.map((l) => ({ type: 'lab_report', date: l.createdAt, data: l })),
      ...prescriptions.map((p) => ({ type: 'prescription', date: p.date, data: p }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json({
      success: true,
      data: {
        patient,
        timeline
      }
    });
  } catch (error) {
    next(error);
  }
};

