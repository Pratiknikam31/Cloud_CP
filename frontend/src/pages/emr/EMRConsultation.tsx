import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Stethoscope, 
  User, 
  Activity, 
  Pill, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Printer, 
  FlaskConical, 
  FileText,
  Save,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  ChevronRight,
  Building2,
  Check,
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { patientApi, emrApi, doctorApi, appointmentApi } from '../../api/hospitalApi';
import { getMeApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { ConsultationReportModal, ConsultationReportData } from '../../components/reports/ConsultationReportModal';

export const EMRConsultation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Core Data
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [appointments, setAllAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>('');

  // Clinical Consultation Form State
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [examinationNotes, setExaminationNotes] = useState('');
  const [investigationsRecommended, setInvestigationsRecommended] = useState('');
  const [lifestyleAdvice, setLifestyleAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );

  // Vitals State
  const [vitals, setVitals] = useState({
    bloodPressure: '120/80',
    heartRate: 74,
    temperature: 98.6,
    oxygenSaturation: 98,
    respiratoryRate: 16,
    weight: 70,
    height: 172
  });

  // Prescribed Medicines State: user requested what medicine, when to take, how many days, instructions
  const [medicines, setMedicines] = useState<Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>>([
    {
      medicineName: 'Amoxicillin 500mg Capsule',
      dosage: '1 Capsule (500mg)',
      frequency: 'Morning & Night after meals (1-0-1)',
      duration: '7 Days',
      instructions: 'Take after meals with warm water'
    },
    {
      medicineName: 'Paracetamol 650mg Tablet',
      dosage: '1 Tablet (650mg)',
      frequency: 'As needed for fever/pain (SOS)',
      duration: '5 Days',
      instructions: 'Maintain 6 hours interval between doses'
    }
  ]);

  // New Medicine Input State
  const [newMed, setNewMed] = useState({
    medicineName: '',
    dosage: '1 Tablet (500mg)',
    frequency: 'Morning & Night after meals (1-0-1)',
    duration: '7 Days',
    instructions: 'Take after meals'
  });

  // Processing & Feedback State
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedReport, setGeneratedReport] = useState<ConsultationReportData | null>(null);

  // Initialize Doctors, Appointments, and Patients
  useEffect(() => {
    const init = async () => {
      try {
        const isPatient = user?.role === 'patient';
        const [docRes, aptRes, patRes] = await Promise.all([
          doctorApi.getAll().catch(() => ({ doctors: [] })),
          appointmentApi.getAll({ all: 'true', limit: 100 }).catch(() => ({ appointments: [] })),
          isPatient
            ? getMeApi().then((me) => ({ patients: me.profile ? [me.profile] : [] })).catch(() => ({ patients: [] }))
            : patientApi.getAll().catch(() => ({ patients: [] }))
        ]);

        const fetchedDocs = docRes.doctors || docRes.data?.doctors || [];
        const fetchedApts = aptRes.appointments || aptRes.data?.appointments || [];
        const fetchedPatients = patRes.patients || patRes.data?.patients || [];

        setDoctors(fetchedDocs);
        setAllAppointments(fetchedApts);
        setPatients(fetchedPatients);

        // Pre-select Doctor
        const paramDocId = searchParams.get('doctorId');
        if (paramDocId && fetchedDocs.some((d: any) => d._id === paramDocId)) {
          setSelectedDoctorId(paramDocId);
        } else if (fetchedDocs.length > 0) {
          // If logged in user is a doctor, default to their profile
          const matchedDoc = fetchedDocs.find((d: any) => 
            d.email === user?.email || (typeof d.user === 'object' ? d.user?._id === user?.id : d.user === user?.id)
          );
          setSelectedDoctorId(matchedDoc ? matchedDoc._id : fetchedDocs[0]._id);
        }

        // Pre-select Patient & Appointment from query params
        const paramPatientId = searchParams.get('patientId');
        const paramAptId = searchParams.get('appointmentId');
        if (paramPatientId) setSelectedPatientId(paramPatientId);
        if (paramAptId) setSelectedAppointmentId(paramAptId);

      } catch (err) {
        console.error('Failed to initialize consultation view:', err);
      }
    };

    init();
  }, [searchParams, user]);

  // Selected Doctor Object
  const selectedDoctor = doctors.find(d => d._id === selectedDoctorId) || doctors[0];

  // Filter Booked Patients for Selected Doctor
  const doctorBookedAppointments = appointments.filter(a => {
    const aptDocId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
    const isDocMatch = aptDocId === selectedDoctor?._id;
    const isPending = a.status === 'pending' || a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_consultation';
    return isDocMatch && isPending;
  });

  // When selected doctor changes, if no patient selected yet or current patient doesn't belong to this doctor's appointments, auto-select first booked patient
  useEffect(() => {
    if (!selectedDoctorId) return;

    if (!selectedPatientId && doctorBookedAppointments.length > 0) {
      const firstApt = doctorBookedAppointments[0];
      const pId = typeof firstApt.patient === 'object' ? firstApt.patient?._id : firstApt.patient;
      setSelectedPatientId(pId);
      setSelectedAppointmentId(firstApt._id);
      if (firstApt.symptoms) {
        setSymptoms(firstApt.symptoms);
      }
    }
  }, [selectedDoctorId, doctorBookedAppointments.length]);

  // When patient is selected from appointment click
  const handleSelectBookedPatient = (apt: any) => {
    const pId = typeof apt.patient === 'object' ? apt.patient?._id : apt.patient;
    setSelectedPatientId(pId);
    setSelectedAppointmentId(apt._id);
    if (apt.symptoms) {
      setSymptoms(apt.symptoms);
    }
  };

  // Resolve full patient object
  const selectedPatient = patients.find(p => p._id === selectedPatientId) || 
    doctorBookedAppointments.find(a => (typeof a.patient === 'object' ? a.patient?._id : a.patient) === selectedPatientId)?.patient;

  // Selected Appointment Object
  const selectedAppointment = appointments.find(a => a._id === selectedAppointmentId);

  // Add Medicine to Rx list
  const addMedicine = () => {
    if (!newMed.medicineName.trim()) {
      setErrorMessage('Please enter a medicine name.');
      return;
    }
    setMedicines([...medicines, { ...newMed }]);
    setNewMed({
      medicineName: '',
      dosage: '1 Tablet (500mg)',
      frequency: 'Morning & Night after meals (1-0-1)',
      duration: '7 Days',
      instructions: 'Take after meals'
    });
    setErrorMessage('');
  };

  // Remove medicine
  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  // Quick preset suggestions for doctor convenience
  const handleAddQuickMed = (medObj: { name: string; dosage: string; freq: string; dur: string; inst: string }) => {
    setMedicines(prev => [
      ...prev,
      {
        medicineName: medObj.name,
        dosage: medObj.dosage,
        frequency: medObj.freq,
        duration: medObj.dur,
        instructions: medObj.inst
      }
    ]);
  };

  // Calculate BMI
  const calculateBMI = () => {
    if (!vitals.weight || !vitals.height) return null;
    const heightInMeters = vitals.height / 100;
    const bmi = vitals.weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  // CREATE & GENERATE CONSULTATION REPORT
  const handleGenerateReport = async () => {
    if (!selectedPatientId || !selectedDoctorId) {
      setErrorMessage('Please select both the attending doctor and the patient.');
      return;
    }

    if (!diagnosis.trim()) {
      setErrorMessage('Please enter a clinical diagnosis for the patient.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      // 1. Create EMR Medical Record
      const recordRes = await emrApi.createRecord({
        patient: selectedPatientId,
        doctor: selectedDoctorId,
        appointment: selectedAppointmentId || undefined,
        symptoms: symptoms || 'Clinical examination and general consultation',
        diagnosis: diagnosis.trim(),
        clinicalNotes: clinicalNotes || 'Clinical consultation conducted. Patient examined and advised.',
        examinationNotes: examinationNotes || 'Conscious, oriented, vital signs recorded and stable.',
        investigationsRecommended: investigationsRecommended || 'None at this time.',
        lifestyleAdvice: lifestyleAdvice || 'Maintain healthy hydration and balanced nutrition.',
        vitals: {
          bloodPressure: vitals.bloodPressure || '120/80',
          heartRate: Number(vitals.heartRate || 72),
          temperature: Number(vitals.temperature || 98.6),
          oxygenSaturation: Number(vitals.oxygenSaturation || 98),
          respiratoryRate: Number(vitals.respiratoryRate || 16),
          weight: Number(vitals.weight || 70),
          height: Number(vitals.height || 170)
        },
        followUpDate
      });

      const createdRecord = recordRes.record ?? recordRes.data?.record;

      // 2. Create Prescription with complete medicine details
      if (medicines.length > 0) {
        await emrApi.createPrescription({
          patient: selectedPatientId,
          doctor: selectedDoctorId,
          medicalRecord: createdRecord?._id,
          medicines: medicines.map(m => ({
            medicineName: m.medicineName,
            dosage: m.dosage || '1 dose',
            frequency: m.frequency || 'Daily',
            duration: m.duration || '7 Days',
            instructions: m.instructions || 'Take as advised'
          })),
          notes: clinicalNotes
        });
      }

      // 3. Update appointment status to completed if appointment was linked
      if (selectedAppointmentId) {
        try {
          await appointmentApi.updateStatus(selectedAppointmentId, 'completed', 'Consultation finished and report generated.');
          setAllAppointments(prev =>
            prev.map(a => a._id === selectedAppointmentId ? { ...a, status: 'completed' } : a)
          );
        } catch (e) {
          console.warn('Appointment status update note:', e);
        }
      }

      // 4. Construct complete generated report object to open modal immediately
      const reportPayload: ConsultationReportData = {
        recordId: createdRecord?.recordId || `EMR-${Date.now()}`,
        date: new Date().toISOString(),
        patient: {
          _id: selectedPatient?._id || selectedPatientId,
          patientId: selectedPatient?.patientId || 'P-RECORD',
          name: selectedPatient?.name || 'Patient',
          gender: selectedPatient?.gender || 'N/A',
          bloodGroup: selectedPatient?.bloodGroup || 'N/A',
          phone: selectedPatient?.phone,
          allergies: selectedPatient?.allergies,
          medicalHistory: selectedPatient?.medicalHistory
        },
        doctor: {
          _id: selectedDoctor?._id || selectedDoctorId,
          name: selectedDoctor?.name || 'Physician',
          specialization: selectedDoctor?.specialization,
          department: selectedDoctor?.department,
          qualification: selectedDoctor?.qualification,
          roomNumber: selectedDoctor?.roomNumber
        },
        appointment: selectedAppointment ? {
          appointmentId: selectedAppointment.appointmentId,
          timeSlot: selectedAppointment.timeSlot,
          queueNumber: selectedAppointment.queueNumber,
          type: selectedAppointment.type,
          date: selectedAppointment.date
        } : undefined,
        vitals: { ...vitals },
        symptoms,
        diagnosis,
        clinicalNotes,
        examinationNotes,
        investigationsRecommended,
        lifestyleAdvice,
        followUpDate,
        medicines: [...medicines]
      };

      setGeneratedReport(reportPayload);
      setSavedSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Error generating consultation report.');
    } finally {
      setSaving(false);
    }
  };

  const bmi = calculateBMI();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Consultation Report Modal */}
      <ConsultationReportModal
        report={generatedReport}
        onClose={() => setGeneratedReport(null)}
      />

      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <span>Clinical Care</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-brand-600">Patient Consultation & Report Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Doctor Patient Consultation
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Select attending physician & booked patient, capture clinical examination, vitals, prescriptions, and generate official medical reports.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/doctor/dashboard"
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition shadow-xs flex items-center space-x-1.5"
          >
            <span>Doctor Dashboard</span>
          </Link>

          <Link
            to="/doctor/lab-reports"
            className="px-4 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition border border-purple-200 flex items-center space-x-1.5"
          >
            <FileText className="w-4 h-4" />
            <span>View All Reports</span>
          </Link>
        </div>
      </div>

      {/* Success Notification Alert */}
      {savedSuccess && (
        <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-extrabold text-base">Medical Consultation Report Successfully Created!</p>
              <p className="text-xs text-emerald-700 font-normal mt-0.5">
                The report is now officially saved and visible in the Doctor Reports section and the Patient's Report portal.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => generatedReport && setGeneratedReport({ ...generatedReport })}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer flex items-center space-x-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Preview / Print Report</span>
            </button>
            <button
              onClick={() => navigate('/doctor/lab-reports')}
              className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs hover:bg-emerald-100/50 transition cursor-pointer"
            >
              <span>Go to Reports</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 1: SELECT ATTENDING DOCTOR                                */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white font-extrabold text-xs flex items-center justify-center">
              1
            </span>
            <h3 className="font-extrabold text-slate-900 text-base">
              Select Attending Doctor
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {doctors.length} Physicians Available
          </span>
        </div>

        {/* Doctor Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {doctors.map((doc) => {
            const isSelected = selectedDoctor?._id === doc._id;
            const deptName = typeof doc.department === 'object' && doc.department?.name 
              ? doc.department.name 
              : 'Specialist';

            // Booked appointment count for this doctor
            const aptCount = appointments.filter(a => {
              const aDocId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
              const isMatch = aDocId === doc._id;
              const isPending = a.status === 'pending' || a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_consultation';
              return isMatch && isPending;
            }).length;

            return (
              <div
                key={doc._id}
                onClick={() => {
                  setSelectedDoctorId(doc._id);
                  // Reset patient if switching doctor to force pick from that doctor's booked list
                  setSelectedPatientId('');
                  setSelectedAppointmentId('');
                }}
                className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-brand-50/60 border-brand-500 shadow-sm ring-2 ring-brand-500/20'
                    : 'bg-slate-50/50 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-medical-teal text-white font-black text-sm flex items-center justify-center shrink-0">
                    {doc.name?.replace('Dr. ', '').charAt(0) || 'D'}
                  </div>
                  <div className="truncate">
                    <p className="font-extrabold text-xs text-slate-900 truncate">{doc.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{deptName} • Rm {doc.roomNumber}</p>
                  </div>
                </div>

                <div className="shrink-0 pl-2 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    aptCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {aptCount} Booked
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* STEP 2: SELECT BOOKED PATIENT FOR THIS DOCTOR                  */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white font-extrabold text-xs flex items-center justify-center">
              2
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Patients with Booked Appointments for {selectedDoctor?.name || 'Selected Doctor'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click on any booked patient below to load their clinical profile and start the consultation.
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-xl bg-brand-50 text-brand-700 font-extrabold text-xs border border-brand-200">
            {doctorBookedAppointments.length} In Queue
          </span>
        </div>

        {doctorBookedAppointments.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-3">
            <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <p className="font-bold text-slate-700 text-sm">No booked appointments awaiting consultation for this doctor right now.</p>
              <p className="text-slate-400 text-xs mt-1">You can select any registered patient from the directory below or switch to another doctor.</p>
            </div>
            
            {/* Fallback Registered Patient Selector */}
            <div className="max-w-md mx-auto pt-2">
              <select
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setSelectedAppointmentId('');
                }}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white shadow-xs outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Choose Walk-In / Registered Patient --</option>
                {patients.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.patientId}) — {p.gender} • Blood Group: {p.bloodGroup}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {doctorBookedAppointments.map((apt) => {
              const pId = typeof apt.patient === 'object' ? apt.patient?._id : apt.patient;
              const pName = typeof apt.patient === 'object' ? apt.patient?.name : 'Patient';
              const pCode = typeof apt.patient === 'object' ? apt.patient?.patientId : pId;
              const isSelected = selectedPatientId === pId;

              return (
                <div
                  key={apt._id}
                  onClick={() => handleSelectBookedPatient(apt)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-brand-50/70 border-brand-500 shadow-md ring-2 ring-brand-500/20'
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-600 text-white font-mono font-extrabold text-xs">
                        Token #{apt.queueNumber || 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{apt.timeSlot || '09:30 AM'}</span>
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">{pName}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">{pCode}</p>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 bg-white/70 p-2 rounded-lg border border-slate-100">
                      <strong>Complaint:</strong> {apt.symptoms || 'General clinical review'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-150 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-brand-600 capitalize">
                      {apt.status?.replace('_', ' ')}
                    </span>
                    <span className="text-slate-400 font-medium">Click to Consult →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* STEP 3: CLINICAL CONSULTATION & REPORT FORM                    */}
      {/* ============================================================== */}
      {selectedPatient && (
        <div className="space-y-6">
          {/* Active Patient Details Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white shadow-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500 to-medical-teal text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                {selectedPatient.name?.charAt(0) || 'P'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-extrabold text-white">{selectedPatient.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[10px] font-mono font-bold">
                    {selectedPatient.patientId || selectedPatient._id}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                  <span>Gender: <strong className="text-white capitalize">{selectedPatient.gender || 'N/A'}</strong></span>
                  <span>Blood Group: <strong className="text-rose-400">{selectedPatient.bloodGroup || 'N/A'}</strong></span>
                  <span>Phone: <strong className="text-white">{selectedPatient.phone || 'N/A'}</strong></span>
                  {selectedAppointment?.timeSlot && (
                    <span>Slot: <strong className="text-brand-300">{selectedAppointment.timeSlot}</strong></span>
                  )}
                </div>
              </div>
            </div>

            {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
              <div className="px-3.5 py-2 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Allergies: {selectedPatient.allergies.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Section 1: Physical Vitals Strip */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                <Activity className="w-5 h-5 text-brand-600" />
                <span>Patient Physical Vitals & Diagnostic Measurements</span>
              </h3>
              {bmi && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Calculated BMI: {bmi} kg/m²
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Blood Pressure</span>
                <input
                  type="text"
                  value={vitals.bloodPressure}
                  onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                  className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none font-mono"
                  placeholder="120/80"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Heart Rate (BPM)</span>
                <input
                  type="number"
                  value={vitals.heartRate}
                  onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
                  className="w-full mt-1 font-bold text-rose-600 text-sm bg-transparent outline-none font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Temperature (°F)</span>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.temperature}
                  onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
                  className="w-full mt-1 font-bold text-amber-600 text-sm bg-transparent outline-none font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">SpO2 Oxygen (%)</span>
                <input
                  type="number"
                  value={vitals.oxygenSaturation}
                  onChange={(e) => setVitals({ ...vitals, oxygenSaturation: Number(e.target.value) })}
                  className="w-full mt-1 font-bold text-emerald-600 text-sm bg-transparent outline-none font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Resp. Rate (/min)</span>
                <input
                  type="number"
                  value={vitals.respiratoryRate}
                  onChange={(e) => setVitals({ ...vitals, respiratoryRate: Number(e.target.value) })}
                  className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Weight (kg)</span>
                <input
                  type="number"
                  value={vitals.weight}
                  onChange={(e) => setVitals({ ...vitals, weight: Number(e.target.value) })}
                  className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Height (cm)</span>
                <input
                  type="number"
                  value={vitals.height}
                  onChange={(e) => setVitals({ ...vitals, height: Number(e.target.value) })}
                  className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Chief Complaints & Clinical Findings */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-indigo-600" />
              <span>Chief Symptoms & Doctor Physical Examination</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Chief Complaint & Reason for Visit
                </label>
                <textarea
                  rows={3}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Acute sore throat, persistent dry cough, moderate fever for 3 days..."
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Physical & Systemic Examination Observations
                </label>
                <textarea
                  rows={3}
                  value={examinationNotes}
                  onChange={(e) => setExaminationNotes(e.target.value)}
                  placeholder="e.g. Pharyngeal congestion present, tonsillar erythema, lungs clear bilaterally, S1/S2 heard..."
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Diagnostic Assessment & Recommended Lab Tests */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
              <FlaskConical className="w-5 h-5 text-amber-600" />
              <span>Clinical Diagnosis & Recommended Investigations</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Clinical Diagnosis <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Pharyngitis & Upper Respiratory Infection"
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-extrabold text-slate-900 outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Recommended Diagnostic & Laboratory Tests
                </label>
                <input
                  type="text"
                  value={investigationsRecommended}
                  onChange={(e) => setInvestigationsRecommended(e.target.value)}
                  placeholder="e.g. Complete Blood Count (CBC), Rapid Strep Test, Chest X-Ray"
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Clinical Narrative & Case Notes
              </label>
              <textarea
                rows={2}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Doctor's clinical assessment, risk evaluation, and progress narrative..."
                className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
              />
            </div>
          </div>

          {/* Section 4: Electronic Prescription (Rx) with Complete Dosage, Timing, Duration */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-purple-600" />
                  <span>Electronic Prescription (Rx) — Medication & Dosage Regimen</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify medicine name, exact dosage, when to take, duration (days), and special instructions.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 font-extrabold text-xs border border-purple-200">
                {medicines.length} Medicines in Rx
              </span>
            </div>

            {/* Quick Suggestions Strip */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase">Quick Add:</span>
              <button
                type="button"
                onClick={() => handleAddQuickMed({
                  name: 'Amoxicillin 500mg Capsule',
                  dosage: '1 Capsule (500mg)',
                  freq: 'Morning & Night after meals (1-0-1)',
                  dur: '7 Days',
                  inst: 'Take after meals with warm water'
                })}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 font-semibold transition shrink-0 cursor-pointer"
              >
                + Amoxicillin 500mg
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickMed({
                  name: 'Paracetamol 650mg Tablet',
                  dosage: '1 Tablet (650mg)',
                  freq: 'As needed for fever/pain (SOS)',
                  dur: '5 Days',
                  inst: 'Minimum 6 hours gap between doses'
                })}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 font-semibold transition shrink-0 cursor-pointer"
              >
                + Paracetamol 650mg
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickMed({
                  name: 'Pantoprazole 40mg Tablet',
                  dosage: '1 Tablet (40mg)',
                  freq: 'Once daily in morning empty stomach (1-0-0)',
                  dur: '14 Days',
                  inst: 'Take 30 mins before breakfast'
                })}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 font-semibold transition shrink-0 cursor-pointer"
              >
                + Pantoprazole 40mg
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickMed({
                  name: 'Cetirizine 10mg Tablet',
                  dosage: '1 Tablet (10mg)',
                  freq: 'Once daily at bedtime after dinner (0-0-1)',
                  dur: '5 Days',
                  inst: 'May cause mild drowsiness'
                })}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 font-semibold transition shrink-0 cursor-pointer"
              >
                + Cetirizine 10mg
              </button>
            </div>

            {/* List of Added Medicines */}
            <div className="space-y-2.5">
              {medicines.map((med, index) => (
                <div 
                  key={index} 
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-purple-200 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-slate-900 text-sm">{med.medicineName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[10px]">
                        {med.dosage}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 text-[11px]">
                      <span>When to take: <strong className="text-brand-700 font-bold">{med.frequency}</strong></span>
                      <span>Duration: <strong className="text-slate-900 font-bold">{med.duration}</strong></span>
                      {med.instructions && (
                        <span>Instructions: <em>{med.instructions}</em></span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMedicine(index)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer self-end sm:self-center"
                    title="Remove medicine"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Medicine Inputs */}
            <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-150 space-y-3">
              <span className="text-[11px] font-extrabold text-purple-800 uppercase tracking-wider block">
                Add New Medicine to Prescription
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <div className="lg:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Medicine Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Azithromycin 500mg"
                    value={newMed.medicineName}
                    onChange={(e) => setNewMed({ ...newMed, medicineName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dosage</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 Tablet (500mg)"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">When to Take (Timing)</label>
                  <select
                    value={newMed.frequency}
                    onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
                  >
                    <option value="Morning & Night after meals (1-0-1)">Morning & Night after meals (1-0-1)</option>
                    <option value="Three times daily after meals (1-1-1)">Three times daily after meals (1-1-1)</option>
                    <option value="Once daily in morning empty stomach (1-0-0)">Once daily morning empty stomach (1-0-0)</option>
                    <option value="Once daily at bedtime after dinner (0-0-1)">Once daily at bedtime (0-0-1)</option>
                    <option value="Every 8 hours with water">Every 8 hours with water</option>
                    <option value="As needed for fever/pain (SOS)">As needed for fever/pain (SOS)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duration (How many days)</label>
                  <select
                    value={newMed.duration}
                    onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-semibold outline-none focus:ring-2 focus:ring-purple-500 text-slate-800"
                  >
                    <option value="3 Days">3 Days</option>
                    <option value="5 Days">5 Days</option>
                    <option value="7 Days">7 Days</option>
                    <option value="10 Days">10 Days</option>
                    <option value="14 Days">14 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="Ongoing / Chronic">Ongoing / Chronic</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addMedicine}
                    className="w-full p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Rx</span>
                  </button>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Special instructions (e.g. Take with warm water, avoid dairy, finish entire course)"
                  value={newMed.instructions}
                  onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Health & Lifestyle Advice & Follow-Up Date */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Health Advice, Dietary Instructions & Next Visit</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Health, Nutritional & Dietary Advice
                </label>
                <textarea
                  rows={3}
                  value={lifestyleAdvice}
                  onChange={(e) => setLifestyleAdvice(e.target.value)}
                  placeholder="e.g. Drink 2.5L warm water daily, avoid oily/spicy foods, complete 3 days vocal rest..."
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Follow-Up Review Date
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Patient will be prompted to book their follow-up appointment around this date.
                </p>
              </div>
            </div>
          </div>

          {/* FINAL ACTION: GENERATE REPORT BUTTON */}
          <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-black text-lg">Ready to Finalize Consultation?</h4>
              <p className="text-slate-400 text-xs mt-0.5">
                Clicking the button will sign and write the consultation encounter & prescription to the database, generate the official report, and mark appointment as completed.
              </p>
            </div>

            <button
              onClick={handleGenerateReport}
              disabled={saving}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-500 to-medical-teal hover:opacity-95 text-white font-extrabold text-sm shadow-lg shadow-brand-500/25 transition flex items-center space-x-2.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating Official Report...</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span>Create & Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
