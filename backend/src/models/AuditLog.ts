import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  user?: mongoose.Types.ObjectId;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: '' },
    description: { type: String, required: true },
    ipAddress: { type: String, default: '127.0.0.1' },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
