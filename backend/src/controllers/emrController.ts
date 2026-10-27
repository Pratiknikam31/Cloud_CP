import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { doctorRepo, medicalRecordRepo, patientRepo, prescriptionRepo } from '../repositories';
import { findDoctorByUser, findPatientByUser } from '../repositories/profiles';
import { canAccessPatientResource } from '../middleware/ownership';
import { queryPage, QueryOptions } from '../db/dynamo';
import { doctorPartition, patientPartition, typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { createMedicalRecordSchema, createPrescriptionSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { parseDate } from '../utils/dates';
import { isDescending, paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newPrescriptionId, newRecordId } from '../utils/ids';

// Medical records (EMR#) and prescriptions (RX#) are stored with the same key
// layout, so both lists share one query helper:
//   by patient -> GSI2 PATIENT#<id>, sort key "EMR#<date>#<id>" / "RX#<date>#<id>"
//   by doctor  -> GSI3 DOCTOR#<id>,  same sort key
//   otherwise  -> GSI1 TYPE#EMR / TYPE#RX, sort key "<date>#<id>"
// All three are sorted by date, so `sort` only chooses newest/oldest first.

const listByScope = async (req: AuthRequest, prefix: 'EMR' | 'RX') => {
  let patient = queryString(req.query.patient);
  let doctor = queryString(req.query.doctor);
  const limit = parseLimit(req.query.limit, 20, 100);
  const cursor = parseCursor(req.query.cursor);
  const descending = isDescending(req.query.sort, true);

  // Role-based scoping: If a patient or doctor has no profile, never fall back to "all"!
  if (req.user?.role === 'patient') {
    const p = await findPatientByUser(req.user.id);
    if (!p) {
      return { limit, items: [], nextCursor: undefined };
    }
    patient = p._id;
  } else if (req.user?.role === 'doctor') {
    const d = await findDoctorByUser(req.user.id);
    if (!d) {
      if (!patient) {
        return { limit, items: [], nextCursor: undefined };
      }
    } else {
      if (queryString(req.query.doctor)) {
        doctor = queryString(req.query.doctor);
      } else if (req.query.all === 'true') {
        doctor = undefined;
      } else {
        doctor = d._id;
      }
    }
  }

  let query: QueryOptions;
  if (patient) {
    query = { index: 'GSI2', pk: patientPartition(patient), sk: { beginsWith: `${prefix}#` } };
  } else if (doctor) {
    query = { index: 'GSI3', pk: doctorPartition(doctor), sk: { beginsWith: `${prefix}#` } };
  } else {
    query = { index: 'GSI1', pk: typePartition(prefix) };
  }

  return {
    limit,
    ...(await queryPage({
      ...query,
      forward: !descending,
      limit,
      cursor,
      filter: patient && doctor ? (item) => item.doctor === doctor : undefined,
    })),
  };
};

const populateSummary = async (docs: any[]) => {
  await Promise.all([
    populate(docs, 'patient', patientRepo, ['patientId', 'name']),
    populate(docs, 'doctor', doctorRepo, ['doctorId', 'name', 'specialization']),
  ]);
};

// ── Medical Records ──

export const getMedicalRecords = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, nextCursor, limit } = await listByScope(req, 'EMR');
    const records: any[] = items.map((i) => medicalRecordRepo.fromItem(i));
    await populateSummary(records);

    return res.json({
      success: true,
      records,
      pagination: paginationMeta(limit, records.length, nextCursor),
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalRecordById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const record: any = await medicalRecordRepo.get(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Medical record not found' });

    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Enforce patient ownership check
    const allowed = await canAccessPatientResource(req.user, record.patient, 'emr');
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to view this medical record' });
    }

    // If caller is a doctor, verify doctor profile exists
    if (req.user.role === 'doctor') {
      const callerDoc = await findDoctorByUser(req.user.id);
      if (!callerDoc) {
        return res.status(403).json({ success: false, message: 'Access denied: Doctor profile required' });
      }
    }

    await Promise.all([
      populate([record], 'patient', patientRepo, ['patientId', 'name', 'email', 'phone', 'dob', 'gender', 'bloodGroup', 'allergies', 'medicalHistory']),
      populate([record], 'doctor', doctorRepo, ['doctorId', 'name', 'specialization', 'qualification']),
    ]);
    return res.json({ success: true, record });
  } catch (error) {
    next(error);
  }
};

export const createMedicalRecord = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createMedicalRecordSchema.parse(req.body);
    const followUpDate = data.followUpDate ? parseDate(data.followUpDate, 'followUpDate').toISOString() : undefined;

    // Doctor attribution to authenticated caller or assigned doctor
    let doctorId = data.doctor;
    if (req.user?.role === 'doctor') {
      const callerDoc = await findDoctorByUser(req.user.id);
      if (!callerDoc) {
        return res.status(403).json({ success: false, message: 'Doctor profile required to author clinical records' });
      }
      doctorId = data.doctor || callerDoc._id;
    }

    const [patient, doctor] = await Promise.all([patientRepo.get(data.patient), doctorRepo.get(doctorId)]);
    if (!patient) return res.status(400).json({ success: false, message: 'Patient not found' });
    if (!doctor) return res.status(400).json({ success: false, message: 'Doctor not found' });

    const recordId = await newRecordId();

    const record = await medicalRecordRepo.create({
      recordId,
      ...data,
      doctor: doctorId,
      clinicalNotes: data.clinicalNotes ?? '',
      attachments: [],
      date: new Date().toISOString(),
      followUpDate,
    });

    await logAudit({
      user: req.user, action: 'MEDICAL_RECORD_CREATED', entity: 'MedicalRecord',
      entityId: record._id, description: `EMR ${recordId} created by Dr. ${doctor.name}`,
      ipAddress: req.ip,
    });

    const populated: any = { ...record };
    await populateSummary([populated]);

    return res.status(201).json({ success: true, message: 'Medical record created', record: populated });
  } catch (error) {
    next(error);
  }
};

// ── Prescriptions ──

export const getPrescriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { items, nextCursor, limit } = await listByScope(req, 'RX');
    const prescriptions: any[] = items.map((i) => prescriptionRepo.fromItem(i));
    await populateSummary(prescriptions);

    return res.json({
      success: true,
      prescriptions,
      pagination: paginationMeta(limit, prescriptions.length, nextCursor),
    });
  } catch (error) {
    next(error);
  }
};

export const getPrescriptionById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prescription: any = await prescriptionRepo.get(req.params.id);
    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });

    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const allowed = await canAccessPatientResource(req.user, prescription.patient, 'prescription');
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to view this prescription' });
    }

    await Promise.all([
      populate([prescription], 'patient', patientRepo, ['patientId', 'name', 'email', 'phone', 'dob', 'gender', 'bloodGroup', 'allergies']),
      populate([prescription], 'doctor', doctorRepo, ['doctorId', 'name', 'specialization', 'qualification']),
    ]);
    return res.json({ success: true, prescription });
  } catch (error) {
    next(error);
  }
};

export const createPrescription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPrescriptionSchema.parse(req.body);

    let doctorId = data.doctor;
    if (req.user?.role === 'doctor') {
      const callerDoc = await findDoctorByUser(req.user.id);
      if (!callerDoc) {
        return res.status(403).json({ success: false, message: 'Doctor profile required to issue prescriptions' });
      }
      doctorId = data.doctor || callerDoc._id;
    }

    const [patient, doctor] = await Promise.all([patientRepo.get(data.patient), doctorRepo.get(doctorId)]);
    if (!patient) return res.status(400).json({ success: false, message: 'Patient not found' });
    if (!doctor) return res.status(400).json({ success: false, message: 'Doctor not found' });

    const prescriptionId = await newPrescriptionId();

    const prescription = await prescriptionRepo.create({
      prescriptionId,
      ...data,
      doctor: doctorId,
      notes: data.notes ?? '',
      status: 'active',
      date: new Date().toISOString(),
    });

    await logAudit({
      user: req.user, action: 'PRESCRIPTION_CREATED', entity: 'Prescription',
      entityId: prescription._id, description: `Prescription ${prescriptionId} issued by Dr. ${doctor.name}`,
      ipAddress: req.ip,
    });

    const populated: any = { ...prescription };
    await populateSummary([populated]);

    return res.status(201).json({ success: true, message: 'Prescription created', prescription: populated });
  } catch (error) {
    next(error);
  }
};

// ── Vitals & Nursing Observations (NUR-01) ──

export const recordVitals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { patient: patientId, appointment: appointmentId, vitals, notes } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const patient = await patientRepo.get(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Nurse records vitals without creating a clinical diagnosis
    const recordId = await newRecordId();
    const vitalsRecord = await medicalRecordRepo.create({
      recordId,
      patient: patientId,
      doctor: req.user?.role === 'doctor' ? req.user.id : (appointmentId ? (await doctorRepo.get(appointmentId))?._id || 'NURSE_STATION' : 'NURSE_STATION'),
      appointment: appointmentId,
      date: new Date().toISOString(),
      symptoms: 'Vitals & Nursing Observation',
      diagnosis: 'Nursing Observation: Vital signs recorded',
      clinicalNotes: notes || `Recorded by ${req.user?.name || 'Nursing Staff'} (${req.user?.role})`,
      vitals: {
        bloodPressure: vitals?.bloodPressure || '120/80',
        heartRate: Number(vitals?.heartRate || 72),
        temperature: Number(vitals?.temperature || 98.6),
        oxygenSaturation: Number(vitals?.oxygenSaturation || 98),
        weight: Number(vitals?.weight || 70),
        height: Number(vitals?.height || 170),
      },
      attachments: [],
    });

    await logAudit({
      user: req.user,
      action: 'VITALS_RECORDED',
      entity: 'MedicalRecord',
      entityId: vitalsRecord._id,
      description: `Vitals recorded for patient ${patient.name} (${patient.patientId}) by ${req.user?.name}`,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Vitals recorded successfully',
      data: { record: vitalsRecord },
    });
  } catch (error) {
    next(error);
  }
};
