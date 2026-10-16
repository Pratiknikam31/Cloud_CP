import mongoose, { Schema, Document } from 'mongoose';

export type LabStatus = 'requested' | 'sample_collected' | 'processing' | 'completed';

export interface ILabResultItem {
  parameter: string;
  result: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
}

export interface ILabReport extends Document {
  reportId: string;
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  labTest: mongoose.Types.ObjectId;
  requestedDate: Date;
  status: LabStatus;
  results: ILabResultItem[];
  reportFile?: string;
  performedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

const LabReportSchema: Schema = new Schema(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
    labTest: { type: Schema.Types.ObjectId, ref: 'LabTest', required: true },
    requestedDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['requested', 'sample_collected', 'processing', 'completed'],
      default: 'requested'
    },
    results: [
      {
        parameter: { type: String, required: true },
        result: { type: String, required: true },
        unit: { type: String, required: true },
        normalRange: { type: String, required: true },
        isAbnormal: { type: Boolean, default: false }
      }
    ],
    reportFile: { type: String, default: '' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

export const LabReport = mongoose.model<ILabReport>('LabReport', LabReportSchema);
