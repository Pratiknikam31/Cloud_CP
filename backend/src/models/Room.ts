import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomNumber: string;
  building: string;
  floor: string;
  roomType: 'general' | 'private' | 'icu' | 'emergency';
  ratePerDay: number;
}

const RoomSchema: Schema = new Schema(
  {
    roomNumber: { type: String, required: true, unique: true, trim: true },
    building: { type: String, required: true },
    floor: { type: String, required: true },
    roomType: { type: String, enum: ['general', 'private', 'icu', 'emergency'], required: true },
    ratePerDay: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Room = mongoose.model<IRoom>('Room', RoomSchema);
