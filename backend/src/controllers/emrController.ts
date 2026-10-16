import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { doctorRepo, medicalRecordRepo, patientRepo, prescriptionRepo } from '../repositories';
import { findDoctorByUser, findPatientByUser } from '../repositories/profiles';
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

  // Role-based (if the profile is missing, the original did not restrict either)
  if (req.user?.role === 'patient') {
    const p = await findPatientByUser(req.user.id);
    if (p) patient = p._id;
  } else if (req.user?.role === 'doctor') {
    const d = await findDoctorByUser(req.user.id);
    if (d) doctor = d._id;
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
      // When both patient and doctor are given, the patient partition is queried
      // and the doctor is checked on each item.
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

    // Ids are plain strings now, so check the references exist instead of
    // storing a record that points nowhere (Mongoose failed with a CastError).
    const [patient, doctor] = await Promise.all([patientRepo.get(data.patient), doctorRepo.get(data.doctor)]);
    if (!patient) return res.status(400).json({ success: false, message: 'Patient not found' });
    if (!doctor) return res.status(400).json({ success: false, message: 'Doctor not found' });

    // Atomic counter instead of countDocuments() + 1 (no duplicate ids under concurrency).
    const recordId = await newRecordId();

    const record = await medicalRecordRepo.create({
      recordId,
      ...data,
      clinicalNotes: data.clinicalNotes ?? '',
      attachments: [],
      date: new Date().toISOString(),
      followUpDate,
    });

    await logAudit({
      user: req.user, action: 'MEDICAL_RECORD_CREATED', entity: 'MedicalRecord',
      entityId: record._id, description: `EMR ${recordId} created`,
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

    const [patient, doctor] = await Promise.all([patientRepo.get(data.patient), doctorRepo.get(data.doctor)]);
    if (!patient) return res.status(400).json({ success: false, message: 'Patient not found' });
    if (!doctor) return res.status(400).json({ success: false, message: 'Doctor not found' });

    const prescriptionId = await newPrescriptionId();

    const prescription = await prescriptionRepo.create({
      prescriptionId,
      ...data,
      notes: data.notes ?? '',
      status: 'active',
      date: new Date().toISOString(),
    });

    await logAudit({
      user: req.user, action: 'PRESCRIPTION_CREATED', entity: 'Prescription',
      entityId: prescription._id, description: `Prescription ${prescriptionId} issued`,
      ipAddress: req.ip,
    });

    const populated: any = { ...prescription };
    await populateSummary([populated]);

    return res.status(201).json({ success: true, message: 'Prescription created', prescription: populated });
  } catch (error) {
    next(error);
  }
};
