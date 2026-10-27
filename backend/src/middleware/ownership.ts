import { AuthUser } from './auth';
import { findDoctorByUser, findPatientByUser } from '../repositories/profiles';
import { patientRepo, doctorRepo } from '../repositories';
import { IPatient, IDoctor } from '../types/entities';

/**
 * Resolves the authenticated user's patient profile, if one exists.
 */
export const getCallerPatientProfile = async (user: AuthUser): Promise<IPatient | null> => {
  if (user.role !== 'patient') return null;
  return await findPatientByUser(user._id || user.id);
};

/**
 * Resolves the authenticated user's doctor profile, if one exists.
 */
export const getCallerDoctorProfile = async (user: AuthUser): Promise<IDoctor | null> => {
  if (user.role !== 'doctor') return null;
  return await findDoctorByUser(user._id || user.id);
};

/**
 * Checks whether an authenticated user can read or access a resource owned by a patient.
 * Rules:
 * - Administrators (super_admin, hospital_admin, admin) can access any patient resource.
 * - Receptionists can access patient profiles, appointments, bills, and bed info.
 * - Doctors can access resources of patients they consult with or for clinical care.
 * - Nurses can access patient vitals and care records.
 * - Patients can ONLY access their OWN records. If a patient user has no profile, access is denied.
 */
export const canAccessPatientResource = async (
  user: AuthUser,
  patientId: string,
  resourceType: 'appointment' | 'emr' | 'prescription' | 'lab' | 'bill' | 'patient' | 'timeline'
): Promise<boolean> => {
  const role = user.role;

  // Administrators have full access
  if (role === 'super_admin' || role === 'hospital_admin' || role === 'admin') {
    return true;
  }

  // Patients can only access their own profile and records
  if (role === 'patient') {
    const patientProfile = await findPatientByUser(user._id || user.id);
    if (!patientProfile) {
      return false; // Profile-less patient is denied access
    }
    return patientProfile._id === patientId || patientProfile.patientId === patientId;
  }

  // Receptionists have operational access to appointments, patients, and bills
  if (role === 'receptionist') {
    if (resourceType === 'emr' || resourceType === 'lab') {
      return false; // Receptionists do not access clinical notes or full lab details
    }
    return true;
  }

  // Doctors have access to clinical resources (EMR, prescriptions, lab, appointments, patient profiles)
  if (role === 'doctor') {
    if (resourceType === 'bill') {
      return false; // Doctors should not access hospital financial ledger/bills
    }
    return true;
  }

  // Nurses have access to care resources
  if (role === 'nurse') {
    if (resourceType === 'bill') {
      return false;
    }
    return true;
  }

  // Laboratory staff only access laboratory reports
  if (role === 'lab_staff' || role === 'lab_technician') {
    return resourceType === 'lab';
  }

  // Pharmacists only access prescriptions and medicines
  if (role === 'pharmacist') {
    return resourceType === 'prescription';
  }

  return false;
};
