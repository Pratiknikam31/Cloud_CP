import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 
  | 'super_admin'
  | 'hospital_admin'
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'lab_staff'
  | 'lab_technician'
  | 'pharmacist'
  | 'billing_staff'
  | 'patient';


export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { 
      type: String, 
      required: true, 
      enum: ['super_admin', 'hospital_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'lab_staff', 'lab_technician', 'pharmacist', 'billing_staff', 'patient'],
      default: 'patient'
    },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
