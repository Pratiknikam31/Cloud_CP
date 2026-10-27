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


export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive?: boolean;
  lastLogin?: string;
}

export interface Patient {
  _id: string;
  patientId: string;
  user: string | User;
  name: string;
  email: string;
  phone: string;
  dob: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  allergies: string[];
  medicalHistory: string[];
  profileImage?: string;
  createdAt: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  description: string;
  icon: string;
  status: 'active' | 'inactive';
}

export interface Doctor {
  _id: string;
  doctorId: string;
  user: string | User;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  department: Department;
  qualification: string;
  experienceYears: number;
  consultationFee: number;
  availableDays: string[];
  availableTimeSlots: { start: string; end: string }[];
  roomNumber: string;
  rating: number;
  profileImage?: string;
  bio?: string;
  status: 'active' | 'on_leave' | 'inactive';
}

export type AppointmentStatus = 
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  _id: string;
  appointmentId: string;
  patient: Patient;
  doctor: Doctor;
  department: Department;
  date: string;
  timeSlot: string;
  symptoms: string;
  status: AppointmentStatus;
  type: 'in_person' | 'follow_up' | 'emergency';
  notes?: string;
  queueNumber: number;
  createdAt: string;
}

export interface MedicalRecord {
  _id: string;
  recordId: string;
  patient: Patient;
  doctor: Doctor;
  appointment?: string;
  date: string;
  symptoms: string;
  diagnosis: string;
  clinicalNotes: string;
  examinationNotes?: string;
  investigationsRecommended?: string;
  lifestyleAdvice?: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
    weight: number;
    height: number;
    respiratoryRate?: number;
  };
  attachments: string[];
  followUpDate?: string;
}

export interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  _id: string;
  prescriptionId: string;
  patient: Patient;
  doctor: Doctor;
  medicalRecord?: string;
  date: string;
  medicines: PrescriptionItem[];
  notes?: string;
}

export interface Medicine {
  _id: string;
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

export interface LabTest {
  _id: string;
  testCode: string;
  name: string;
  category: string;
  price: number;
  description: string;
  normalRange: string;
  turnaroundHours: number;
}

export interface LabResultItem {
  parameter: string;
  result: string;
  unit: string;
  normalRange: string;
  isAbnormal: boolean;
}

export interface LabReport {
  _id: string;
  reportId: string;
  patient: Patient;
  doctor: Doctor;
  labTest: LabTest;
  requestedDate: string;
  status: 'requested' | 'sample_collected' | 'processing' | 'completed';
  results: LabResultItem[];
  reportFile?: string;
  performedBy?: User;
  notes?: string;
}

export interface Room {
  _id: string;
  roomNumber: string;
  building: string;
  floor: string;
  roomType: 'general' | 'private' | 'icu' | 'emergency';
  ratePerDay: number;
}

export interface Bed {
  _id: string;
  bedNumber: string;
  room: Room;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  currentPatient?: Patient;
  assignedDate?: string;
}

export interface BillItem {
  description: string;
  category: 'consultation' | 'room' | 'laboratory' | 'medicine' | 'procedure' | 'other';
  amount: number;
  quantity: number;
}

export interface Bill {
  _id: string;
  billId: string;
  patient: Patient;
  items: BillItem[];
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'paid' | 'partially_paid' | 'pending' | 'refunded';
  invoiceDate: string;
  dueDate: string;
}

export interface Notification {
  _id: string;
  recipient: string;
  title: string;
  message: string;
  type: 'appointment' | 'lab' | 'prescription' | 'bill' | 'system' | 'stock';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  user?: User;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  timestamp: string;
}

export interface AIRecommendation {
  departmentCode: string;
  departmentName: string;
  confidenceScore: number;
  explanation: string;
  suggestedUrgency: 'low' | 'medium' | 'high' | 'emergency';
  disclaimer: string;
}
