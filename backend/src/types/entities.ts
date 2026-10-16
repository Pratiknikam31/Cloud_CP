// Plain TypeScript types for every stored entity (these replace the old Mongoose models).
// References to other entities are stored as their `_id` string.
// Dates are stored as ISO-8601 strings, which is also how the API returns them.

export interface BaseEntity {
  _id: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole =
  | 'super_admin'
  | 'hospital_admin'
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'lab_staff'
  | 'lab_technician'
  | 'pharmacist'
  | 'billing_staff'
  | 'patient';

export interface IUser extends BaseEntity {
  name: string;
  email: string; // always stored lowercase + trimmed
  password: string; // bcrypt hash; never returned by the API
  role: UserRole;
  avatar: string;
  phone: string;
  isActive: boolean;
  lastLogin?: string;
}

export interface IPatient extends BaseEntity {
  patientId: string;
  user: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  address: string;
  emergencyContact: { name: string; relationship: string; phone: string };
  insuranceProvider: string;
  insurancePolicyNumber: string;
  allergies: string[];
  medicalHistory: string[];
  profileImage: string;
}

export interface IDoctor extends BaseEntity {
  doctorId: string;
  user: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  department: string;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  availableDays: string[];
  availableTimeSlots: { start: string; end: string }[];
  roomNumber: string;
  rating: number;
  profileImage: string;
  bio: string;
  status: 'active' | 'on_leave' | 'inactive';
}

export interface IDepartment extends BaseEntity {
  name: string;
  code: string; // uppercase
  description: string;
  icon: string;
  status: 'active' | 'inactive';
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface IAppointment extends BaseEntity {
  appointmentId: string;
  patient: string;
  doctor: string;
  department: string;
  date: string;
  timeSlot: string;
  symptoms: string;
  status: AppointmentStatus;
  type: 'in_person' | 'follow_up' | 'emergency';
  notes: string;
  queueNumber: number;
  // Key of the slot lock item while the appointment holds its slot (see appointmentRepository).
  slotLock?: string;
}

export interface IMedicalRecord extends BaseEntity {
  recordId: string;
  patient: string;
  doctor: string;
  appointment?: string;
  date: string;
  symptoms: string;
  diagnosis: string;
  clinicalNotes: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
    weight: number;
    height: number;
  };
  attachments: string[];
  followUpDate?: string;
}

export interface IPrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface IPrescription extends BaseEntity {
  prescriptionId: string;
  patient: string;
  doctor: string;
  medicalRecord?: string;
  date: string;
  medicines: IPrescriptionItem[];
  status: 'active' | 'dispensed' | 'cancelled';
  notes: string;
}

export interface IMedicine extends BaseEntity {
  medicineId: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  minStockLevel: number;
  location: string;
  dailyAvgUsage: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';
}

export interface IInventoryTransaction extends BaseEntity {
  medicine: string;
  type: 'stock_in' | 'stock_out' | 'expired' | 'adjustment';
  quantity: number;
  reason: string;
  performedBy: string;
  timestamp: string;
}

export interface ILabTest extends BaseEntity {
  testCode: string; // uppercase
  name: string;
  category: string;
  price: number;
  description: string;
  normalRange: string;
  turnaroundHours: number;
}

export type LabStatus = 'requested' | 'sample_collected' | 'processing' | 'completed';

export interface ILabResultItem {
  parameter: string;
  result: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
}

export interface ILabReport extends BaseEntity {
  reportId: string;
  patient: string;
  doctor: string;
  labTest: string;
  requestedDate: string;
  status: LabStatus;
  results: ILabResultItem[];
  reportFile: string;
  performedBy?: string;
  notes: string;
}

export interface IRoom extends BaseEntity {
  roomNumber: string;
  building: string;
  floor: string;
  roomType: 'general' | 'private' | 'icu' | 'emergency';
  ratePerDay: number;
}

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

export interface IBed extends BaseEntity {
  bedNumber: string;
  room: string;
  status: BedStatus;
  currentPatient?: string;
  assignedDate?: string;
}

export type PaymentStatus = 'paid' | 'partially_paid' | 'pending' | 'refunded';

export interface IBillItem {
  description: string;
  category: 'consultation' | 'room' | 'laboratory' | 'medicine' | 'procedure' | 'other';
  amount: number;
  quantity: number;
}

export interface IBill extends BaseEntity {
  billId: string;
  patient: string;
  items: IBillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: PaymentStatus;
  invoiceDate: string;
  dueDate: string;
}

export type NotificationType = 'appointment' | 'lab' | 'prescription' | 'bill' | 'system' | 'stock';

export interface INotification extends BaseEntity {
  recipient: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string;
}

export interface IAuditLog extends BaseEntity {
  user?: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  ipAddress: string;
  timestamp: string;
}
