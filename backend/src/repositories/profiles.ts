import { queryPage } from '../db/dynamo';
import { userPartition } from '../db/keys';
import { doctorRepo, patientRepo } from './index';
import type { IDoctor, IPatient } from '../types/entities';

// Replacement for Patient.findOne({ user }) / Doctor.findOne({ user }).
// Patient and doctor items carry GSI3PK = USER#<userId>, so this is one small Query.

export const findPatientByUser = async (userId: string | undefined): Promise<IPatient | null> => {
  if (!userId) return null;
  const { items } = await queryPage({ index: 'GSI3', pk: userPartition(userId), sk: { beginsWith: 'PROFILE#PATIENT' }, limit: 1 });
  return items[0] ? patientRepo.fromItem(items[0]) : null;
};

export const findDoctorByUser = async (userId: string | undefined): Promise<IDoctor | null> => {
  if (!userId) return null;
  const { items } = await queryPage({ index: 'GSI3', pk: userPartition(userId), sk: { beginsWith: 'PROFILE#DOCTOR' }, limit: 1 });
  return items[0] ? doctorRepo.fromItem(items[0]) : null;
};
