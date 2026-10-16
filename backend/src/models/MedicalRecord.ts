import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicalRecord extends Document {
  recordId: string;
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  appointment?: mongoose.Types.ObjectId;
  date: Date;
  symptoms: string;
  diagnosis: string;
  clinicalNotes: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
    weight: number;
    height: number;
  };
  attachments: string[];
  followUpDate?: Date;
  createdAt: Date;
}

const MedicalRecordSchema: Schema = new Schema(
  {
    recordId: { type: String, required: true, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    date: { type: Date, default: Date.now },
    symptoms: { type: String, required: true },
    diagnosis: { type: String, required: true },
    clinicalNotes: { type: String, default: '' },
    vitals: {
      bloodPressure: { type: String, required: true },
      heartRate: { type: Number, required: true },
      temperature: { type: Number, required: true },
      oxygenSaturation: { type: Number, required: true },
      weight: { type: Number, required: true },
      height: { type: Number, required: true }
    },
    attachments: [{ type: String }],
    followUpDate: { type: Date }
  },
  { timestamps: true }
);

export const MedicalRecord = mongoose.model<IMedicalRecord>('MedicalRecord', MedicalRecordSchema);
