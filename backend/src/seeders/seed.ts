import dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  appointmentRepo,
  bedRepo,
  billRepo,
  departmentRepo,
  doctorRepo,
  inventoryTransactionRepo,
  labReportRepo,
  labTestRepo,
  medicalRecordRepo,
  medicineRepo,
  notificationRepo,
  patientRepo,
  prescriptionRepo,
  roomRepo,
} from '../repositories';
import { createUserAccount, findUserByEmail } from '../repositories/userAccounts';
import { nowIso, transactWrite, tx, TxOp } from '../db/dynamo';
import { claimUnique, slotLockKey, STATS, statsAdd } from '../db/keys';
import { env } from '../config/env';
import { logAudit } from '../utils/auditLogger';
import { localDayKey } from '../utils/dates';
import {
  newAppointmentId,
  newBillId,
  newDoctorId,
  newLabReportId,
  newMedicineId,
  newPatientId,
  newPrescriptionId,
  newRecordId,
  nextQueueNumber,
} from '../utils/ids';
import type {
  AppointmentStatus,
  IAppointment,
  IBed,
  IBill,
  IDoctor,
  IMedicine,
  IPatient,
  IUser,
  UserRole,
} from '../types/entities';

// Demo data seeder for DynamoDB.
//
// Every record is written the same way the controllers write it, so all the
// helper items stay consistent: uniqueness guards (emails, department names and
// codes, room/bed numbers, lab test codes), appointment slot locks, the STATS
// aggregate items (patients, appointments, appointments per department,
// billing totals) and the audit counters.
//
// DynamoDB has no cheap "delete everything", so instead of clearing the table
// the seeder refuses to run when the demo data is already there.

export const DEMO_ADMIN_EMAIL = 'admin@smarthospital.org';
export const DEMO_PASSWORD = 'password123';

const DAY = 86400000;
const HOUR = 3600000;

// Thrown when the seeder must not run (already seeded / production).
export class SeedRefusedError extends Error {}

// ---------- small helpers ----------

// Creates a user (with its email guard). `profileOps` can create the
// patient/doctor profile in the same transaction, like registration does.
const makeUser = (
  hashedPassword: string,
  data: { name: string; email: string; role: UserRole; phone: string },
  profileOps: TxOp[] = []
): Promise<IUser> => createUserAccount({ ...data, password: hashedPassword }, profileOps);

const SLOT_TAKEN = 'This time slot is already booked. Please choose a different time.';

// Appointment + slot lock + statistics in one transaction (same as createAppointment).
const createAppointment = async (data: {
  patient: IPatient;
  doctor: IDoctor;
  department: string;
  date: Date;
  timeSlot: string;
  status: AppointmentStatus;
  symptoms: string;
  notes?: string;
}): Promise<IAppointment> => {
  const dayKey = localDayKey(data.date);
  const [appointmentId, queueNumber] = await Promise.all([newAppointmentId(), nextQueueNumber(data.doctor._id, dayKey)]);
  const lock = slotLockKey(data.doctor._id, dayKey, data.timeSlot);
  const { entity, ops } = appointmentRepo.prepareCreate({
    appointmentId,
    patient: data.patient._id,
    doctor: data.doctor._id,
    department: data.department,
    date: data.date.toISOString(),
    timeSlot: data.timeSlot,
    symptoms: data.symptoms,
    status: data.status,
    type: 'in_person',
    notes: data.notes ?? '',
    queueNumber,
    slotLock: lock.PK, // all seeded appointments are in an active status, so they hold their slot
  });
  await transactWrite([
    ...ops,
    tx.putUnique({ ...lock, entityType: 'SLOT', appointmentId: entity._id }, SLOT_TAKEN),
    statsAdd(STATS.totals, { appointments: 1 }),
    statsAdd(STATS.appointmentsByDepartment(entity.department), { count: 1 }),
  ]);
  return entity;
};

// Medicine status rule from createMedicine.
const medicineStatus = (m: { expiryDate: string; quantity: number; minStockLevel: number }): IMedicine['status'] => {
  if (new Date(m.expiryDate) < new Date()) return 'expired';
  if (m.quantity === 0) return 'out_of_stock';
  if (m.quantity <= m.minStockLevel) return 'low_stock';
  return 'in_stock';
};

// Bill + billing statistics in one transaction. Attribute names of STATS.billing
// (same as billingController.ts): totalBilled (sum of totalAmount), totalPaid
// (sum of paidAmount), totalBalance (sum of balance), count (number of bills),
// count_<status> (number of bills per status).
const createBill = async (data: Omit<IBill, '_id' | 'createdAt' | 'updatedAt' | 'billId'>): Promise<IBill> => {
  const { entity, ops } = billRepo.prepareCreate({ ...data, billId: await newBillId() });
  await transactWrite([
    ...ops,
    statsAdd(STATS.billing, {
      totalBilled: entity.totalAmount,
      totalPaid: entity.paidAmount,
      totalBalance: entity.balance,
      count: 1,
      [`count_${entity.status}`]: 1,
    }),
  ]);
  return entity;
};

// ---------- the seeder ----------

export const seed = async (): Promise<void> => {
  if (env.nodeEnv() === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'yes') {
    throw new SeedRefusedError(
      'NODE_ENV=production: refusing to seed demo data. Set SEED_ALLOW_PRODUCTION=yes to override.'
    );
  }

  // One GetItem on the email guard tells us whether the demo data already exists.
  if (await findUserByEmail(DEMO_ADMIN_EMAIL)) {
    throw new SeedRefusedError(
      `Demo data already present in table "${env.tableName()}" (${DEMO_ADMIN_EMAIL} exists).\n` +
        '   DynamoDB cannot cheaply clear a table, so to re-seed either:\n' +
        '   - delete the table and recreate it (npx ts-node --transpile-only src/scripts/createTable.ts), or\n' +
        '   - set DYNAMODB_TABLE_NAME to a fresh table name, create it, and seed again.'
    );
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 1. Users. Admin first: if a later step fails, the next run refuses with
  // the reset instructions above instead of failing on a half-seeded table.
  // Doctor and patient accounts are created together with their profiles
  // (steps 3 and 4), the staff accounts after them, i.e. in the original order.
  const adminUser = await makeUser(hashedPassword, { name: 'Dr. Arthur Pendelton', email: DEMO_ADMIN_EMAIL, role: 'hospital_admin', phone: '+1 555-010-9000' });

  // 2. Departments (name and code guards in the same transaction).
  const createDepartment = (name: string, code: string, description: string, icon: string) => {
    const { entity, ops } = departmentRepo.prepareCreate({ name, code: code.toUpperCase(), description, icon, status: 'active' });
    return transactWrite([
      ...ops,
      claimUnique('DEPTNAME', name, entity._id, 'Department name already exists'),
      claimUnique('DEPTCODE', entity.code, entity._id, 'Department code already exists'),
    ]).then(() => entity);
  };
  const deptCardiology = await createDepartment('Cardiology', 'CARD', 'Comprehensive cardiovascular diagnosis, intervention, and outpatient care.', 'Heart');
  const deptNeurology = await createDepartment('Neurology', 'NEUR', 'Brain, spinal cord, and peripheral nerve disorders.', 'Brain');
  await createDepartment('Orthopedics', 'ORTH', 'Joint replacement, trauma, and musculoskeletal care.', 'Bone');
  await createDepartment('Pediatrics', 'PED', 'Child health, immunization, and neonatal intensive care.', 'Baby');
  console.log('🏥 Seeded 4 Clinical Departments.\n');

  // 3. Doctors: user account + doctor profile in one transaction.
  const createDoctorAccount = async (
    user: { name: string; email: string; phone: string },
    profile: Omit<IDoctor, '_id' | 'createdAt' | 'updatedAt' | 'doctorId' | 'user' | 'name' | 'email' | 'phone' | 'rating' | 'profileImage' | 'status'>
  ) => {
    // The user id is chosen up front so the profile can reference it in the same transaction.
    const userId = randomUUID();
    const { entity: doctor, ops } = doctorRepo.prepareCreate({
      ...profile,
      doctorId: await newDoctorId(),
      user: userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      rating: 4.8,
      profileImage: '',
      status: 'active',
    });
    const account = await createUserAccount({ _id: userId, ...user, role: 'doctor', password: hashedPassword }, ops);
    return { user: account, doctor };
  };

  const { user: doctor1User, doctor: doc1 } = await createDoctorAccount(
    { name: 'Dr. Eleanor Vance', email: 'doctor@smarthospital.org', phone: '+1 555-010-9001' },
    {
      specialization: 'Interventional Cardiology',
      department: deptCardiology._id,
      qualification: 'MD, FACC, Harvard Medical School',
      experienceYears: 15,
      consultationFee: 150,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTimeSlots: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '17:00' }],
      roomNumber: 'R-301',
      bio: 'Leading cardiologist specializing in angioplasty, heart failure, and preventive cardiology.',
    }
  );
  const { doctor: doc2 } = await createDoctorAccount(
    { name: 'Dr. Marcus Brody', email: 'brody@smarthospital.org', phone: '+1 555-010-9011' },
    {
      specialization: 'Clinical Neurology',
      department: deptNeurology._id,
      qualification: 'MD, PhD, Johns Hopkins Medicine',
      experienceYears: 12,
      consultationFee: 140,
      availableDays: ['Monday', 'Wednesday', 'Thursday', 'Saturday'],
      availableTimeSlots: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '18:00' }],
      roomNumber: 'R-305',
      bio: 'Expert in migraine syndromes, neurodegenerative conditions, and epilepsy management.',
    }
  );
  console.log('🩺 Seeded Doctors.\n');

  // 4. Patients: user account + patient profile + STATS.totals.patients in one transaction.
  const createPatientAccount = async (
    user: { name: string; email: string; phone: string },
    profile: Omit<IPatient, '_id' | 'createdAt' | 'updatedAt' | 'patientId' | 'user' | 'name' | 'email' | 'phone' | 'profileImage'>
  ) => {
    const userId = randomUUID();
    const { entity: patient, ops } = patientRepo.prepareCreate({
      ...profile,
      patientId: await newPatientId(),
      user: userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: '',
    });
    const account = await createUserAccount(
      { _id: userId, ...user, role: 'patient', password: hashedPassword },
      [...ops, statsAdd(STATS.totals, { patients: 1 })]
    );
    return { user: account, patient };
  };

  const { user: patient1User, patient: pat1 } = await createPatientAccount(
    { name: 'Robert Chen', email: 'patient@smarthospital.org', phone: '+1 555-010-9002' },
    {
      dob: new Date('1981-06-15').toISOString(),
      gender: 'male',
      bloodGroup: 'O+',
      address: '104 Medical Plaza, New York, NY',
      emergencyContact: { name: 'Helen Chen', relationship: 'Spouse', phone: '+1 555-019-8811' },
      insuranceProvider: 'BlueCross HealthCare',
      insurancePolicyNumber: 'BC-984421-NY',
      allergies: ['Penicillin'],
      medicalHistory: ['Hypertension', 'Mild Angina'],
    }
  );
  const { patient: pat2 } = await createPatientAccount(
    { name: 'Maria Santos', email: 'maria@smarthospital.org', phone: '+1 555-010-9012' },
    {
      dob: new Date('1990-03-22').toISOString(),
      gender: 'female',
      bloodGroup: 'A+',
      address: '742 Evergreen Terrace, Brooklyn, NY',
      emergencyContact: { name: 'Carlos Santos', relationship: 'Brother', phone: '+1 555-019-4455' },
      insuranceProvider: 'Aetna Medicare',
      insurancePolicyNumber: 'AET-772911',
      allergies: ['Aspirin', 'Sulfa'],
      medicalHistory: ['Migraine with Aura'],
    }
  );
  const { patient: pat3 } = await createPatientAccount(
    { name: 'David Kim', email: 'david@smarthospital.org', phone: '+1 555-010-9013' },
    {
      dob: new Date('1975-11-08').toISOString(),
      gender: 'male',
      bloodGroup: 'B+',
      address: '88 Queen St, Manhattan, NY',
      emergencyContact: { name: 'Grace Kim', relationship: 'Spouse', phone: '+1 555-019-2233' },
      insuranceProvider: 'UnitedHealth',
      insurancePolicyNumber: 'UH-109923',
      allergies: [],
      medicalHistory: ['Type 2 Diabetes', 'Hyperlipidemia'],
    }
  );
  // Staff accounts (no profile item).
  await makeUser(hashedPassword, { name: 'Sarah Connor', email: 'reception@smarthospital.org', role: 'receptionist', phone: '+1 555-010-9003' });
  const labUser = await makeUser(hashedPassword, { name: 'Michael Faraday', email: 'lab@smarthospital.org', role: 'lab_staff', phone: '+1 555-010-9004' });
  const pharmacyUser = await makeUser(hashedPassword, { name: 'Alexander Fleming', email: 'pharmacy@smarthospital.org', role: 'pharmacist', phone: '+1 555-010-9005' });
  await makeUser(hashedPassword, { name: 'Emma Watson', email: 'nurse@smarthospital.org', role: 'nurse', phone: '+1 555-010-9006' });
  console.log('👥 Created 10 demo user accounts (including Nurse and Multiple Doctors/Patients).\n');
  console.log('🧑‍⚕️ Seeded Patients.\n');

  // 5. Appointments (queue numbers come from the per-doctor/day counter).
  const today = new Date();
  const appt1 = await createAppointment({
    patient: pat1, doctor: doc1, department: deptCardiology._id, date: today, timeSlot: '09:30',
    status: 'in_consultation',
    symptoms: 'Recurring chest discomfort and mild palpitation after exertion',
    notes: 'Follow-up on previous blood pressure medication',
  });
  await createAppointment({
    patient: pat2, doctor: doc2, department: deptNeurology._id, date: today, timeSlot: '11:00',
    status: 'checked_in',
    symptoms: 'Severe throbbing left-side migraine with photophobia',
  });
  await createAppointment({
    patient: pat3, doctor: doc1, department: deptCardiology._id, date: new Date(Date.now() + DAY), timeSlot: '10:00',
    status: 'confirmed',
    symptoms: 'Routine lipid profile review and cardiac checkup',
  });
  console.log('📅 Seeded Appointments.\n');

  // 6. Medical record & prescription.
  const medRec1 = await medicalRecordRepo.create({
    recordId: await newRecordId(),
    patient: pat1._id,
    doctor: doc1._id,
    appointment: appt1._id,
    date: nowIso(),
    symptoms: 'Substernal tightness and fatigue after moderate cardiovascular workload.',
    diagnosis: 'Stage 1 Essential Hypertension with mild Angina Pectoris',
    clinicalNotes: 'ECG shows normal sinus rhythm. Advised sodium restriction and regular aerobic walking.',
    vitals: { bloodPressure: '138/88', heartRate: 76, temperature: 98.4, oxygenSaturation: 98, weight: 78, height: 175 },
    attachments: [],
    followUpDate: new Date(Date.now() + 14 * DAY).toISOString(),
  });

  await prescriptionRepo.create({
    prescriptionId: await newPrescriptionId(),
    patient: pat1._id,
    doctor: doc1._id,
    medicalRecord: medRec1._id,
    date: nowIso(),
    medicines: [
      { medicineName: 'Atorvastatin 20mg', dosage: '20mg', frequency: 'Once daily at bedtime', duration: '30 days', instructions: 'Take after dinner with water' },
      { medicineName: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily morning', duration: '30 days', instructions: 'Take with breakfast' },
    ],
    status: 'active',
    notes: 'Monitor morning blood pressure daily and record in CloudCare app',
  });
  console.log('📑 Seeded Medical Records & Prescriptions.\n');

  // 7. Lab tests (test code guard) & reports.
  const createLabTest = (data: { testCode: string; name: string; category: string; price: number; description: string; normalRange: string; turnaroundHours: number }) => {
    const { entity, ops } = labTestRepo.prepareCreate({ ...data, testCode: data.testCode.toUpperCase() });
    return transactWrite([...ops, claimUnique('LABTEST', entity.testCode, entity._id, 'Lab test code already exists')]).then(() => entity);
  };
  const ltCbc = await createLabTest({
    testCode: 'LT-CBC', name: 'Complete Blood Count (CBC)', category: 'Hematology', price: 35.0,
    description: 'Comprehensive screening for anemia, infection, and platelets.',
    normalRange: 'WBC: 4.5-11.0 K/uL, RBC: 4.3-5.9 M/uL, Platelets: 150-450 K/uL', turnaroundHours: 12,
  });
  const ltLipid = await createLabTest({
    testCode: 'LT-LIPID', name: 'Complete Lipid Profile', category: 'Biochemistry', price: 65.0,
    description: 'Total cholesterol, HDL, LDL, and Triglycerides profile.',
    normalRange: 'Cholesterol < 200 mg/dL, Triglycerides < 150 mg/dL, LDL < 100 mg/dL', turnaroundHours: 24,
  });
  await createLabTest({
    testCode: 'LT-HBA1C', name: 'Hemoglobin A1c (HbA1c)', category: 'Endocrinology', price: 45.0,
    description: 'Average blood glucose level over the past 3 months.',
    normalRange: 'Normal: < 5.7%, Pre-diabetic: 5.7-6.4%, Diabetic: >= 6.5%', turnaroundHours: 8,
  });

  await labReportRepo.create({
    reportId: await newLabReportId(),
    patient: pat1._id,
    doctor: doc1._id,
    labTest: ltLipid._id,
    requestedDate: nowIso(),
    status: 'completed',
    results: [
      { parameter: 'Total Cholesterol', result: '228', unit: 'mg/dL', normalRange: '< 200', isAbnormal: true },
      { parameter: 'HDL (Good Cholesterol)', result: '46', unit: 'mg/dL', normalRange: '> 40', isAbnormal: false },
      { parameter: 'LDL (Bad Cholesterol)', result: '148', unit: 'mg/dL', normalRange: '< 100', isAbnormal: true },
      { parameter: 'Triglycerides', result: '170', unit: 'mg/dL', normalRange: '< 150', isAbnormal: true },
    ],
    reportFile: '',
    performedBy: labUser._id,
    notes: 'Elevated LDL and Total Cholesterol noted. Lipid-lowering therapy recommended.',
  });
  await labReportRepo.create({
    reportId: await newLabReportId(),
    patient: pat2._id,
    doctor: doc2._id,
    labTest: ltCbc._id,
    requestedDate: nowIso(),
    status: 'processing',
    results: [],
    reportFile: '',
    notes: 'Sample collected, awaiting automated analyzer report.',
  });
  console.log('🔬 Seeded Lab Tests & Lab Reports.\n');

  // 8. Rooms & beds (room number / bed number guards).
  const createRoom = (roomNumber: string, building: string, floor: string, roomType: 'general' | 'private' | 'icu', ratePerDay: number) => {
    const { entity, ops } = roomRepo.prepareCreate({ roomNumber, building, floor, roomType, ratePerDay });
    return transactWrite([...ops, claimUnique('ROOM', roomNumber, entity._id, 'Room number already exists')]).then(() => entity);
  };
  const createBed = (data: Omit<IBed, '_id' | 'createdAt' | 'updatedAt'>) => {
    const { entity, ops } = bedRepo.prepareCreate(data);
    return transactWrite([...ops, claimUnique('BED', data.bedNumber, entity._id, 'Bed number already exists')]).then(() => entity);
  };
  const rICU = await createRoom('ICU-101', 'Wing A', 'Floor 1', 'icu', 500);
  const rGen = await createRoom('WARD-204', 'Wing B', 'Floor 2', 'general', 120);
  const rPriv = await createRoom('PVT-302', 'Wing C', 'Floor 3', 'private', 300);

  await createBed({ bedNumber: 'ICU-101-A', room: rICU._id, status: 'occupied', currentPatient: pat1._id, assignedDate: new Date(Date.now() - 36 * HOUR).toISOString() });
  await createBed({ bedNumber: 'ICU-101-B', room: rICU._id, status: 'available' });
  await createBed({ bedNumber: 'WARD-204-1', room: rGen._id, status: 'available' });
  await createBed({ bedNumber: 'WARD-204-2', room: rGen._id, status: 'occupied', currentPatient: pat3._id, assignedDate: new Date(Date.now() - 24 * HOUR).toISOString() });
  await createBed({ bedNumber: 'PVT-302-A', room: rPriv._id, status: 'available' });
  console.log('🛏️ Seeded Rooms and Beds.\n');

  // 9. Medicines, each with its initial stock_in ledger entry (as createMedicine does).
  const medicines = [
    { name: 'Amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotic', manufacturer: 'Pfizer', batchNumber: 'BTH-A001', expiryDate: '2027-12-31', quantity: 15, unitPrice: 12.5, minStockLevel: 25, location: 'Shelf A', dailyAvgUsage: 5 },
    { name: 'Paracetamol 650mg', genericName: 'Acetaminophen', category: 'Analgesic', manufacturer: 'GSK', batchNumber: 'BTH-P002', expiryDate: '2028-06-30', quantity: 450, unitPrice: 4.0, minStockLevel: 100, location: 'Shelf B', dailyAvgUsage: 20 },
    { name: 'Atorvastatin 20mg', genericName: 'Atorvastatin', category: 'Cardiovascular', manufacturer: 'Novartis', batchNumber: 'BTH-AT03', expiryDate: '2027-09-15', quantity: 18, unitPrice: 24.0, minStockLevel: 30, location: 'Shelf C', dailyAvgUsage: 4 },
    { name: 'Metformin 500mg', genericName: 'Metformin', category: 'Diabetes', manufacturer: 'Merck', batchNumber: 'BTH-M004', expiryDate: '2028-03-20', quantity: 220, unitPrice: 8.5, minStockLevel: 80, location: 'Shelf A', dailyAvgUsage: 12 },
    { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Gastrointestinal', manufacturer: 'AstraZeneca', batchNumber: 'BTH-O005', expiryDate: '2027-11-10', quantity: 8, unitPrice: 15.0, minStockLevel: 20, location: 'Shelf D', dailyAvgUsage: 3 },
    { name: 'Insulin Glargine 100IU', genericName: 'Insulin Glargine', category: 'Diabetes', manufacturer: 'Sanofi', batchNumber: 'BTH-INS06', expiryDate: '2026-11-30', quantity: 5, unitPrice: 45.0, minStockLevel: 15, location: 'Refrigerated Bay 1', dailyAvgUsage: 2 },
  ];
  for (const m of medicines) {
    const expiryDate = new Date(m.expiryDate).toISOString();
    const { entity: medicine, ops } = medicineRepo.prepareCreate({
      ...m,
      medicineId: await newMedicineId(),
      expiryDate,
      status: medicineStatus({ ...m, expiryDate }),
    });
    const ledger = m.quantity > 0
      ? inventoryTransactionRepo.prepareCreate({
          medicine: medicine._id,
          type: 'stock_in',
          quantity: m.quantity,
          reason: 'Initial stock entry',
          performedBy: pharmacyUser._id,
          timestamp: nowIso(),
        }).ops
      : [];
    await transactWrite([...ops, ...ledger]);
  }
  console.log('💊 Seeded Pharmacy Catalog.\n');

  // 10. Bills (with the billing aggregate).
  await createBill({
    patient: pat1._id,
    items: [
      { description: 'Cardiology Specialist Consultation', category: 'consultation', amount: 150, quantity: 1 },
      { description: 'Complete Lipid Profile Panel', category: 'laboratory', amount: 65, quantity: 1 },
      { description: 'Atorvastatin 20mg (30 Tablets)', category: 'medicine', amount: 24, quantity: 1 },
    ],
    subtotal: 239, discount: 20, tax: 15, totalAmount: 234, paidAmount: 234, balance: 0,
    status: 'paid',
    dueDate: new Date(Date.now() + 7 * DAY).toISOString(),
    invoiceDate: nowIso(),
  });
  await createBill({
    patient: pat2._id,
    items: [
      { description: 'Neurology Consultation', category: 'consultation', amount: 140, quantity: 1 },
      { description: 'Complete Blood Count (CBC)', category: 'laboratory', amount: 35, quantity: 1 },
    ],
    subtotal: 175, discount: 0, tax: 10, totalAmount: 185, paidAmount: 0, balance: 185,
    status: 'pending',
    dueDate: new Date(Date.now() + 10 * DAY).toISOString(),
    invoiceDate: nowIso(),
  });
  console.log('💳 Seeded Invoices & Billing.\n');

  // 11. Notifications (read ones are left out of the sparse "unread" index automatically).
  await notificationRepo.create({ recipient: patient1User._id, title: 'Lab Report Ready', message: 'Your Complete Lipid Profile test result is now available for review.', type: 'lab', read: false, link: '' });
  await notificationRepo.create({ recipient: doctor1User._id, title: 'New Appointment Scheduled', message: 'Robert Chen booked an appointment for Cardiology at 09:30 AM.', type: 'appointment', read: true, link: '' });
  await notificationRepo.create({ recipient: adminUser._id, title: 'Low Stock Alert', message: 'Omeprazole 20mg inventory has dropped to 8 units (Threshold: 20).', type: 'stock', read: false, link: '' });
  console.log('🔔 Seeded Notifications.\n');

  // 12. Audit log (logAudit also bumps the per-action / per-entity counters).
  await logAudit(adminUser._id, adminUser.name, adminUser.role, 'SYSTEM_BOOT', 'System', '', 'Hospital SaaS platform database initialized with baseline datasets.');
  console.log('🛡️ Seeded Audit Logs.\n');
};

const printCredentials = () => {
  console.log('======================================================');
  console.log('✅ COMPLETE COMPREHENSIVE SEEDING SUCCEEDED!');
  console.log('');
  console.log(` 🔑 Demo Credentials (Password for all: ${DEMO_PASSWORD})`);
  console.log(' ➤ Admin:       admin@smarthospital.org');
  console.log(' ➤ Doctor:      doctor@smarthospital.org');
  console.log(' ➤ Doctor 2:    brody@smarthospital.org');
  console.log(' ➤ Patient:     patient@smarthospital.org');
  console.log(' ➤ Patient 2:   maria@smarthospital.org');
  console.log(' ➤ Patient 3:   david@smarthospital.org');
  console.log(' ➤ Reception:   reception@smarthospital.org');
  console.log(' ➤ Lab:         lab@smarthospital.org');
  console.log(' ➤ Pharmacy:    pharmacy@smarthospital.org');
  console.log(' ➤ Nurse:       nurse@smarthospital.org');
  console.log('======================================================\n');
};

// CLI entry point: `npm run seed` (only when this file is run directly, not imported by tests).
if (require.main === module) {
  console.log(`🔌 Seeding DynamoDB table "${env.tableName()}"${env.dynamoEndpoint() ? ` at ${env.dynamoEndpoint()}` : ''}...\n`);
  seed()
    .then(() => {
      printCredentials();
      process.exit(0);
    })
    .catch((error: any) => {
      if (error instanceof SeedRefusedError) {
        console.error('⛔ ' + error.message);
      } else {
        console.error('❌ Seeding error:', error.message);
        console.error(error.stack);
      }
      process.exit(1);
    });
}
