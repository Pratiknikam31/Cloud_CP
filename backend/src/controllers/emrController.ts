import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MedicalRecord } from '../models/MedicalRecord';
import { Prescription } from '../models/Prescription';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { createMedicalRecordSchema, createPrescriptionSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';

// ── Medical Records ──

export const getMedicalRecords = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { patient, doctor, page = '1', limit = '20', sort = '-date' } = req.query;
    const filter: any = {};

    if (patient) filter.patient = patient;
    if (doctor) filter.doctor = doctor;

    // Role-based
    if (req.user?.role === 'patient') {
      const p = await Patient.findOne({ user: req.user.id });
      if (p) filter.patient = p._id;
    } else if (req.user?.role === 'doctor') {
      const d = await Doctor.findOne({ user: req.user.id });
      if (d) filter.doctor = d._id;
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));

    const [records, total] = await Promise.all([
      MedicalRecord.find(filter)
        .sort(String(sort))
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('patient', 'patientId name')
        .populate('doctor', 'doctorId name specialization'),
      MedicalRecord.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      records,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalRecordById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate('patient', 'patientId name email phone dob gender bloodGroup allergies medicalHistory')
      .populate('doctor', 'doctorId name specialization qualification');
    if (!record) return res.status(404).json({ success: false, message: 'Medical record not found' });
    return res.json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

export const createMedicalRecord = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createMedicalRecordSchema.parse(req.body);

    const count = await MedicalRecord.countDocuments();
    const recordId = `EMR-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

    const record = await MedicalRecord.create({
      recordId,
      ...data,
      date: new Date(),
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
    });

    await logAudit({
      user: req.user, action: 'MEDICAL_RECORD_CREATED', entity: 'MedicalRecord',
      entityId: record._id.toString(), description: `EMR ${recordId} created`,
      ipAddress: req.ip,
    });

    const populated = await MedicalRecord.findById(record._id)
      .populate('patient', 'patientId name')
      .populate('doctor', 'doctorId name specialization');

    return res.status(201).json({ success: true, message: 'Medical record created', record: populated });
  } catch (error) {
    next(error);
  }
};

// ── Prescriptions ──

export const getPrescriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { patient, doctor, page = '1', limit = '20', sort = '-date' } = req.query;
    const filter: any = {};

    if (patient) filter.patient = patient;
    if (doctor) filter.doctor = doctor;

    if (req.user?.role === 'patient') {
      const p = await Patient.findOne({ user: req.user.id });
      if (p) filter.patient = p._id;
    } else if (req.user?.role === 'doctor') {
      const d = await Doctor.findOne({ user: req.user.id });
      if (d) filter.doctor = d._id;
    }

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));

    const [prescriptions, total] = await Promise.all([
      Prescription.find(filter)
        .sort(String(sort))
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('patient', 'patientId name')
        .populate('doctor', 'doctorId name specialization'),
      Prescription.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      prescriptions,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const getPrescriptionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient', 'patientId name email phone dob gender bloodGroup allergies')
      .populate('doctor', 'doctorId name specialization qualification');
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });
    return res.json({ success: true, prescription });
  } catch (error) {
    next(error);
  }
};

export const createPrescription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPrescriptionSchema.parse(req.body);

    const count = await Prescription.countDocuments();
    const prescriptionId = `RX-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

    const prescription = await Prescription.create({
      prescriptionId,
      ...data,
      date: new Date(),
    });

    await logAudit({
      user: req.user, action: 'PRESCRIPTION_CREATED', entity: 'Prescription',
      entityId: prescription._id.toString(), description: `Prescription ${prescriptionId} issued`,
      ipAddress: req.ip,
    });

    const populated = await Prescription.findById(prescription._id)
      .populate('patient', 'patientId name')
      .populate('doctor', 'doctorId name specialization');

    return res.status(201).json({ success: true, message: 'Prescription created', prescription: populated });
  } catch (error) {
    next(error);
  }
};
