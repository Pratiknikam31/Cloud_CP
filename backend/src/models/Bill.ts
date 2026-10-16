import mongoose, { Schema, Document } from 'mongoose';

export type PaymentStatus = 'paid' | 'partially_paid' | 'pending' | 'refunded';

export interface IBillItem {
  description: string;
  category: 'consultation' | 'room' | 'laboratory' | 'medicine' | 'procedure' | 'other';
  amount: number;
  quantity: number;
}

export interface IBill extends Document {
  billId: string;
  patient: mongoose.Types.ObjectId;
  items: IBillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: PaymentStatus;
  invoiceDate: Date;
  dueDate: Date;
  createdAt: Date;
}

const BillSchema: Schema = new Schema(
  {
    billId: { type: String, required: true, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    items: [
      {
        description: { type: String, required: true },
        category: {
          type: String,
          enum: ['consultation', 'room', 'laboratory', 'medicine', 'procedure', 'other'],
          required: true
        },
        amount: { type: Number, required: true },
        quantity: { type: Number, default: 1 }
      }
    ],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    status: {
      type: String,
      enum: ['paid', 'partially_paid', 'pending', 'refunded'],
      default: 'pending'
    },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Bill = mongoose.model<IBill>('Bill', BillSchema);
