import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(5, 'Phone number is required'),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other']),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  address: z.string().min(5, 'Address is required'),
  emergencyContact: z.object({
    name: z.string().min(1, 'Emergency contact name is required'),
    relationship: z.string().min(1, 'Relationship is required'),
    phone: z.string().min(5, 'Emergency contact phone is required'),
  }),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  allergies: z.array(z.string()).optional().default([]),
  medicalHistory: z.array(z.string()).optional().default([]),
});

export const updatePatientSchema = createPatientSchema.partial();

export const createDoctorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(5, 'Phone number is required'),
  specialization: z.string().min(2, 'Specialization is required'),
  department: z.string().min(1, 'Department is required'),
  qualification: z.string().min(2, 'Qualification is required'),
  experienceYears: z.number().min(0),
  consultationFee: z.number().min(0),
  availableDays: z.array(z.string()).min(1, 'At least one available day is required'),
  availableTimeSlots: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).min(1, 'At least one time slot is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  bio: z.string().optional(),
});

export const updateDoctorSchema = createDoctorSchema.partial();

export const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Department code is required').max(10),
  description: z.string().min(5, 'Description is required'),
  icon: z.string().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createAppointmentSchema = z.object({
  patient: z.string().min(1, 'Patient ID is required'),
  doctor: z.string().min(1, 'Doctor ID is required'),
  department: z.string().min(1, 'Department is required'),
  date: z.string().min(1, 'Appointment date is required'),
  timeSlot: z.string().min(1, 'Time slot is required'),
  symptoms: z.string().min(3, 'Please describe your symptoms'),
  type: z.enum(['in_person', 'follow_up', 'emergency']).optional().default('in_person'),
  notes: z.string().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show']),
  notes: z.string().optional(),
});

export const createMedicalRecordSchema = z.object({
  patient: z.string().min(1, 'Patient is required'),
  doctor: z.string().min(1, 'Doctor is required'),
  appointment: z.string().optional(),
  symptoms: z.string().min(3, 'Symptoms are required'),
  diagnosis: z.string().min(3, 'Diagnosis is required'),
  clinicalNotes: z.string().optional().default(''),
  examinationNotes: z.string().optional().default(''),
  investigationsRecommended: z.string().optional().default(''),
  lifestyleAdvice: z.string().optional().default(''),
  vitals: z.object({
    bloodPressure: z.string().min(1),
    heartRate: z.number().min(0),
    temperature: z.number().min(0),
    oxygenSaturation: z.number().min(0).max(100),
    weight: z.number().min(0),
    height: z.number().min(0),
    respiratoryRate: z.number().optional().default(16),
  }),
  followUpDate: z.string().optional(),
}).passthrough();

export const createPrescriptionSchema = z.object({
  patient: z.string().min(1, 'Patient is required'),
  doctor: z.string().min(1, 'Doctor is required'),
  medicalRecord: z.string().optional(),
  medicines: z.array(z.object({
    medicineName: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    duration: z.string().min(1),
    instructions: z.string().min(1),
  })).min(1, 'At least one medicine is required'),
  notes: z.string().optional(),
}).passthrough();

export const createMedicineSchema = z.object({
  name: z.string().min(2, 'Medicine name is required'),
  genericName: z.string().min(2, 'Generic name is required'),
  category: z.string().min(2, 'Category is required'),
  manufacturer: z.string().min(2, 'Manufacturer is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  minStockLevel: z.number().min(0).optional().default(10),
  location: z.string().optional().default('Shelf A'),
  dailyAvgUsage: z.number().min(0).optional().default(5),
});

export const updateMedicineSchema = createMedicineSchema.partial();

export const createLabTestSchema = z.object({
  name: z.string().min(2, 'Test name is required'),
  category: z.string().min(2, 'Category is required'),
  price: z.number().min(0),
  description: z.string().min(5, 'Description is required'),
  normalRange: z.string().min(1, 'Normal range is required'),
  turnaroundHours: z.number().min(1).optional().default(24),
});

export const createLabReportSchema = z.object({
  patient: z.string().min(1, 'Patient is required'),
  doctor: z.string().min(1, 'Doctor is required'),
  labTest: z.string().min(1, 'Lab test is required'),
  notes: z.string().optional(),
});

export const updateLabReportSchema = z.object({
  status: z.enum(['requested', 'sample_collected', 'processing', 'completed']).optional(),
  results: z.array(z.object({
    parameter: z.string(),
    result: z.string(),
    unit: z.string(),
    normalRange: z.string(),
    isAbnormal: z.boolean(),
  })).optional(),
  notes: z.string().optional(),
});

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  building: z.string().min(1, 'Building is required'),
  floor: z.string().min(1, 'Floor is required'),
  roomType: z.enum(['general', 'private', 'icu', 'emergency']),
  ratePerDay: z.number().min(0),
});

export const createBedSchema = z.object({
  bedNumber: z.string().min(1, 'Bed number is required'),
  room: z.string().min(1, 'Room is required'),
});

export const updateBedSchema = z.object({
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).optional(),
  currentPatient: z.string().nullable().optional(),
});

export const createBillSchema = z.object({
  patient: z.string().min(1, 'Patient is required'),
  items: z.array(z.object({
    description: z.string().min(1),
    category: z.enum(['consultation', 'room', 'laboratory', 'medicine', 'procedure', 'other']),
    amount: z.number().min(0),
    quantity: z.number().min(1).optional().default(1),
  })).min(1, 'At least one item is required'),
  discount: z.number().min(0).optional().default(0),
  tax: z.number().min(0).optional().default(0),
  dueDate: z.string().min(1, 'Due date is required'),
});

export const recordPaymentSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
});

export const createNotificationSchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['appointment', 'lab', 'prescription', 'bill', 'system', 'stock']).optional().default('system'),
  link: z.string().optional(),
});

export const symptomCheckSchema = z.object({
  symptoms: z.string().min(3, 'Please describe your symptoms in at least 3 characters'),
});
