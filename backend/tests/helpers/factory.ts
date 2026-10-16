import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { departmentRepo, doctorRepo, patientRepo } from '../../src/repositories';
import { createUserAccount } from '../../src/repositories/userAccounts';
import { claimUnique } from '../../src/db/keys';
import type { IUser, UserRole } from '../../src/types/entities';

// Test data builders that write straight to the repositories.

let seq = 0;
const unique = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export const tokenFor = (user: Pick<IUser, '_id' | 'email' | 'role' | 'name'>) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET!, { expiresIn: '1h' });

export const makeUser = async (role: UserRole, overrides: Partial<{ email: string; name: string; password: string }> = {}) => {
  const password = overrides.password ?? 'password123';
  const user = await createUserAccount({
    name: overrides.name ?? `Test ${role}`,
    email: overrides.email ?? `${role}-${unique()}@test.local`,
    password: await bcrypt.hash(password, 4),
    role,
  });
  return { user, token: tokenFor(user), password };
};

export const makeDepartment = async (name = `Dept ${unique()}`, code = `D${unique()}`.slice(0, 10).toUpperCase()) =>
  departmentRepo.create(
    { name, code, description: 'Test department', icon: 'Stethoscope', status: 'active' },
    { extra: [] }
  ).then(async (d) => d);

export const makeDoctor = async (departmentId: string, name = 'Dr. Test Doctor') => {
  const { user, token } = await makeUser('doctor', { name });
  const doctor = await doctorRepo.create({
    doctorId: `D-TEST-${unique()}`,
    user: user._id,
    name,
    email: user.email,
    phone: '555-0101',
    specialization: 'Cardiology',
    department: departmentId,
    qualification: 'MD',
    experienceYears: 5,
    consultationFee: 100,
    availableDays: ['Monday'],
    availableTimeSlots: [{ start: '09:00', end: '12:00' }],
    roomNumber: '101',
    rating: 4.8,
    profileImage: '',
    bio: '',
    status: 'active',
  });
  return { doctor, user, token };
};

export const makePatient = async (name = 'Test Patient') => {
  const { user, token } = await makeUser('patient', { name });
  const patient = await patientRepo.create({
    patientId: `P-TEST-${unique()}`,
    user: user._id,
    name,
    email: user.email,
    phone: '555-0102',
    dob: new Date('1990-01-01').toISOString(),
    gender: 'female',
    bloodGroup: 'A+',
    address: '1 Test Street',
    emergencyContact: { name: 'EC', relationship: 'Friend', phone: '555-0103' },
    insuranceProvider: '',
    insurancePolicyNumber: '',
    allergies: [],
    medicalHistory: [],
    profileImage: '',
  });
  return { patient, user, token };
};

export { claimUnique };
