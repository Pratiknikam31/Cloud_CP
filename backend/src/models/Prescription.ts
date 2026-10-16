import mongoose, { Schema, Document } from 'mongoose';

export interface IPrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface IPrescription extends Document {
  prescriptionId: string;
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  medicalRecord?: mongoose.Types.ObjectId;
  date: Date;
  medicines: IPrescriptionItem[];
  status: 'active' | 'dispensed' | 'cancelled';
  notes?: string;
  createdAt: Date;
}

const PrescriptionSchema: Schema = new Schema(
  {
    prescriptionId: { type: String, required: true, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    medicalRecord: { type: Schema.Types.ObjectId, ref: 'MedicalRecord' },
    date: { type: Date, default: Date.now },
    medicines: [
      {
        medicineName: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        instructions: { type: String, required: true }
      }
    ],
    status: {
      type: String,
      enum: ['active', 'dispensed', 'cancelled'],
      default: 'active'
    },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Prescription = mongoose.model<IPrescription>('Prescription', PrescriptionSchema);
