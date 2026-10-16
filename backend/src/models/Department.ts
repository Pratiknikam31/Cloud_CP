import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  code: string;
  description: string;
  icon: string;
  status: 'active' | 'inactive';
}

const DepartmentSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'Stethoscope' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

export const Department = mongoose.model<IDepartment>('Department', DepartmentSchema);
