import { Repository } from '../db/repository';
import { exactTokens, wordTokens } from '../db/search';
import { doctorPartition, patientPartition, typePartition, userPartition } from '../db/keys';
import type {
  IAppointment,
  IAuditLog,
  IBed,
  IBill,
  IDepartment,
  IDoctor,
  IInventoryTransaction,
  ILabReport,
  ILabTest,
  IMedicalRecord,
  IMedicine,
  INotification,
  IPatient,
  IPrescription,
  IRoom,
  IUser,
} from '../types/entities';

// One repository per entity. Each `indexKeys` function documents which
// queries the entity supports:
//   GSI1  list all of this type, sorted (TYPE#<type>)
//   GSI2  by patient / parent (PATIENT#, DEPT#, ROOM#, MED#, USER#)
//   GSI3  by doctor, user-profile link, unread notifications
// Sort keys end with the _id so equal timestamps/names never collide.

const lower = (s: string | undefined) => (s ?? '').toLowerCase();

export const userRepo = new Repository<IUser>({
  type: 'USER',
  indexKeys: (u) => ({ GSI1PK: typePartition('USER'), GSI1SK: `${u.createdAt}#${u._id}` }),
  hiddenFields: ['password'],
});

export const patientRepo = new Repository<IPatient>({
  type: 'PATIENT',
  indexKeys: (p) => ({
    GSI1PK: typePartition('PATIENT'), GSI1SK: `${p.createdAt}#${p._id}`, // newest/oldest patients
    GSI3PK: userPartition(p.user), GSI3SK: 'PROFILE#PATIENT', // patient profile of a user
  }),
  searchTokens: (p) => [...wordTokens(p.name), ...exactTokens(p.patientId, p.email, p.phone, p.phone?.replace(/\D/g, ''))],
});

export const doctorRepo = new Repository<IDoctor>({
  type: 'DOCTOR',
  indexKeys: (d) => ({
    GSI1PK: typePartition('DOCTOR'), GSI1SK: `${d.createdAt}#${d._id}`,
    GSI2PK: `DEPT#${d.department}`, GSI2SK: `DOCTOR#${d.createdAt}#${d._id}`, // doctors of a department
    GSI3PK: userPartition(d.user), GSI3SK: 'PROFILE#DOCTOR', // doctor profile of a user
  }),
  searchTokens: (d) => [...wordTokens(d.name, d.specialization), ...exactTokens(d.doctorId)],
});

export const departmentRepo = new Repository<IDepartment>({
  type: 'DEPT',
  indexKeys: (d) => ({ GSI1PK: typePartition('DEPT'), GSI1SK: `${lower(d.name)}#${d._id}` }), // sorted by name
});

export const appointmentRepo = new Repository<IAppointment>({
  type: 'APPT',
  indexKeys: (a) => ({
    GSI1PK: typePartition('APPT'), GSI1SK: `${a.date}#${a._id}`, // hospital-wide by date (today's queue, ranges)
    GSI2PK: patientPartition(a.patient), GSI2SK: `APPT#${a.date}#${a._id}`, // a patient's appointments
    GSI3PK: doctorPartition(a.doctor), GSI3SK: `APPT#${a.date}#${a._id}`, // a doctor's appointments
  }),
  searchTokens: (a) => exactTokens(a.appointmentId),
  hiddenFields: ['slotLock'],
});

export const medicalRecordRepo = new Repository<IMedicalRecord>({
  type: 'EMR',
  indexKeys: (r) => ({
    GSI1PK: typePartition('EMR'), GSI1SK: `${r.date}#${r._id}`,
    GSI2PK: patientPartition(r.patient), GSI2SK: `EMR#${r.date}#${r._id}`,
    GSI3PK: doctorPartition(r.doctor), GSI3SK: `EMR#${r.date}#${r._id}`,
  }),
});

export const prescriptionRepo = new Repository<IPrescription>({
  type: 'RX',
  indexKeys: (p) => ({
    GSI1PK: typePartition('RX'), GSI1SK: `${p.date}#${p._id}`,
    GSI2PK: patientPartition(p.patient), GSI2SK: `RX#${p.date}#${p._id}`,
    GSI3PK: doctorPartition(p.doctor), GSI3SK: `RX#${p.date}#${p._id}`,
  }),
});

export const medicineRepo = new Repository<IMedicine>({
  type: 'MED',
  indexKeys: (m) => ({ GSI1PK: typePartition('MED'), GSI1SK: `${lower(m.name)}#${m._id}` }), // sorted by name
});

export const inventoryTransactionRepo = new Repository<IInventoryTransaction>({
  type: 'INVTX',
  indexKeys: (t) => ({
    GSI1PK: typePartition('INVTX'), GSI1SK: `${t.timestamp}#${t._id}`,
    GSI2PK: `MED#${t.medicine}`, GSI2SK: `INVTX#${t.timestamp}#${t._id}`, // ledger of one medicine
  }),
});

export const labTestRepo = new Repository<ILabTest>({
  type: 'LABTEST',
  indexKeys: (t) => ({ GSI1PK: typePartition('LABTEST'), GSI1SK: `${lower(t.category)}#${lower(t.name)}#${t._id}` }),
});

export const labReportRepo = new Repository<ILabReport>({
  type: 'LAB',
  indexKeys: (r) => ({
    GSI1PK: typePartition('LAB'), GSI1SK: `${r.createdAt}#${r._id}`,
    GSI2PK: patientPartition(r.patient), GSI2SK: `LAB#${r.createdAt}#${r._id}`,
    GSI3PK: doctorPartition(r.doctor), GSI3SK: `LAB#${r.createdAt}#${r._id}`,
  }),
});

export const roomRepo = new Repository<IRoom>({
  type: 'ROOM',
  indexKeys: (r) => ({ GSI1PK: typePartition('ROOM'), GSI1SK: `${r.building}#${r.floor}#${r.roomNumber}#${r._id}` }),
});

export const bedRepo = new Repository<IBed>({
  type: 'BED',
  indexKeys: (b) => ({
    GSI1PK: typePartition('BED'), GSI1SK: `${b.bedNumber}#${b._id}`,
    GSI2PK: `ROOM#${b.room}`, GSI2SK: `BED#${b.bedNumber}#${b._id}`, // beds of a room
  }),
});

export const billRepo = new Repository<IBill>({
  type: 'BILL',
  indexKeys: (b) => ({
    GSI1PK: typePartition('BILL'), GSI1SK: `${b.createdAt}#${b._id}`,
    GSI2PK: patientPartition(b.patient), GSI2SK: `BILL#${b.createdAt}#${b._id}`,
  }),
  searchTokens: (b) => exactTokens(b.billId),
});

export const notificationRepo = new Repository<INotification>({
  type: 'NOTIF',
  indexKeys: (n) => ({
    GSI2PK: userPartition(n.recipient), GSI2SK: `NOTIF#${n.createdAt}#${n._id}`, // a user's notifications
    // Sparse index: only unread notifications have GSI3 keys, so the unread
    // list/count is a small Query and marking as read removes the entry.
    GSI3PK: n.read ? undefined : `UNREAD#${n.recipient}`,
    GSI3SK: n.read ? undefined : `${n.createdAt}#${n._id}`,
  }),
});

export const auditLogRepo = new Repository<IAuditLog>({
  type: 'AUDIT',
  indexKeys: (l) => ({ GSI1PK: typePartition('AUDIT'), GSI1SK: `${l.timestamp}#${l._id}` }), // by time
});
