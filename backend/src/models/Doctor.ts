import mongoose, { Schema, Document } from 'mongoose';

export interface IDoctor extends Document {
  doctorId: string;
  user: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  department: mongoose.Types.ObjectId;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  availableDays: string[];
  availableTimeSlots: { start: string; end: string }[];
  roomNumber: string;
  rating: number;
  profileImage?: string;
  bio?: string;
  status: 'active' | 'on_leave' | 'inactive';
}

const DoctorSchema: Schema = new Schema(
  {
    doctorId: { type: String, required: true, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    specialization: { type: String, required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    qualification: { type: String, required: true },
    experienceYears: { type: Number, required: true },
    consultationFee: { type: Number, required: true },
    availableDays: [{ type: String }],
    availableTimeSlots: [
      {
        start: { type: String, required: true },
        end: { type: String, required: true }
      }
    ],
    roomNumber: { type: String, required: true },
    rating: { type: Number, default: 4.8 },
    profileImage: { type: String, default: '' },
    bio: { type: String, default: '' },
    status: { type: String, enum: ['active', 'on_leave', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

export const Doctor = mongoose.model<IDoctor>('Doctor', DoctorSchema);
