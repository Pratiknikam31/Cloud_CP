import mongoose, { Schema, Document } from 'mongoose';

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface IBed extends Document {
  bedNumber: string;
  room: mongoose.Types.ObjectId;
  status: BedStatus;
  currentPatient?: mongoose.Types.ObjectId;
  assignedDate?: Date;
}

const BedSchema: Schema = new Schema(
  {
    bedNumber: { type: String, required: true, unique: true, trim: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    status: {
      type: String,
      enum: ['available', 'occupied', 'reserved', 'maintenance'],
      default: 'available'
    },
    currentPatient: { type: Schema.Types.ObjectId, ref: 'Patient' },
    assignedDate: { type: Date }
  },
  { timestamps: true }
);

export const Bed = mongoose.model<IBed>('Bed', BedSchema);
