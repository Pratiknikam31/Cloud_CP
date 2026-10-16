import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Calendar
} from 'lucide-react';
import { patientApi, emrApi, doctorApi } from '../../api/hospitalApi';
import { useAuth } from '../../context/AuthContext';

export const EMRConsultation: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [existingRecords, setExistingRecords] = useState<any[]>([]);

  const [diagnosis, setDiagnosis] = useState('Stage 1 Hypertension & Exertional Angina');
  const [symptoms, setSymptoms] = useState('Episodic substernal tightness on exertion, mild palpitations');
  const [clinicalNotes, setClinicalNotes] = useState('Advised low sodium diet, 30 min daily walking, daily morning BP journaling.');
  const [followUpDate, setFollowUpDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );

  // Vitals
  const [vitals, setVitals] = useState({
    bloodPressure: '138/88',
    heartRate: 78,
    temperature: 98.4,
    oxygenSaturation: 98,
    weight: 78,
    height: 175
  });

  // Prescribed Medicines
  const [medicines, setMedicines] = useState([
    { medicineName: 'Atorvastatin 20mg', dosage: '20mg', frequency: '0-0-1 (Night)', duration: '30 Days', instructions: 'Take after dinner' },
    { medicineName: 'Amlodipine 5mg', dosage: '5mg', frequency: '1-0-0 (Morning)', duration: '30 Days', instructions: 'Take with breakfast' },
  ]);

  const [newMed, setNewMed] = useState({ medicineName: '', dosage: '', frequency: '1-0-1', duration: '7 Days', instructions: '' });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const [patRes, docRes] = await Promise.all([
          patientApi.getAll(),
          doctorApi.getAll()
        ]);

        const fetchedPatients = patRes.patients || patRes.data?.patients || [];
        const fetchedDocs = docRes.doctors || docRes.data?.doctors || [];

        setPatients(fetchedPatients);
        setDoctors(fetchedDocs);

        const paramPatientId = searchParams.get('patientId');
        if (paramPatientId) {
          setSelectedPatientId(paramPatientId);
        } else if (fetchedPatients.length > 0) {
          setSelectedPatientId(fetchedPatients[0]._id);
        }

        if (fetchedDocs.length > 0) {
          setSelectedDoctorId(fetchedDocs[0]._id);
        }
      } catch (err) {
        console.error('Failed to load patients/doctors:', err);
      }
    };
    init();
  }, [searchParams]);

  // Load existing records when patient changes
  useEffect(() => {
    if (!selectedPatientId) return;
    emrApi.getRecords({ patientId: selectedPatientId })
      .then((res) => {
        if (res.data?.records) setExistingRecords(res.data.records);
      })
      .catch(() => {});
  }, [selectedPatientId]);

  const selectedPatient = patients.find(p => p._id === selectedPatientId);

  const addMedicine = () => {
    if (!newMed.medicineName) return;
    setMedicines([...medicines, newMed]);
    setNewMed({ medicineName: '', dosage: '', frequency: '1-0-1', duration: '7 Days', instructions: '' });
  };

  const removeMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleSaveEMR = async () => {
    if (!selectedPatientId || !selectedDoctorId) {
      setErrorMessage('Please select patient and consulting doctor.');
      return;
    }
    setSaving(true);
    setErrorMessage('');

    try {
      // 1. Create medical record
      const recordRes = await emrApi.createRecord({
        patient: selectedPatientId,
        doctor: selectedDoctorId,
        symptoms,
        diagnosis,
        clinicalNotes,
        vitals: {
          bloodPressure: vitals.bloodPressure,
          heartRate: Number(vitals.heartRate),
          temperature: Number(vitals.temperature),
          oxygenSaturation: Number(vitals.oxygenSaturation),
          weight: Number(vitals.weight),
          height: Number(vitals.height)
        },
        followUpDate
      });

      // 2. Create prescription if medicines added
      if (medicines.length > 0) {
        await emrApi.createPrescription({
          patient: selectedPatientId,
          doctor: selectedDoctorId,
          medicalRecord: recordRes.data?.record?._id,
          medicines: medicines.map(m => ({
            medicineName: m.medicineName,
            dosage: m.dosage || '1 unit',
            frequency: m.frequency || 'Daily',
            duration: m.duration || '7 Days',
            instructions: m.instructions || 'As directed'
          })),
          notes: clinicalNotes
        });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 5000);

      // Refresh patient records
      emrApi.getRecords({ patientId: selectedPatientId }).then((res) => {
        if (res.data?.records) setExistingRecords(res.data.records);
      });
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || err.message || 'Error saving EMR record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Electronic Medical Record (EMR) Consultation
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Capture clinical vitals, differential diagnosis, clinical narrative, and electronic prescription.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition flex items-center space-x-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Consultation Pass</span>
          </button>

          <button
            onClick={handleSaveEMR}
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-medical-teal hover:opacity-95 text-white font-bold text-sm shadow-md transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Encounter & Rx</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Encounter record and electronic prescription successfully written to database!</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Patient & Attending Doctor Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Patient</label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
          >
            {patients.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.patientId}) — {p.bloodGroup} • {p.gender}
              </option>
            ))}
          </select>
          {selectedPatient && (
            <div className="text-xs text-slate-500 pt-1 flex flex-wrap gap-4">
              <span>Allergies: <strong className="text-rose-600">{selectedPatient.allergies?.join(', ') || 'None reported'}</strong></span>
              <span>History: <strong className="text-slate-800">{selectedPatient.medicalHistory?.join(', ') || 'None'}</strong></span>
            </div>
          )}
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Attending Physician</label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50"
          >
            {doctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} — {d.specialization} (Room {d.roomNumber})
              </option>
            ))}
          </select>
          <div className="text-xs text-slate-500 pt-1">
            <span>Encounter Date: <strong className="text-slate-800">{new Date().toLocaleDateString()}</strong></span>
          </div>
        </div>
      </div>

      {/* Clinical Vitals Strip */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
          <Activity className="w-5 h-5 text-brand-600" />
          <span>Patient Physical Vitals</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Blood Pressure</span>
            <input
              type="text"
              value={vitals.bloodPressure}
              onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
              className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none"
              placeholder="120/80"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Heart Rate (BPM)</span>
            <input
              type="number"
              value={vitals.heartRate}
              onChange={(e) => setVitals({ ...vitals, heartRate: Number(e.target.value) })}
              className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Temperature (°F)</span>
            <input
              type="number"
              step="0.1"
              value={vitals.temperature}
              onChange={(e) => setVitals({ ...vitals, temperature: Number(e.target.value) })}
              className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Oxygen (SpO2 %)</span>
            <input
              type="number"
              value={vitals.oxygenSaturation}
              onChange={(e) => setVitals({ ...vitals, oxygenSaturation: Number(e.target.value) })}
              className="w-full mt-1 font-bold text-emerald-600 text-sm bg-transparent outline-none"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Weight (kg)</span>
            <input
              type="number"
              value={vitals.weight}
              onChange={(e) => setVitals({ ...vitals, weight: Number(e.target.value) })}
              className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Height (cm)</span>
            <input
              type="number"
              value={vitals.height}
              onChange={(e) => setVitals({ ...vitals, height: Number(e.target.value) })}
              className="w-full mt-1 font-bold text-slate-900 text-sm bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Clinical Notes & Diagnosis */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
          <Stethoscope className="w-5 h-5 text-indigo-600" />
          <span>Diagnostic Evaluation & Clinical Assessment</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Chief Symptoms</label>
            <textarea
              rows={3}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Primary Diagnosis</label>
            <textarea
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Clinical Narrative & Lifestyle Plan</label>
          <textarea
            rows={2}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="max-w-xs">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Follow-up Date</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium"
          />
        </div>
      </div>

      {/* Prescription Medication Items */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
          <Pill className="w-5 h-5 text-purple-600" />
          <span>Electronic Prescription (Rx)</span>
        </h3>

        {/* Existing prescribed items */}
        <div className="space-y-2">
          {medicines.map((med, index) => (
            <div key={index} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-extrabold text-slate-900 text-sm">{med.medicineName}</span>
                <span className="text-slate-500 ml-2">({med.dosage})</span>
                <p className="text-slate-600">{med.frequency} • {med.duration} — {med.instructions}</p>
              </div>
              <button
                type="button"
                onClick={() => removeMedicine(index)}
                className="p-2 text-slate-400 hover:text-rose-600 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add item inputs */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <input
            type="text"
            placeholder="Medicine name"
            value={newMed.medicineName}
            onChange={(e) => setNewMed({ ...newMed, medicineName: e.target.value })}
            className="p-2.5 rounded-xl border border-slate-200 font-medium"
          />
          <input
            type="text"
            placeholder="Dosage (e.g. 500mg)"
            value={newMed.dosage}
            onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
            className="p-2.5 rounded-xl border border-slate-200 font-medium"
          />
          <input
            type="text"
            placeholder="Frequency (e.g. 1-0-1)"
            value={newMed.frequency}
            onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
            className="p-2.5 rounded-xl border border-slate-200 font-medium"
          />
          <input
            type="text"
            placeholder="Duration (e.g. 14 Days)"
            value={newMed.duration}
            onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
            className="p-2.5 rounded-xl border border-slate-200 font-medium"
          />
          <button
            type="button"
            onClick={addMedicine}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-brand-600 text-white font-bold flex items-center justify-center space-x-1 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Med</span>
          </button>
        </div>
      </div>
    </div>
  );
};
