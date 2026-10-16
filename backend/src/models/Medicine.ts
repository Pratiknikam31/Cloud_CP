import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicine extends Document {
  medicineId: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
  unitPrice: number;
  minStockLevel: number;
  location: string;
  dailyAvgUsage: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';
}

const MedicineSchema: Schema = new Schema(
  {
    medicineId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    genericName: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    manufacturer: { type: String, required: true },
    batchNumber: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    minStockLevel: { type: Number, required: true, default: 10 },
    location: { type: String, default: 'Shelf A' },
    dailyAvgUsage: { type: Number, default: 5 },
    status: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock', 'expired'],
      default: 'in_stock'
    }
  },
  { timestamps: true }
);

export const Medicine = mongoose.model<IMedicine>('Medicine', MedicineSchema);
