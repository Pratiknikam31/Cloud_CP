import { tx, TxOp } from './dynamo';

// Keys for the non-entity helper items stored in the same table.

// ---- Uniqueness guards ----
// DynamoDB has no unique indexes. To keep e.g. an email unique we write a guard
// item whose key is the value itself, with attribute_not_exists, in the same
// transaction as the entity. A second request with the same value fails.
export type UniqueKind = 'EMAIL' | 'DEPTNAME' | 'DEPTCODE' | 'ROOM' | 'BED' | 'LABTEST';

export const uniqueKey = (kind: UniqueKind, value: string) => ({
  PK: `UNIQUE#${kind}#${value.trim().toLowerCase()}`,
  SK: 'UNIQUE',
});

export const claimUnique = (kind: UniqueKind, value: string, ownerId: string, conflictMessage: string): TxOp =>
  tx.putUnique({ ...uniqueKey(kind, value), entityType: 'UNIQUE', ownerId }, conflictMessage);

export const releaseUnique = (kind: UniqueKind, value: string): TxOp => {
  const k = uniqueKey(kind, value);
  return tx.delete(k.PK, k.SK);
};

// Changes a unique value (e.g. department rename): release old, claim new.
export const changeUnique = (kind: UniqueKind, oldValue: string, newValue: string, ownerId: string, conflictMessage: string): TxOp[] =>
  oldValue.trim().toLowerCase() === newValue.trim().toLowerCase()
    ? []
    : [releaseUnique(kind, oldValue), claimUnique(kind, newValue, ownerId, conflictMessage)];

// ---- Appointment slot locks ----
// One item per (doctor, day, time slot) while an active appointment holds it.
export const slotLockKey = (doctorId: string, dayKey: string, timeSlot: string) => ({
  PK: `SLOT#${doctorId}#${dayKey}#${timeSlot}`,
  SK: 'SLOT',
});

// One item per (patient, day, time slot) while an active appointment holds it.
export const patientSlotLockKey = (patientId: string, dayKey: string, timeSlot: string) => ({
  PK: `PATIENT_SLOT#${patientId}#${dayKey}#${timeSlot}`,
  SK: 'SLOT',
});

// ---- Aggregate / statistics items (maintained with atomic ADD) ----
export const STATS = {
  totals: { PK: 'STATS#TOTALS', SK: 'TOTALS' }, // patients, appointments
  billing: { PK: 'STATS#BILLING', SK: 'BILLING' }, // totalBilled, totalPaid, totalBalance, count, count_<status>
  auditAction: (action: string) => ({ PK: 'STATS#AUDIT_ACTION', SK: action }),
  auditEntity: (entity: string) => ({ PK: 'STATS#AUDIT_ENTITY', SK: entity }),
  appointmentsByDepartment: (departmentId: string) => ({ PK: 'STATS#APPT_DEPT', SK: departmentId }),
};

export const statsAdd = (key: { PK: string; SK: string }, deltas: Record<string, number>): TxOp =>
  tx.add(key.PK, key.SK, deltas);

// ---- Shared GSI partition values ----
export const typePartition = (type: string) => `TYPE#${type}`;
export const patientPartition = (patientId: string) => `PATIENT#${patientId}`;
export const doctorPartition = (doctorId: string) => `DOCTOR#${doctorId}`;
export const userPartition = (userId: string) => `USER#${userId}`;
