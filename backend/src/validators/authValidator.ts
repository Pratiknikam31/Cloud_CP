import { z } from 'zod';

export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['patient'], {
    errorMap: () => ({ message: 'Public registration is only permitted for patient accounts. Staff accounts must be provisioned by an administrator.' })
  }).optional().default('patient'),
  phone: z.string().optional(),
  otp: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  resetToken: z.string().min(4, 'Reset token is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum([
    'super_admin',
    'hospital_admin',
    'doctor',
    'nurse',
    'receptionist',
    'lab_staff',
    'pharmacist',
    'patient',
    'billing_staff',
  ]),
  phone: z.string().optional(),
  department: z.string().optional(),
  specialization: z.string().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum([
    'super_admin',
    'hospital_admin',
    'doctor',
    'nurse',
    'receptionist',
    'lab_staff',
    'pharmacist',
    'patient',
    'billing_staff',
  ]),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

