import mongoose, { Schema, Document } from 'mongoose';

export interface ILabTest extends Document {
  testCode: string;
  name: string;
  category: string;
  price: number;
  description: string;
  normalRange: string;
  turnaroundHours: number;
}

const LabTestSchema: Schema = new Schema(
  {
    testCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    normalRange: { type: String, required: true },
    turnaroundHours: { type: Number, default: 24 }
  },
  { timestamps: true }
);

export const LabTest = mongoose.model<ILabTest>('LabTest', LabTestSchema);
