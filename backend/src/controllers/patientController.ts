import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import {
  appointmentRepo,
  doctorRepo,
  labReportRepo,
  labTestRepo,
  medicalRecordRepo,
  patientRepo,
  prescriptionRepo,
  userRepo,
} from '../repositories';
import { createUserAccount, EMAIL_TAKEN, findUserByEmail } from '../repositories/userAccounts';
import { Item, queryAll, queryPage } from '../db/dynamo';
import { patientPartition, STATS, statsAdd, typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { IPatient } from '../types/entities';
import { createPatientSchema, updatePatientSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { parseDate } from '../utils/dates';
import { isDescending, paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newPatientId } from '../utils/ids';
import { ConflictError } from '../utils/errors';
import { definedFields, isTakenByOther, syncUserNamePhone } from '../services/identityService';

const EMAIL_REGISTERED = 'Email is already registered';
const USER_FIELDS = ['name', 'email', 'role', 'isActive', 'lastLogin'];

// GET /api/patients — list all patients with search, filter, pagination
export const getPatients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = queryString(req.query.search);
    const gender = queryString(req.query.gender);
    const bloodGroup = queryString(req.query.bloodGroup);
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const descending = isDescending(req.query.sort, true);

    const matches = (p: Item) => (!gender || p.gender === gender) && (!bloodGroup || p.bloodGroup === bloodGroup);

    let patients: any[];
    let nextCursor: string | undefined;
    if (search) {
      // Word-prefix search on the patient's search tokens (name words, patientId,
      // email, phone). Search results are a single page (no cursor). When gender/
      // bloodGroup filters are set we fetch extra matches first, so filtering
      // afterwards still fills the page.
      const found = await patientRepo.search(search, gender || bloodGroup ? 100 : limit);
      patients = found
        .filter(matches)
        .slice(0, limit)
        .sort((a, b) => (descending ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
    } else {
      // All patients, sorted by creation time on GSI1 (TYPE#PATIENT).
      const page = await queryPage({
        index: 'GSI1',
        pk: typePartition('PATIENT'),
        forward: !descending,
        limit,
        cursor,
        filter: gender || bloodGroup ? matches : undefined,
      });
      patients = page.items.map((i) => patientRepo.fromItem(i));
      nextCursor = page.nextCursor;
    }

    await populate(patients, 'user', userRepo, USER_FIELDS);

    return res.json({
      success: true,
      patients,
      pagination: paginationMeta(limit, patients.length, nextCursor),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/patients/:id
export const getPatientById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patient: any = await patientRepo.get(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    await populate([patient], 'user', userRepo, USER_FIELDS);
    return res.json({ success: true, patient });
  } catch (error) {
    next(error);
  }
};

// POST /api/patients — create patient (also creates User account)
export const createPatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createPatientSchema.parse(req.body);
    const dob = parseDate(data.dob, 'dob').toISOString();

    // Check for existing user
    const existingUser = await findUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: EMAIL_REGISTERED });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Unique patient ID from an atomic counter
    const patientId = await newPatientId();
    const userId = randomUUID();

    const { entity: patient, ops } = patientRepo.prepareCreate({
      patientId,
      user: userId,
      name: data.name.trim(),
      email: data.email,
      phone: data.phone,
      dob,
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      address: data.address,
      emergencyContact: data.emergencyContact,
      insuranceProvider: data.insuranceProvider ?? '',
      insurancePolicyNumber: data.insurancePolicyNumber ?? '',
      allergies: data.allergies,
      medicalHistory: data.medicalHistory,
      profileImage: '',
    });

    // User + patient + patient counter are written in ONE transaction, so a
    // failure can never leave a user without its patient profile.
    try {
      await createUserAccount(
        { _id: userId, name: data.name, email: data.email, password: hashedPassword, role: 'patient', phone: data.phone },
        [...ops, statsAdd(STATS.totals, { patients: 1 })]
      );
    } catch (err) {
      // The email guard lost a race with a concurrent request using the same email.
      if (err instanceof ConflictError && (err.message === EMAIL_TAKEN || (await isTakenByOther('EMAIL', data.email, userId)))) {
        return res.status(400).json({ success: false, message: EMAIL_REGISTERED });
      }
      throw err;
    }

    await logAudit({
      user: req.user,
      action: 'PATIENT_CREATED',
      entity: 'Patient',
      entityId: patient._id,
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
    const patch: Partial<IPatient> = definedFields(data) as Partial<IPatient>;
    if (data.dob) patch.dob = parseDate(data.dob, 'dob').toISOString();
    if (data.name) patch.name = data.name.trim();

    // Versioned write: a concurrent update of the same patient returns 409 instead of being lost.
    const patient = await patientRepo.update(req.params.id, () => patch);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // Sync user name/phone if changed
    await syncUserNamePhone(patient.user, { name: data.name, phone: data.phone });

    await logAudit({
      user: req.user,
      action: 'PATIENT_UPDATED',
      entity: 'Patient',
      entityId: patient._id,
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
    // As before, only the patient profile is deleted (user account and history stay).
    // The patient counter is decremented in the same transaction.
    const patient = await patientRepo.remove(req.params.id, {
      extra: [statsAdd(STATS.totals, { patients: -1 })],
    });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    await logAudit({
      user: req.user,
      action: 'PATIENT_DELETED',
      entity: 'Patient',
      entityId: patient._id,
      description: `Patient ${patient.patientId} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const newestFirst = (field: string) => (a: any, b: any) => String(b[field]).localeCompare(String(a[field]));

export const getPatientTimeline = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patientId = req.params.id;
    const patient = await patientRepo.get(patientId);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // One Query on GSI2 (PATIENT#<id>) returns this patient's appointments,
    // medical records, lab reports, prescriptions and bills. The set is bounded
    // by a single patient, so reading all of it is fine. Bills were not part of
    // the original timeline and are skipped.
    const items = await queryAll({ index: 'GSI2', pk: patientPartition(patientId) });
    const ofType = (type: string) => items.filter((i) => i.entityType === type);

    const appointments: any[] = ofType('APPT').map((i) => appointmentRepo.toPublic(appointmentRepo.fromItem(i))).sort(newestFirst('date'));
    const medicalRecords: any[] = ofType('EMR').map((i) => medicalRecordRepo.fromItem(i)).sort(newestFirst('createdAt'));
    const labReports: any[] = ofType('LAB').map((i) => labReportRepo.fromItem(i)).sort(newestFirst('createdAt'));
    const prescriptions: any[] = ofType('RX').map((i) => prescriptionRepo.fromItem(i)).sort(newestFirst('date'));

    await Promise.all([
      populate(appointments, 'doctor', doctorRepo, ['name', 'specialization']),
      populate(medicalRecords, 'doctor', doctorRepo, ['name', 'specialization']),
      populate(labReports, 'doctor', doctorRepo, ['name']),
      populate(labReports, 'labTest', labTestRepo, ['name', 'category']),
      populate(prescriptions, 'doctor', doctorRepo, ['name']),
    ]);

    const timeline = [
      ...appointments.map((a) => ({ type: 'appointment', date: a.date, data: a })),
      ...medicalRecords.map((m) => ({ type: 'medical_record', date: m.createdAt, data: m })),
      ...labReports.map((l) => ({ type: 'lab_report', date: l.createdAt, data: l })),
      ...prescriptions.map((p) => ({ type: 'prescription', date: p.date, data: p })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json({
      success: true,
      data: {
        patient,
        timeline,
      },
    });
  } catch (error) {
    next(error);
  }
};
