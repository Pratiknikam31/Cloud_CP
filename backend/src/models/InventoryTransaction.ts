import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryTransaction extends Document {
  medicine: mongoose.Types.ObjectId;
  type: 'stock_in' | 'stock_out' | 'expired' | 'adjustment';
  quantity: number;
  reason: string;
  performedBy: mongoose.Types.ObjectId;
  timestamp: Date;
}

const InventoryTransactionSchema: Schema = new Schema(
  {
    medicine: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    type: { type: String, enum: ['stock_in', 'stock_out', 'expired', 'adjustment'], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const InventoryTransaction = mongoose.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);
