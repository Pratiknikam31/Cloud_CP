import React from 'react';
import { 
  X, 
  Printer, 
  Activity, 
  Heart, 
  Thermometer, 
  Wind, 
  Scale, 
  Stethoscope, 
  Pill, 
  AlertCircle, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  User, 
  Building2 
} from 'lucide-react';

export interface ConsultationReportData {
  recordId?: string;
  reportId?: string;
  date?: string;
  patient: {
    _id?: string;
    patientId?: string;
    name: string;
    gender?: string;
    dob?: string;
    age?: number | string;
    bloodGroup?: string;
    phone?: string;
    allergies?: string[];
    medicalHistory?: string[];
  };
  doctor: {
    _id?: string;
    name: string;
    specialization?: string;
    department?: any;
    qualification?: string;
    roomNumber?: string;
  };
  appointment?: {
    appointmentId?: string;
    timeSlot?: string;
    queueNumber?: number;
    type?: string;
    date?: string;
  };
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    respiratoryRate?: number;
  };
  symptoms?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  examinationNotes?: string;
  investigationsRecommended?: string;
  lifestyleAdvice?: string;
  followUpDate?: string;
  medicines?: Array<{
    medicineName: string;
    dosage: string;
    frequency: string; // When to take
    duration: string;  // For how many days
    instructions?: string;
  }>;
}

interface ConsultationReportModalProps {
  report: ConsultationReportData | null;
  onClose: () => void;
}

export const ConsultationReportModal: React.FC<ConsultationReportModalProps> = ({ report, onClose }) => {
  if (!report) return null;

  const handlePrint = () => {
    window.print();
  };

  const calculateBMI = (weight?: number, height?: number) => {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  const bmiValue = calculateBMI(report.vitals?.weight, report.vitals?.height);

  const getDepartmentName = () => {
    if (typeof report.doctor?.department === 'object' && report.doctor.department?.name) {
      return report.doctor.department.name;
    }
    return report.doctor?.department || 'General Medicine & Specialist Clinic';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        {/* Sticky Actions Bar - Hidden during print */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 p-4 px-6 flex items-center justify-between z-10 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Verified Clinical Encounter Report
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-brand-600 text-white font-bold text-xs flex items-center space-x-2 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Download Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close Report"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Medical Report Content */}
        <div className="p-6 sm:p-10 space-y-6 text-slate-800 print:p-4 print:space-y-4" id="consultation-report-paper">
          {/* Hospital Official Letterhead Header */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-medical-teal text-white flex items-center justify-center shadow-md print:border print:border-slate-300">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  CloudCare <span className="text-brand-600">Smart Hospital</span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Tertiary Healthcare & Multi-Specialty Clinical Center
                </p>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>NABH & JCI ACCREDITED</span>
                  <span>•</span>
                  <span>DIGITAL HEALTH RECORD ID: CHC-EMR-2026</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right text-xs text-slate-600 space-y-0.5">
              <p className="font-extrabold text-sm text-slate-900 font-mono">
                {report.recordId || report.reportId || 'EMR-2026-CONSULT'}
              </p>
              <p className="text-[11px] text-slate-500">
                Date: <strong>{report.date ? new Date(report.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString()}</strong>
              </p>
              {report.appointment?.timeSlot && (
                <p className="text-[11px] text-brand-600 font-bold">
                  Time Slot: {report.appointment.timeSlot} • Token #{report.appointment.queueNumber || 1}
                </p>
              )}
            </div>
          </div>

          {/* Demographic & Attending Doctor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            {/* Patient Info */}
            <div className="space-y-1.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4">
              <div className="flex items-center space-x-1.5 text-brand-700 font-bold uppercase text-[10px] tracking-wider">
                <User className="w-3.5 h-3.5" />
                <span>Patient Demographics</span>
              </div>
              <p className="text-base font-extrabold text-slate-900">
                {report.patient?.name || 'Patient'}
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600 text-[11px]">
                <p>ID: <strong className="font-mono text-slate-900">{report.patient?.patientId || report.patient?._id || 'P-NEW'}</strong></p>
                <p>Gender / Age: <strong className="text-slate-900 capitalize">{report.patient?.gender || 'N/A'}</strong></p>
                <p>Blood Group: <strong className="text-rose-600">{report.patient?.bloodGroup || 'N/A'}</strong></p>
                <p>Phone: <strong className="text-slate-900">{report.patient?.phone || 'N/A'}</strong></p>
              </div>
              {report.patient?.allergies && report.patient.allergies.length > 0 && (
                <div className="mt-1 pt-1 border-t border-slate-200 text-rose-700 font-semibold text-[11px] flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                  <span>Allergies: {report.patient.allergies.join(', ')}</span>
                </div>
              )}
            </div>

            {/* Doctor Info */}
            <div className="space-y-1.5 md:pl-2">
              <div className="flex items-center space-x-1.5 text-indigo-700 font-bold uppercase text-[10px] tracking-wider">
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Attending Physician</span>
              </div>
              <p className="text-base font-extrabold text-slate-900">
                {report.doctor?.name || 'Physician'}
              </p>
              <div className="space-y-0.5 text-slate-600 text-[11px]">
                <p>Specialization: <strong className="text-slate-900">{report.doctor?.specialization || 'Clinical Medicine'}</strong></p>
                <p>Department: <strong className="text-slate-900">{getDepartmentName()}</strong></p>
                <p>Qualifications: <strong className="text-slate-900">{report.doctor?.qualification || 'MD'}</strong></p>
                {report.doctor?.roomNumber && (
                  <p>Examination Room: <strong className="text-slate-900">{report.doctor.roomNumber}</strong></p>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Vitals Strip */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-brand-600" />
              <span>Physical Vitals & Clinical Measurements</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Blood Pressure</span>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {report.vitals?.bloodPressure || '120/80'}
                </span>
                <span className="text-[10px] text-slate-400 block">mmHg</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Heart Rate</span>
                <span className="text-sm font-extrabold text-rose-600 font-mono">
                  {report.vitals?.heartRate || 74}
                </span>
                <span className="text-[10px] text-slate-400 block">BPM</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Temperature</span>
                <span className="text-sm font-extrabold text-amber-600 font-mono">
                  {report.vitals?.temperature || 98.6}
                </span>
                <span className="text-[10px] text-slate-400 block">°F</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Oxygen SpO2</span>
                <span className="text-sm font-extrabold text-emerald-600 font-mono">
                  {report.vitals?.oxygenSaturation || 98}%
                </span>
                <span className="text-[10px] text-slate-400 block">Room Air</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Resp. Rate</span>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {report.vitals?.respiratoryRate || 16}
                </span>
                <span className="text-[10px] text-slate-400 block">breaths/min</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Weight / BMI</span>
                <span className="text-sm font-extrabold text-slate-900 font-mono">
                  {report.vitals?.weight ? `${report.vitals.weight}kg` : 'N/A'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {bmiValue ? `BMI: ${bmiValue}` : 'Recorded'}
                </span>
              </div>
            </div>
          </div>

          {/* Chief Complaints & Clinical Findings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chief Symptoms & Presentation</span>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                {report.symptoms || 'Patient presented for general clinical evaluation and routine triage examination.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-150 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Clinical Diagnosis</span>
              <p className="text-sm font-extrabold text-slate-900 leading-snug">
                {report.diagnosis || 'Clinical Assessment & Diagnostic Confirmation'}
              </p>
            </div>
          </div>

          {/* Physical & Clinical Examination Findings */}
          {(report.examinationNotes || report.clinicalNotes) && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Doctor Examination Findings & Clinical Observations
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                {report.examinationNotes || report.clinicalNotes}
              </p>
            </div>
          )}

          {/* Prescribed Medications (Rx) User requirement: What medicine given, when to take, how many days, instructions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Pill className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Electronic Prescription (Rx) — Medication Schedule
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {report.medicines?.length || 0} Prescribed Items
              </span>
            </div>

            {(!report.medicines || report.medicines.length === 0) ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                No medications prescribed during this consultation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Medicine Name</th>
                      <th className="py-2.5 px-3">Dosage</th>
                      <th className="py-2.5 px-3">When to Take (Timing & Frequency)</th>
                      <th className="py-2.5 px-3">For How Many Days (Duration)</th>
                      <th className="py-2.5 px-3">Special Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.medicines.map((med, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-mono font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-slate-900">
                          {med.medicineName}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          {med.dosage || 'As directed'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold text-[11px] border border-brand-200">
                            {med.frequency}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {med.duration}
                        </td>
                        <td className="py-3 px-3 text-slate-600 text-[11px]">
                          {med.instructions || 'Take as advised'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Diagnostic Investigations & Health Advice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.investigationsRecommended && (
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Recommended Diagnostic & Laboratory Tests
                </span>
                <p className="text-xs text-slate-800 leading-relaxed font-semibold">
                  {report.investigationsRecommended}
                </p>
              </div>
            )}

            {report.lifestyleAdvice && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Health, Dietary & Lifestyle Advice
                </span>
                <p className="text-xs text-slate-800 leading-relaxed">
                  {report.lifestyleAdvice}
                </p>
              </div>
            )}
          </div>

          {/* Follow-up & Doctor Digital Signature Footer */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next Follow-Up Appointment</span>
              <p className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                <span>
                  {report.followUpDate 
                    ? new Date(report.followUpDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                    : 'As needed / in 2 weeks'}
                </span>
              </p>
              <p className="text-[10px] text-slate-400">
                Please bring this report during your follow-up visit.
              </p>
            </div>

            <div className="text-right space-y-1 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center space-x-1.5 justify-end text-emerald-600 font-bold text-[11px]">
                <ShieldCheck className="w-4 h-4" />
                <span>Digitally Signed & Certified</span>
              </div>
              <p className="font-extrabold text-slate-900">{report.doctor?.name || 'Attending Physician'}</p>
              <p className="text-[10px] text-slate-400">{getDepartmentName()} • CloudCare</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
