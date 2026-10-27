import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Stethoscope, 
  Calendar, 
  User, 
  Search, 
  RefreshCw, 
  Printer, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Pill, 
  Activity, 
  Building2,
  Filter,
  Eye,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { emrApi, doctorApi, patientApi } from '../../api/hospitalApi';
import { ConsultationReportModal, ConsultationReportData } from '../../components/reports/ConsultationReportModal';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
  const isDoctor = user?.role === 'doctor';

  // Consultation Reports Data
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('all');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState('all');

  // Modal & Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ConsultationReportData | null>(null);

  const fetchReportsData = async () => {
    try {
      setRefreshing(true);
      const [recRes, rxRes, docRes] = await Promise.all([
        emrApi.getRecords({ all: isDoctor ? 'true' : undefined, limit: 100 }).catch(() => ({ records: [] })),
        emrApi.getPrescriptions({ all: isDoctor ? 'true' : undefined, limit: 100 }).catch(() => ({ prescriptions: [] })),
        doctorApi.getAll().catch(() => ({ doctors: [] }))
      ]);

      const fetchedRecords = recRes.records || recRes.data?.records || [];
      const fetchedRxs = rxRes.prescriptions || rxRes.data?.prescriptions || [];
      const fetchedDoctors = docRes.doctors || docRes.data?.doctors || [];

      setMedicalRecords(fetchedRecords);
      setPrescriptions(fetchedRxs);
      setDoctors(fetchedDoctors);

      // If doctor/admin, fetch patient list for filters
      if (!isPatient) {
        patientApi.getAll().then((res) => {
          setPatients(res.patients || res.data?.patients || []);
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load consultation reports data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReportsData();
  }, [user]);

  // Merge each Medical Record with its corresponding prescription
  const unifiedConsultationReports = medicalRecords.map((record) => {
    // Find matching prescription by medicalRecord link or same patient and doctor around date
    const recPatientId = typeof record.patient === 'object' ? record.patient?._id : record.patient;
    const recDoctorId = typeof record.doctor === 'object' ? record.doctor?._id : record.doctor;

    const matchedRx = prescriptions.find((rx) => {
      if (rx.medicalRecord && rx.medicalRecord === record._id) return true;
      const rxPatientId = typeof rx.patient === 'object' ? rx.patient?._id : rx.patient;
      const rxDoctorId = typeof rx.doctor === 'object' ? rx.doctor?._id : rx.doctor;
      return rxPatientId === recPatientId && rxDoctorId === recDoctorId;
    });

    return {
      ...record,
      medicines: matchedRx?.medicines || record.medicines || []
    };
  });

  // Filter consultation reports based on search, doctor filter, and patient filter
  const filteredConsultationReports = unifiedConsultationReports.filter((report) => {
    const patientName = typeof report.patient === 'object' ? report.patient?.name : '';
    const patientId = typeof report.patient === 'object' ? report.patient?.patientId : '';
    const doctorName = typeof report.doctor === 'object' ? report.doctor?.name : '';
    const doctorId = typeof report.doctor === 'object' ? report.doctor?._id : report.doctor;
    const patientObjId = typeof report.patient === 'object' ? report.patient?._id : report.patient;
    const diagnosisText = report.diagnosis || '';

    const matchesSearch = 
      patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patientId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doctorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      diagnosisText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.recordId?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDoctor = selectedDoctorFilter === 'all' || doctorId === selectedDoctorFilter;
    const matchesPatient = selectedPatientFilter === 'all' || patientObjId === selectedPatientFilter;

    return matchesSearch && matchesDoctor && matchesPatient;
  });

  // Open modal with formatted report
  const handleOpenReportModal = (record: any) => {
    const reportData: ConsultationReportData = {
      recordId: record.recordId,
      date: record.date,
      patient: typeof record.patient === 'object' ? record.patient : { name: 'Patient' },
      doctor: typeof record.doctor === 'object' ? record.doctor : { name: 'Physician' },
      vitals: record.vitals,
      symptoms: record.symptoms,
      diagnosis: record.diagnosis,
      clinicalNotes: record.clinicalNotes,
      examinationNotes: record.examinationNotes,
      investigationsRecommended: record.investigationsRecommended,
      lifestyleAdvice: record.lifestyleAdvice,
      followUpDate: record.followUpDate,
      medicines: record.medicines || []
    };

    setSelectedReport(reportData);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Consultation Report Viewer Modal */}
      <ConsultationReportModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />

      {/* Header Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold uppercase tracking-wider">
              {isPatient ? 'Personal Medical Portal' : 'Official Clinical Records'}
            </span>
            {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            {isPatient ? 'My Doctor Consultation Reports' : 'Doctor Consultation Reports'}
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            {isPatient 
              ? 'Review reports generated by your attending physicians with complete vitals, clinical observations, and detailed medication instructions.'
              : 'Review, search, and print official clinical consultation encounters, prescription regimens, and patient medical reports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchReportsData}
            className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-750 transition cursor-pointer shadow-xs"
            title="Refresh Reports"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
          </button>

          {isDoctor && (
            <button
              onClick={() => window.location.href = '/doctor/consultations'}
              className="px-5 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs flex items-center space-x-2 shadow-md transition cursor-pointer"
            >
              <Stethoscope className="w-4 h-4" />
              <span>New Patient Consultation</span>
            </button>
          )}
        </div>
      </div>

      {/* Controls & Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Doctor Consultation Reports
              </h2>
              <span className="text-xs text-slate-500">
                Showing {filteredConsultationReports.length} of {unifiedConsultationReports.length} Reports
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search diagnosis, patient, doctor, report ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Doctor & Patient Dropdown Filters (For Doctors & Admins) */}
        {!isPatient && (
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="font-bold text-slate-400 uppercase text-[11px] flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter By:</span>
            </span>

            {/* Doctor Filter */}
            <select
              value={selectedDoctorFilter}
              onChange={(e) => setSelectedDoctorFilter(e.target.value)}
              className="p-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Attending Doctors ({doctors.length})</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.specialization})
                </option>
              ))}
            </select>

            {/* Patient Filter */}
            {patients.length > 0 && (
              <select
                value={selectedPatientFilter}
                onChange={(e) => setSelectedPatientFilter(e.target.value)}
                className="p-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Patients ({patients.length})</option>
                {patients.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.patientId})
                  </option>
                ))}
              </select>
            )}

            {(selectedDoctorFilter !== 'all' || selectedPatientFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedDoctorFilter('all');
                  setSelectedPatientFilter('all');
                  setSearchQuery('');
                }}
                className="text-[11px] text-brand-600 font-bold hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* DOCTOR CONSULTATION REPORTS LIST                               */}
      {/* ============================================================== */}
      <div className="space-y-4">
        {filteredConsultationReports.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3 shadow-xs">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-extrabold text-slate-700">No Consultation Reports Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {isPatient 
                ? 'No clinical consultation reports have been generated for your profile yet. Once your doctor completes your consultation, your official report will appear here.'
                : 'No consultation reports matched the selected filters. Use the Patient Consultation console to conduct a patient encounter and generate reports.'}
            </p>
            {isDoctor && (
              <button
                onClick={() => window.location.href = '/doctor/consultations'}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs inline-flex items-center space-x-1.5 transition cursor-pointer shadow-xs mt-2"
              >
                <Stethoscope className="w-4 h-4" />
                <span>Start Patient Consultation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredConsultationReports.map((report) => {
              const patientName = typeof report.patient === 'object' ? report.patient?.name : 'Patient';
              const patientId = typeof report.patient === 'object' ? report.patient?.patientId || report.patient?._id : report.patient;
              const patientObj = typeof report.patient === 'object' ? report.patient : null;
              const doctorName = typeof report.doctor === 'object' ? report.doctor?.name : 'Physician';
              const doctorSpec = typeof report.doctor === 'object' ? report.doctor?.specialization : 'Specialist';
              const dateFormatted = report.date 
                ? new Date(report.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Recent Encounter';

              const medCount = report.medicines?.length || 0;

              return (
                <div
                  key={report._id}
                  className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md hover:border-brand-200 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-4">
                    {/* Top Header Strip */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-brand-600 text-xs">
                            {report.recordId || 'EMR-RECORD'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                          {dateFormatted}
                        </span>
                      </div>

                      <button
                        onClick={() => handleOpenReportModal(report)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                        title="Print or view report"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Doctor & Patient Information */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 text-xs">
                      {/* Patient info */}
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient</span>
                        <p className="font-extrabold text-slate-900 truncate">{patientName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{patientId}</p>
                        {patientObj?.bloodGroup && (
                          <span className="text-[10px] text-rose-600 font-bold block">
                            Blood: {patientObj.bloodGroup}
                          </span>
                        )}
                      </div>

                      {/* Doctor info */}
                      <div className="space-y-0.5 border-l border-slate-200 pl-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attending Doctor</span>
                        <p className="font-extrabold text-slate-900 truncate">{doctorName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{doctorSpec}</p>
                      </div>
                    </div>

                    {/* Clinical Diagnosis Box */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Diagnosis</span>
                      <p className="font-extrabold text-sm text-slate-900 leading-snug">
                        {report.diagnosis || 'Clinical Consultation'}
                      </p>
                    </div>

                    {/* Vitals Summary Strip */}
                    {report.vitals && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {report.vitals.bloodPressure && (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold">
                            BP: {report.vitals.bloodPressure}
                          </span>
                        )}
                        {report.vitals.heartRate && (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 font-mono font-bold">
                            HR: {report.vitals.heartRate} bpm
                          </span>
                        )}
                        {report.vitals.oxygenSaturation && (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-mono font-bold">
                            SpO2: {report.vitals.oxygenSaturation}%
                          </span>
                        )}
                        {report.vitals.temperature && (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-mono font-bold">
                            Temp: {report.vitals.temperature}°F
                          </span>
                        )}
                      </div>
                    )}

                    {/* Prescription & Medicines Count Preview */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="font-bold text-purple-700 flex items-center space-x-1.5">
                        <Pill className="w-3.5 h-3.5 text-purple-600" />
                        <span>{medCount} Prescribed Medicine{medCount !== 1 ? 's' : ''}</span>
                      </span>

                      {report.followUpDate && (
                        <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Follow-up: {new Date(report.followUpDate).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenReportModal(report)}
                      className="w-full py-2.5 rounded-xl bg-slate-900 group-hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View & Print Official Medical Report</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
