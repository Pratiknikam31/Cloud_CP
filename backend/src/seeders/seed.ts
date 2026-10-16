import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { Department } from '../models/Department';
import { Medicine } from '../models/Medicine';
import { Appointment } from '../models/Appointment';
import { MedicalRecord } from '../models/MedicalRecord';
import { Prescription } from '../models/Prescription';
import { LabTest } from '../models/LabTest';
import { LabReport } from '../models/LabReport';
import { Room } from '../models/Room';
import { Bed } from '../models/Bed';
import { Bill } from '../models/Bill';
import { Notification } from '../models/Notification';
import { AuditLog } from '../models/AuditLog';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smarthospital';

const seedDatabase = async () => {
  try {
    console.log('🔌 Connecting to MongoDB for Comprehensive Seeding...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB.\n');

    // Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Doctor.deleteMany({}),
      Department.deleteMany({}),
      Medicine.deleteMany({}),
      Appointment.deleteMany({}),
      MedicalRecord.deleteMany({}),
      Prescription.deleteMany({}),
      LabTest.deleteMany({}),
      LabReport.deleteMany({}),
      Room.deleteMany({}),
      Bed.deleteMany({}),
      Bill.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    console.log('🗑️  Cleared existing database collections.\n');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Seed Users
    const adminUser = await User.create({
      name: 'Dr. Arthur Pendelton',
      email: 'admin@smarthospital.org',
      password: hashedPassword,
      role: 'hospital_admin',
      phone: '+1 555-010-9000'
    });

    const doctor1User = await User.create({
      name: 'Dr. Eleanor Vance',
      email: 'doctor@smarthospital.org',
      password: hashedPassword,
      role: 'doctor',
      phone: '+1 555-010-9001'
    });

    const doctor2User = await User.create({
      name: 'Dr. Marcus Brody',
      email: 'brody@smarthospital.org',
      password: hashedPassword,
      role: 'doctor',
      phone: '+1 555-010-9011'
    });

    const patient1User = await User.create({
      name: 'Robert Chen',
      email: 'patient@smarthospital.org',
      password: hashedPassword,
      role: 'patient',
      phone: '+1 555-010-9002'
    });

    const patient2User = await User.create({
      name: 'Maria Santos',
      email: 'maria@smarthospital.org',
      password: hashedPassword,
      role: 'patient',
      phone: '+1 555-010-9012'
    });

    const patient3User = await User.create({
      name: 'David Kim',
      email: 'david@smarthospital.org',
      password: hashedPassword,
      role: 'patient',
      phone: '+1 555-010-9013'
    });

    const receptionUser = await User.create({
      name: 'Sarah Connor',
      email: 'reception@smarthospital.org',
      password: hashedPassword,
      role: 'receptionist',
      phone: '+1 555-010-9003'
    });

    const labUser = await User.create({
      name: 'Michael Faraday',
      email: 'lab@smarthospital.org',
      password: hashedPassword,
      role: 'lab_staff',
      phone: '+1 555-010-9004'
    });

    const pharmacyUser = await User.create({
      name: 'Alexander Fleming',
      email: 'pharmacy@smarthospital.org',
      password: hashedPassword,
      role: 'pharmacist',
      phone: '+1 555-010-9005'
    });

    const nurseUser = await User.create({
      name: 'Emma Watson',
      email: 'nurse@smarthospital.org',
      password: hashedPassword,
      role: 'nurse',
      phone: '+1 555-010-9006'
    });

    console.log('👥 Created 10 demo user accounts (including Nurse and Multiple Doctors/Patients).\n');

    // 2. Seed Departments
    const deptCardiology = await Department.create({
      name: 'Cardiology',
      code: 'CARD',
      description: 'Comprehensive cardiovascular diagnosis, intervention, and outpatient care.',
      icon: 'Heart'
    });

    const deptNeurology = await Department.create({
      name: 'Neurology',
      code: 'NEUR',
      description: 'Brain, spinal cord, and peripheral nerve disorders.',
      icon: 'Brain'
    });

    const deptOrthopedics = await Department.create({
      name: 'Orthopedics',
      code: 'ORTH',
      description: 'Joint replacement, trauma, and musculoskeletal care.',
      icon: 'Bone'
    });

    const deptPediatrics = await Department.create({
      name: 'Pediatrics',
      code: 'PED',
      description: 'Child health, immunization, and neonatal intensive care.',
      icon: 'Baby'
    });

    console.log('🏥 Seeded 4 Clinical Departments.\n');

    // 3. Seed Doctors
    const doc1 = await Doctor.create({
      doctorId: 'D-2026-0001',
      user: doctor1User._id,
      name: doctor1User.name,
      email: doctor1User.email,
      phone: doctor1User.phone,
      specialization: 'Interventional Cardiology',
      department: deptCardiology._id,
      qualification: 'MD, FACC, Harvard Medical School',
      experienceYears: 15,
      consultationFee: 150,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availableTimeSlots: [
        { start: '09:00', end: '13:00' },
        { start: '14:00', end: '17:00' }
      ],
      roomNumber: 'R-301',
      bio: 'Leading cardiologist specializing in angioplasty, heart failure, and preventive cardiology.'
    });

    const doc2 = await Doctor.create({
      doctorId: 'D-2026-0002',
      user: doctor2User._id,
      name: doctor2User.name,
      email: doctor2User.email,
      phone: doctor2User.phone,
      specialization: 'Clinical Neurology',
      department: deptNeurology._id,
      qualification: 'MD, PhD, Johns Hopkins Medicine',
      experienceYears: 12,
      consultationFee: 140,
      availableDays: ['Monday', 'Wednesday', 'Thursday', 'Saturday'],
      availableTimeSlots: [
        { start: '10:00', end: '14:00' },
        { start: '15:00', end: '18:00' }
      ],
      roomNumber: 'R-305',
      bio: 'Expert in migraine syndromes, neurodegenerative conditions, and epilepsy management.'
    });

    console.log('🩺 Seeded Doctors.\n');

    // 4. Seed Patients
    const pat1 = await Patient.create({
      patientId: 'P-2026-0012',
      user: patient1User._id,
      name: patient1User.name,
      email: patient1User.email,
      phone: patient1User.phone,
      dob: new Date('1981-06-15'),
      gender: 'male',
      bloodGroup: 'O+',
      address: '104 Medical Plaza, New York, NY',
      emergencyContact: {
        name: 'Helen Chen',
        relationship: 'Spouse',
        phone: '+1 555-019-8811'
      },
      insuranceProvider: 'BlueCross HealthCare',
      insurancePolicyNumber: 'BC-984421-NY',
      allergies: ['Penicillin'],
      medicalHistory: ['Hypertension', 'Mild Angina']
    });

    const pat2 = await Patient.create({
      patientId: 'P-2026-0013',
      user: patient2User._id,
      name: patient2User.name,
      email: patient2User.email,
      phone: patient2User.phone,
      dob: new Date('1990-03-22'),
      gender: 'female',
      bloodGroup: 'A+',
      address: '742 Evergreen Terrace, Brooklyn, NY',
      emergencyContact: {
        name: 'Carlos Santos',
        relationship: 'Brother',
        phone: '+1 555-019-4455'
      },
      insuranceProvider: 'Aetna Medicare',
      insurancePolicyNumber: 'AET-772911',
      allergies: ['Aspirin', 'Sulfa'],
      medicalHistory: ['Migraine with Aura']
    });

    const pat3 = await Patient.create({
      patientId: 'P-2026-0014',
      user: patient3User._id,
      name: patient3User.name,
      email: patient3User.email,
      phone: patient3User.phone,
      dob: new Date('1975-11-08'),
      gender: 'male',
      bloodGroup: 'B+',
      address: '88 Queen St, Manhattan, NY',
      emergencyContact: {
        name: 'Grace Kim',
        relationship: 'Spouse',
        phone: '+1 555-019-2233'
      },
      insuranceProvider: 'UnitedHealth',
      insurancePolicyNumber: 'UH-109923',
      allergies: [],
      medicalHistory: ['Type 2 Diabetes', 'Hyperlipidemia']
    });

    console.log('🧑‍⚕️ Seeded Patients.\n');

    // 5. Seed Appointments
    const today = new Date();
    const appt1 = await Appointment.create({
      appointmentId: 'APT-100291',
      patient: pat1._id,
      doctor: doc1._id,
      department: deptCardiology._id,
      date: today,
      timeSlot: '09:30',
      queueNumber: 1,
      status: 'in_consultation',
      symptoms: 'Recurring chest discomfort and mild palpitation after exertion',
      type: 'in_person',
      notes: 'Follow-up on previous blood pressure medication'
    });

    const appt2 = await Appointment.create({
      appointmentId: 'APT-100292',
      patient: pat2._id,
      doctor: doc2._id,
      department: deptNeurology._id,
      date: today,
      timeSlot: '11:00',
      queueNumber: 2,
      status: 'checked_in',
      symptoms: 'Severe throbbing left-side migraine with photophobia',
      type: 'in_person'
    });

    const appt3 = await Appointment.create({
      appointmentId: 'APT-100293',
      patient: pat3._id,
      doctor: doc1._id,
      department: deptCardiology._id,
      date: new Date(Date.now() + 86400000),
      timeSlot: '10:00',
      queueNumber: 1,
      status: 'confirmed',
      symptoms: 'Routine lipid profile review and cardiac checkup',
      type: 'in_person'
    });

    console.log('📅 Seeded Appointments.\n');

    // 6. Seed Medical Records & Prescriptions
    const medRec1 = await MedicalRecord.create({
      recordId: 'REC-2026-0041',
      patient: pat1._id,
      doctor: doc1._id,
      appointment: appt1._id,
      symptoms: 'Substernal tightness and fatigue after moderate cardiovascular workload.',
      diagnosis: 'Stage 1 Essential Hypertension with mild Angina Pectoris',
      clinicalNotes: 'ECG shows normal sinus rhythm. Advised sodium restriction and regular aerobic walking.',
      vitals: {
        bloodPressure: '138/88',
        heartRate: 76,
        temperature: 98.4,
        oxygenSaturation: 98,
        weight: 78,
        height: 175
      },
      followUpDate: new Date(Date.now() + 14 * 86400000)
    });

    await Prescription.create({
      prescriptionId: 'RX-2026-0088',
      patient: pat1._id,
      doctor: doc1._id,
      medicalRecord: medRec1._id,
      medicines: [
        {
          medicineName: 'Atorvastatin 20mg',
          dosage: '20mg',
          frequency: 'Once daily at bedtime',
          duration: '30 days',
          instructions: 'Take after dinner with water'
        },
        {
          medicineName: 'Amlodipine 5mg',
          dosage: '5mg',
          frequency: 'Once daily morning',
          duration: '30 days',
          instructions: 'Take with breakfast'
        }
      ],
      status: 'active',
      notes: 'Monitor morning blood pressure daily and record in CloudCare app'
    });

    console.log('📑 Seeded Medical Records & Prescriptions.\n');

    // 7. Seed Lab Tests & Reports
    const ltCbc = await LabTest.create({
      testCode: 'LT-CBC',
      name: 'Complete Blood Count (CBC)',
      category: 'Hematology',
      price: 35.0,
      description: 'Comprehensive screening for anemia, infection, and platelets.',
      normalRange: 'WBC: 4.5-11.0 K/uL, RBC: 4.3-5.9 M/uL, Platelets: 150-450 K/uL',
      turnaroundHours: 12
    });

    const ltLipid = await LabTest.create({
      testCode: 'LT-LIPID',
      name: 'Complete Lipid Profile',
      category: 'Biochemistry',
      price: 65.0,
      description: 'Total cholesterol, HDL, LDL, and Triglycerides profile.',
      normalRange: 'Cholesterol < 200 mg/dL, Triglycerides < 150 mg/dL, LDL < 100 mg/dL',
      turnaroundHours: 24
    });

    const ltHba1c = await LabTest.create({
      testCode: 'LT-HBA1C',
      name: 'Hemoglobin A1c (HbA1c)',
      category: 'Endocrinology',
      price: 45.0,
      description: 'Average blood glucose level over the past 3 months.',
      normalRange: 'Normal: < 5.7%, Pre-diabetic: 5.7-6.4%, Diabetic: >= 6.5%',
      turnaroundHours: 8
    });

    await LabReport.create({
      reportId: 'LAB-900182',
      patient: pat1._id,
      doctor: doc1._id,
      labTest: ltLipid._id,
      status: 'completed',
      results: [
        { parameter: 'Total Cholesterol', result: '228', unit: 'mg/dL', normalRange: '< 200', isAbnormal: true },
        { parameter: 'HDL (Good Cholesterol)', result: '46', unit: 'mg/dL', normalRange: '> 40', isAbnormal: false },
        { parameter: 'LDL (Bad Cholesterol)', result: '148', unit: 'mg/dL', normalRange: '< 100', isAbnormal: true },
        { parameter: 'Triglycerides', result: '170', unit: 'mg/dL', normalRange: '< 150', isAbnormal: true }
      ],
      performedBy: labUser._id,
      notes: 'Elevated LDL and Total Cholesterol noted. Lipid-lowering therapy recommended.'
    });

    await LabReport.create({
      reportId: 'LAB-900183',
      patient: pat2._id,
      doctor: doc2._id,
      labTest: ltCbc._id,
      status: 'processing',
      results: [],
      notes: 'Sample collected, awaiting automated analyzer report.'
    });

    console.log('🔬 Seeded Lab Tests & Lab Reports.\n');

    // 8. Seed Rooms & Beds
    const rICU = await Room.create({
      roomNumber: 'ICU-101',
      building: 'Wing A',
      floor: 'Floor 1',
      roomType: 'icu',
      ratePerDay: 500
    });

    const rGen = await Room.create({
      roomNumber: 'WARD-204',
      building: 'Wing B',
      floor: 'Floor 2',
      roomType: 'general',
      ratePerDay: 120
    });

    const rPriv = await Room.create({
      roomNumber: 'PVT-302',
      building: 'Wing C',
      floor: 'Floor 3',
      roomType: 'private',
      ratePerDay: 300
    });

    await Bed.create({
      bedNumber: 'ICU-101-A',
      room: rICU._id,
      status: 'occupied',
      currentPatient: pat1._id,
      assignedDate: new Date(Date.now() - 36 * 3600000)
    });

    await Bed.create({
      bedNumber: 'ICU-101-B',
      room: rICU._id,
      status: 'available'
    });

    await Bed.create({
      bedNumber: 'WARD-204-1',
      room: rGen._id,
      status: 'available'
    });

    await Bed.create({
      bedNumber: 'WARD-204-2',
      room: rGen._id,
      status: 'occupied',
      currentPatient: pat3._id,
      assignedDate: new Date(Date.now() - 24 * 3600000)
    });

    await Bed.create({
      bedNumber: 'PVT-302-A',
      room: rPriv._id,
      status: 'available'
    });

    console.log('🛏️ Seeded Rooms and Beds.\n');

    // 9. Seed Medicines
    await Medicine.insertMany([
      {
        medicineId: 'MED-001',
        name: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin',
        category: 'Antibiotic',
        manufacturer: 'Pfizer',
        batchNumber: 'BTH-A001',
        expiryDate: new Date('2027-12-31'),
        quantity: 15,
        unitPrice: 12.5,
        minStockLevel: 25,
        location: 'Shelf A',
        dailyAvgUsage: 5,
        status: 'low_stock'
      },
      {
        medicineId: 'MED-002',
        name: 'Paracetamol 650mg',
        genericName: 'Acetaminophen',
        category: 'Analgesic',
        manufacturer: 'GSK',
        batchNumber: 'BTH-P002',
        expiryDate: new Date('2028-06-30'),
        quantity: 450,
        unitPrice: 4.0,
        minStockLevel: 100,
        location: 'Shelf B',
        dailyAvgUsage: 20,
        status: 'in_stock'
      },
      {
        medicineId: 'MED-003',
        name: 'Atorvastatin 20mg',
        genericName: 'Atorvastatin',
        category: 'Cardiovascular',
        manufacturer: 'Novartis',
        batchNumber: 'BTH-AT03',
        expiryDate: new Date('2027-09-15'),
        quantity: 18,
        unitPrice: 24.0,
        minStockLevel: 30,
        location: 'Shelf C',
        dailyAvgUsage: 4,
        status: 'low_stock'
      },
      {
        medicineId: 'MED-004',
        name: 'Metformin 500mg',
        genericName: 'Metformin',
        category: 'Diabetes',
        manufacturer: 'Merck',
        batchNumber: 'BTH-M004',
        expiryDate: new Date('2028-03-20'),
        quantity: 220,
        unitPrice: 8.5,
        minStockLevel: 80,
        location: 'Shelf A',
        dailyAvgUsage: 12,
        status: 'in_stock'
      },
      {
        medicineId: 'MED-005',
        name: 'Omeprazole 20mg',
        genericName: 'Omeprazole',
        category: 'Gastrointestinal',
        manufacturer: 'AstraZeneca',
        batchNumber: 'BTH-O005',
        expiryDate: new Date('2027-11-10'),
        quantity: 8,
        unitPrice: 15.0,
        minStockLevel: 20,
        location: 'Shelf D',
        dailyAvgUsage: 3,
        status: 'low_stock'
      },
      {
        medicineId: 'MED-006',
        name: 'Insulin Glargine 100IU',
        genericName: 'Insulin Glargine',
        category: 'Diabetes',
        manufacturer: 'Sanofi',
        batchNumber: 'BTH-INS06',
        expiryDate: new Date('2026-11-30'),
        quantity: 5,
        unitPrice: 45.0,
        minStockLevel: 15,
        location: 'Refrigerated Bay 1',
        dailyAvgUsage: 2,
        status: 'low_stock'
      }
    ]);

    console.log('💊 Seeded Pharmacy Catalog.\n');

    // 10. Seed Bills
    await Bill.create({
      billId: 'INV-109281',
      patient: pat1._id,
      items: [
        { description: 'Cardiology Specialist Consultation', category: 'consultation', amount: 150, quantity: 1 },
        { description: 'Complete Lipid Profile Panel', category: 'laboratory', amount: 65, quantity: 1 },
        { description: 'Atorvastatin 20mg (30 Tablets)', category: 'medicine', amount: 24, quantity: 1 }
      ],
      subtotal: 239,
      discount: 20,
      tax: 15,
      totalAmount: 234,
      paidAmount: 234,
      balance: 0,
      status: 'paid',
      dueDate: new Date(Date.now() + 7 * 86400000),
      invoiceDate: new Date()
    });

    await Bill.create({
      billId: 'INV-109282',
      patient: pat2._id,
      items: [
        { description: 'Neurology Consultation', category: 'consultation', amount: 140, quantity: 1 },
        { description: 'Complete Blood Count (CBC)', category: 'laboratory', amount: 35, quantity: 1 }
      ],
      subtotal: 175,
      discount: 0,
      tax: 10,
      totalAmount: 185,
      paidAmount: 0,
      balance: 185,
      status: 'pending',
      dueDate: new Date(Date.now() + 10 * 86400000),
      invoiceDate: new Date()
    });

    console.log('💳 Seeded Invoices & Billing.\n');

    // 11. Seed Notifications
    await Notification.create({
      recipient: patient1User._id,
      title: 'Lab Report Ready',
      message: 'Your Complete Lipid Profile test result is now available for review.',
      type: 'lab',
      read: false
    });

    await Notification.create({
      recipient: doctor1User._id,
      title: 'New Appointment Scheduled',
      message: 'Robert Chen booked an appointment for Cardiology at 09:30 AM.',
      type: 'appointment',
      read: true
    });

    await Notification.create({
      recipient: adminUser._id,
      title: 'Low Stock Alert',
      message: 'Omeprazole 20mg inventory has dropped to 8 units (Threshold: 20).',
      type: 'stock',
      read: false
    });

    console.log('🔔 Seeded Notifications.\n');

    // 12. Seed Audit Logs
    await AuditLog.create({
      user: adminUser._id,
      userName: adminUser.name,
      userRole: adminUser.role,
      action: 'SYSTEM_BOOT',
      entity: 'System',
      description: 'Hospital SaaS platform database initialized with baseline datasets.',
      timestamp: new Date()
    });

    console.log('🛡️ Seeded Audit Logs.\n');

    console.log('======================================================');
    console.log('✅ COMPLETE COMPREHENSIVE SEEDING SUCCEEDED!');
    console.log('');
    console.log(' 🔑 Demo Credentials (Password for all: password123)');
    console.log(' ➤ Admin:       admin@smarthospital.org');
    console.log(' ➤ Doctor:      doctor@smarthospital.org');
    console.log(' ➤ Patient:     patient@smarthospital.org');
    console.log(' ➤ Reception:   reception@smarthospital.org');
    console.log(' ➤ Lab:         lab@smarthospital.org');
    console.log(' ➤ Pharmacy:    pharmacy@smarthospital.org');
    console.log(' ➤ Nurse:       nurse@smarthospital.org');
    console.log('======================================================\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

seedDatabase();
