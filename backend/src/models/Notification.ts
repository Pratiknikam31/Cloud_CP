import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'appointment' | 'lab' | 'prescription' | 'bill' | 'system' | 'stock';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['appointment', 'lab', 'prescription', 'bill', 'system', 'stock'],
      default: 'system'
    },
    read: { type: Boolean, default: false },
    link: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
