import mongoose, { Schema, Document } from 'mongoose';

export interface IPatient extends Document {
  patientId: string;
  user: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  dob: Date;
  gender: 'male' | 'female' | 'other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  allergies: string[];
  medicalHistory: string[];
  profileImage?: string;
  createdAt: Date;
}

const PatientSchema: Schema = new Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: true },
    address: { type: String, required: true },
    emergencyContact: {
      name: { type: String, required: true },
      relationship: { type: String, required: true },
      phone: { type: String, required: true },
    },
    insuranceProvider: { type: String, default: '' },
    insurancePolicyNumber: { type: String, default: '' },
    allergies: [{ type: String }],
    medicalHistory: [{ type: String }],
    profileImage: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Patient = mongoose.model<IPatient>('Patient', PatientSchema);
