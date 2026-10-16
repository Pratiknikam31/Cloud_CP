import { nextSequence } from '../db/dynamo';

// Human-readable IDs generated from atomic DynamoDB counters, so they are
// unique even under concurrent requests and never reused after deletes.
// Formats match the original application.

const pad = (n: number, width: number) => n.toString().padStart(width, '0');
const year = () => new Date().getFullYear();

export const newPatientId = async () => `P-${year()}-${pad(await nextSequence('PATIENT'), 4)}`;
export const newDoctorId = async () => `D-${year()}-${pad(await nextSequence('DOCTOR'), 4)}`;
export const newAppointmentId = async () => `APT-${year()}-${pad(await nextSequence('APPOINTMENT'), 5)}`;
export const newRecordId = async () => `EMR-${year()}-${pad(await nextSequence('MEDICAL_RECORD'), 5)}`;
export const newPrescriptionId = async () => `RX-${year()}-${pad(await nextSequence('PRESCRIPTION'), 5)}`;
export const newMedicineId = async () => `MED-${pad(await nextSequence('MEDICINE'), 6)}`;
export const newLabTestCode = async () => `LT-${pad(await nextSequence('LAB_TEST'), 3)}`;
export const newLabReportId = async () => `LAB-${pad(await nextSequence('LAB_REPORT'), 6)}`;
export const newBillId = async () => `INV-${pad(await nextSequence('BILL'), 6)}`;

// Queue numbers restart for each doctor and day.
export const nextQueueNumber = (doctorId: string, dayKey: string) => nextSequence(`QUEUE#${doctorId}#${dayKey}`);
