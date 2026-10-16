import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus = 
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface IAppointment extends Document {
  appointmentId: string;
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  department: mongoose.Types.ObjectId;
  date: Date;
  timeSlot: string;
  symptoms: string;
  status: AppointmentStatus;
  type: 'in_person' | 'follow_up' | 'emergency';
  notes?: string;
  queueNumber: number;
  createdAt: Date;
}

const AppointmentSchema: Schema = new Schema(
  {
    appointmentId: { type: String, required: true, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    symptoms: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'],
      default: 'pending'
    },
    type: { type: String, enum: ['in_person', 'follow_up', 'emergency'], default: 'in_person' },
    notes: { type: String, default: '' },
    queueNumber: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
