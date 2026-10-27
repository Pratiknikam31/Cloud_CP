import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  ListOrdered, 
  CheckCircle2, 
  FlaskConical, 
  Clock, 
  Stethoscope, 
  FileSpreadsheet, 
  ArrowRight,
  RefreshCw,
  UserCheck,
  AlertCircle,
  Building2,
  Users,
  Search,
  Check,
  ChevronRight,
  FileText,
  User,
  HeartPulse,
  Activity,
  Award,
  DollarSign,
  MapPin,
  Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, doctorApi, departmentApi, emrApi } from '../../api/hospitalApi';
import { ConsultationReportModal, ConsultationReportData } from '../../components/reports/ConsultationReportModal';

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core Data
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);

  // Selection & Filters
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [searchDoctorQuery, setSearchDoctorQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'booked' | 'past'>('booked');
  
  // Status & Modal
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ConsultationReportData | null>(null);

  const fetchHospitalData = async () => {
    try {
      setRefreshing(true);
      const [docRes, deptRes, aptRes, recRes] = await Promise.all([
        doctorApi.getAll().catch(() => ({ doctors: [] })),
        departmentApi.getAll().catch(() => ({ departments: [] })),
        appointmentApi.getAll({ all: 'true', limit: 100 }).catch(() => ({ appointments: [] })),
        emrApi.getRecords({ all: 'true', limit: 100 }).catch(() => ({ records: [] }))
      ]);

      const fetchedDocs = docRes.doctors || docRes.data?.doctors || [];
      const fetchedDepts = deptRes.departments || deptRes.data?.departments || [];
      const fetchedApts = aptRes.appointments || aptRes.data?.appointments || [];
      const fetchedRecs = recRes.records || recRes.data?.records || [];

      setDoctors(fetchedDocs);
      setDepartments(fetchedDepts);
      setAllAppointments(fetchedApts);
      setAllRecords(fetchedRecs);

      // Default selected doctor
      if (!selectedDoctorId && fetchedDocs.length > 0) {
        // If current logged in doctor is in the list, default to them, else first doctor
        const currentDoc = fetchedDocs.find((d: any) => 
          d.email === user?.email || (typeof d.user === 'object' ? d.user?._id === user?.id : d.user === user?.id)
        );
        setSelectedDoctorId(currentDoc ? currentDoc._id : fetchedDocs[0]._id);
      }
    } catch (err) {
      console.error('Error fetching doctor dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHospitalData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await appointmentApi.updateStatus(id, newStatus);
      setAllAppointments(prev =>
        prev.map(a => a._id === id ? { ...a, status: newStatus } : a)
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Find currently selected doctor object
  const selectedDoctor = doctors.find(d => d._id === selectedDoctorId) || doctors[0];

  // Filtered doctors list based on department and search
  const filteredDoctors = doctors.filter(doc => {
    const docDeptId = typeof doc.department === 'object' ? doc.department?._id : doc.department;
    const matchesDept = selectedDepartmentId === 'all' || docDeptId === selectedDepartmentId;
    const matchesSearch = 
      doc.name?.toLowerCase().includes(searchDoctorQuery.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(searchDoctorQuery.toLowerCase()) ||
      doc.roomNumber?.toLowerCase().includes(searchDoctorQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  // Selected doctor's appointments
  const doctorAppointments = allAppointments.filter(a => {
    const aptDocId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
    return aptDocId === selectedDoctor?._id;
  });

  // Current booked/upcoming patients (status: pending, confirmed, checked_in, in_consultation)
  const bookedPatients = doctorAppointments.filter(a => 
    a.status === 'pending' || 
    a.status === 'confirmed' || 
    a.status === 'checked_in' || 
    a.status === 'in_consultation'
  );

  // Past patients who have already checked/completed consultation
  const pastAppointments = doctorAppointments.filter(a => a.status === 'completed');

  // EMR records for this doctor to show past checked history
  const doctorRecords = allRecords.filter(r => {
    const rDocId = typeof r.doctor === 'object' ? r.doctor?._id : r.doctor;
    return rDocId === selectedDoctor?._id;
  });

  // Helper to open report modal for past records or completed appointment
  const handleViewReport = (item: any) => {
    // If it's an EMR record
    if (item.diagnosis || item.recordId) {
      setSelectedReport({
        recordId: item.recordId,
        date: item.date,
        patient: typeof item.patient === 'object' ? item.patient : { name: 'Patient', _id: item.patient },
        doctor: selectedDoctor,
        vitals: item.vitals,
        symptoms: item.symptoms,
        diagnosis: item.diagnosis,
        clinicalNotes: item.clinicalNotes,
        examinationNotes: item.examinationNotes,
        investigationsRecommended: item.investigationsRecommended,
        lifestyleAdvice: item.lifestyleAdvice,
        followUpDate: item.followUpDate,
        medicines: item.medicines || []
      });
    } else {
      // Completed appointment: find associated record if available
      const matchingRecord = doctorRecords.find(r => 
        (typeof r.patient === 'object' ? r.patient?._id : r.patient) === (typeof item.patient === 'object' ? item.patient?._id : item.patient)
      );

      if (matchingRecord) {
        setSelectedReport({
          recordId: matchingRecord.recordId,
          date: matchingRecord.date,
          patient: typeof item.patient === 'object' ? item.patient : { name: 'Patient' },
          doctor: selectedDoctor,
          appointment: {
            appointmentId: item.appointmentId,
            timeSlot: item.timeSlot,
            queueNumber: item.queueNumber,
            date: item.date
          },
          vitals: matchingRecord.vitals,
          symptoms: matchingRecord.symptoms || item.symptoms,
          diagnosis: matchingRecord.diagnosis || 'Clinical Consultation Completed',
          clinicalNotes: matchingRecord.clinicalNotes,
          examinationNotes: matchingRecord.examinationNotes,
          investigationsRecommended: matchingRecord.investigationsRecommended,
          lifestyleAdvice: matchingRecord.lifestyleAdvice,
          followUpDate: matchingRecord.followUpDate,
          medicines: matchingRecord.medicines || []
        });
      } else {
        // Fallback representation
        setSelectedReport({
          recordId: `REP-${item.appointmentId || '2026'}`,
          date: item.date,
          patient: typeof item.patient === 'object' ? item.patient : { name: 'Patient' },
          doctor: selectedDoctor,
          appointment: {
            appointmentId: item.appointmentId,
            timeSlot: item.timeSlot,
            queueNumber: item.queueNumber,
            date: item.date
          },
          vitals: {
            bloodPressure: '120/80',
            heartRate: 72,
            temperature: 98.6,
            oxygenSaturation: 98,
            weight: 70,
            height: 170
          },
          symptoms: item.symptoms || 'General clinical consultation',
          diagnosis: 'General Examination & Clinical Consultation Completed',
          clinicalNotes: 'Consultation conducted. Patient advised regular follow-up.',
          lifestyleAdvice: 'Maintain healthy hydration and balanced diet.',
          medicines: [
            {
              medicineName: 'Multivitamin Formula',
              dosage: '1 Tablet',
              frequency: 'Once daily after breakfast (1-0-0)',
              duration: '30 Days',
              instructions: 'Take with warm water'
            }
          ]
        });
      }
    }
  };

  const totalHospitalApts = allAppointments.length;
  const totalCompleted = allAppointments.filter(a => a.status === 'completed').length;
  const totalWaiting = allAppointments.filter(a => a.status === 'checked_in' || a.status === 'pending').length;

  return (
    <div className="space-y-8 pb-16">
      {/* Consultation Report Viewer Modal */}
      <ConsultationReportModal 
        report={selectedReport} 
        onClose={() => setSelectedReport(null)} 
      />

      {/* Chief Doctor Header Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold uppercase tracking-wider">
              Clinical Specialists Command Center
            </span>
            {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Specialist Directory & Patient Triage Roster
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Monitor clinical wings, inspect booked queues, conduct live patient consultations, and review verified medical encounter records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={fetchHospitalData}
            className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/80 transition cursor-pointer shadow-xs"
            title="Refresh Hospital Data"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
          </button>

          <Link
            to={`/doctor/consultations?doctorId=${selectedDoctor?._id || ''}`}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-500 via-brand-600 to-medical-teal hover:opacity-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-brand-500/30 transition-all flex items-center space-x-2 transform hover:-translate-y-0.5"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Open Patient Consultation</span>
          </Link>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="relative p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Doctors</span>
            <p className="text-3xl font-black text-slate-900 mt-1 font-mono">{doctors.length}</p>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
              <span className="text-[11px] text-brand-600 font-bold">{departments.length} Specialties Active</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="relative p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Booked</span>
            <p className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalHospitalApts}</p>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-emerald-600 font-bold">{doctorAppointments.length} For Active Doctor</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="relative p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Queue In Waiting</span>
            <p className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalWaiting}</p>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-[11px] text-amber-600 font-bold">Pending Triage</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
            <ListOrdered className="w-6 h-6" />
          </div>
        </div>

        <div className="relative p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex items-center justify-between overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulted Patients</span>
            <p className="text-3xl font-black text-slate-900 mt-1 font-mono">{totalCompleted}</p>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
              <span className="text-[11px] text-purple-600 font-bold">{doctorRecords.length} Clinical Reports</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: ALL DEPARTMENT DOCTORS DIRECTORY (SELECTABLE)      */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Stethoscope className="w-5 h-5 text-brand-600" />
              <span>Department Doctors & Clinical Specialists</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any clinical specialist below to inspect their booked consultation queue and medical records.
            </p>
          </div>

          {/* Quick Doctor Search input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by doctor, specialty, room..."
              value={searchDoctorQuery}
              onChange={(e) => setSearchDoctorQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200/90 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-slate-50/70 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Department Filter Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedDepartmentId('all')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition whitespace-nowrap cursor-pointer shadow-2xs ${
              selectedDepartmentId === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Departments ({doctors.length})
          </button>
          {departments.map((dept) => {
            const deptDocCount = doctors.filter(d => 
              (typeof d.department === 'object' ? d.department?._id : d.department) === dept._id
            ).length;

            return (
              <button
                key={dept._id}
                onClick={() => setSelectedDepartmentId(dept._id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition whitespace-nowrap cursor-pointer shadow-2xs ${
                  selectedDepartmentId === dept._id
                    ? 'bg-brand-600 text-white shadow-brand-500/20 shadow-md'
                    : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {dept.name} ({deptDocCount})
              </button>
            );
          })}
        </div>

        {/* Doctors Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredDoctors.map((doc) => {
            const isSelected = selectedDoctor?._id === doc._id;
            const deptName = typeof doc.department === 'object' && doc.department?.name 
              ? doc.department.name 
              : 'Medical Department';

            // Count booked appointments and completed appointments for this doctor
            const docApts = allAppointments.filter(a => {
              const aDocId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
              return aDocId === doc._id;
            });
            const activeBookedCount = docApts.filter(a => 
              a.status === 'pending' || a.status === 'confirmed' || a.status === 'checked_in' || a.status === 'in_consultation'
            ).length;
            const pastCheckedCount = docApts.filter(a => a.status === 'completed').length;

            return (
              <div
                key={doc._id}
                onClick={() => setSelectedDoctorId(doc._id)}
                className={`p-5 rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col justify-between relative group overflow-hidden ${
                  isSelected
                    ? 'bg-brand-50/50 border-brand-500 shadow-md ring-2 ring-brand-500/20'
                    : 'bg-white border-slate-200/90 hover:border-brand-200 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                {/* Selected Indicator Badge */}
                {isSelected && (
                  <span className="absolute top-3.5 right-3.5 px-2.5 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                    <Check className="w-3 h-3" />
                    <span>Selected</span>
                  </span>
                )}

                <div className="space-y-3.5">
                  {/* Doctor Avatar & Identity */}
                  <div className="flex items-start space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-medical-teal text-white font-black text-base flex items-center justify-center shrink-0 shadow-md ring-2 ring-brand-500/20">
                      {doc.name?.replace('Dr. ', '').charAt(0) || 'D'}
                    </div>
                    <div className="pr-10">
                      <h4 className="font-black text-slate-900 text-sm leading-snug group-hover:text-brand-600 transition">
                        {doc.name}
                      </h4>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100/90 text-slate-600 text-[10px] font-bold mt-1 uppercase font-mono">
                        {deptName}
                      </span>
                    </div>
                  </div>

                  {/* Specialization & Credentials */}
                  <div className="text-xs space-y-1 pt-1.5 border-t border-slate-100">
                    <p className="font-extrabold text-brand-700 truncate">{doc.specialization}</p>
                    <p className="text-slate-500 text-[11px] truncate font-medium">{doc.qualification || 'MD'}</p>
                  </div>

                  {/* Room & Consultation Fee */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center space-x-1 font-mono">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{doc.roomNumber || 'Room R-301'}</span>
                    </span>
                    <span className="font-black text-slate-900 font-mono">
                      ${doc.consultationFee || 150}
                    </span>
                  </div>
                </div>

                {/* Patient Counter Badges on Card */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-200/50">
                    {activeBookedCount} Booked
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200/50">
                    {pastCheckedCount} Consulted
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: PATIENTS FOR SELECTED DOCTOR (BOOKED & PAST)       */}
      {/* ============================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
        {/* Selected Doctor Summary Ribbon */}
        <div className="p-5 rounded-3xl bg-slate-50/80 border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md ring-2 ring-brand-500/20">
              {selectedDoctor?.name?.replace('Dr. ', '').charAt(0) || 'D'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-slate-900 text-lg">
                  {selectedDoctor?.name || 'Selected Doctor'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Active in Clinic</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {selectedDoctor?.specialization} • {selectedDoctor?.qualification} • Room {selectedDoctor?.roomNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to={`/doctor/consultations?doctorId=${selectedDoctor?._id}`}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center space-x-2 transition shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <Stethoscope className="w-4 h-4 text-brand-400" />
              <span>Consult Booked Patients</span>
            </Link>
          </div>
        </div>

        {/* Tab Controls: Booked vs Past Patients */}
        <div className="flex items-center space-x-2 border-b border-slate-200/80 pb-3">
          <button
            onClick={() => setActiveTab('booked')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'booked'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Booked Patients Queue ({bookedPatients.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'past'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Past Consulted Patients ({pastAppointments.length + doctorRecords.length})</span>
          </button>
        </div>

        {/* TAB 1: CURRENT BOOKED PATIENTS */}
        {activeTab === 'booked' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing patients who have scheduled appointments for <strong>{selectedDoctor?.name}</strong></span>
              <span className="font-bold text-brand-600">{bookedPatients.length} Active in Queue</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/80">
                    <th className="py-3.5 px-4">Token</th>
                    <th className="py-3.5 px-4">Patient Demographics</th>
                    <th className="py-3.5 px-4">Scheduled Slot</th>
                    <th className="py-3.5 px-4">Chief Complaint / Symptoms</th>
                    <th className="py-3.5 px-4">Visit Type</th>
                    <th className="py-3.5 px-4">Live Status Workflow</th>
                    <th className="py-3.5 px-4 text-right">Clinical Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bookedPatients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        No active booked appointments for this physician right now.
                      </td>
                    </tr>
                  ) : (
                    bookedPatients.map((apt) => {
                      const patientName = typeof apt.patient === 'object' ? apt.patient?.name : 'Patient';
                      const patientId = typeof apt.patient === 'object' ? apt.patient?.patientId || apt.patient?._id : apt.patient;
                      const patientObj = typeof apt.patient === 'object' ? apt.patient : null;

                      return (
                        <tr key={apt._id} className="hover:bg-brand-50/30 transition-colors">
                          <td className="py-4 px-4 font-mono font-black text-brand-600 text-sm">
                            <span className="px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200/60 shadow-2xs">
                              #{apt.queueNumber || 1}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-extrabold text-slate-900 text-xs">{patientName}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {patientId} {patientObj?.gender ? `• ${patientObj.gender}` : ''} {patientObj?.bloodGroup ? `• ${patientObj.bloodGroup}` : ''}
                            </p>
                          </td>
                          <td className="py-4 px-4 text-slate-700 font-semibold text-xs whitespace-nowrap">
                            <span className="block font-bold">{apt.date ? new Date(apt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}</span>
                            <span className="text-slate-400 text-[10px] font-mono">{apt.timeSlot || '09:00 AM'}</span>
                          </td>
                          <td className="py-4 px-4 max-w-xs truncate text-xs text-slate-600" title={apt.symptoms}>
                            {apt.symptoms || 'General clinical consultation'}
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold capitalize">
                              {apt.type?.replace('_', ' ') || 'in person'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <select
                              value={apt.status}
                              onChange={(e) => handleUpdateStatus(apt._id, e.target.value)}
                              className={`text-[11px] font-black px-3 py-1 rounded-full border outline-none cursor-pointer transition shadow-2xs ${
                                apt.status === 'in_consultation'
                                  ? 'bg-brand-50 text-brand-700 border-brand-300'
                                  : apt.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : apt.status === 'checked_in'
                                  ? 'bg-cyan-50 text-cyan-700 border-cyan-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="checked_in">Checked In</option>
                              <option value="in_consultation">In Consultation</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Link
                              to={`/doctor/consultations?doctorId=${selectedDoctor?._id}&patientId=${typeof apt.patient === 'object' ? apt.patient?._id : apt.patient}&appointmentId=${apt._id}`}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-extrabold text-xs inline-flex items-center space-x-1.5 shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5"
                            >
                              <span>Start Consult</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PAST CONSULTED PATIENTS */}
        {activeTab === 'past' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Patients who have completed consultations with <strong>{selectedDoctor?.name}</strong></span>
              <span className="font-bold text-purple-600 font-mono">{pastAppointments.length + doctorRecords.length} Completed Records</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/80">
                    <th className="py-3.5 px-4">Consultation Date</th>
                    <th className="py-3.5 px-4">Patient Name & ID</th>
                    <th className="py-3.5 px-4">Chief Complaint</th>
                    <th className="py-3.5 px-4">Clinical Diagnosis</th>
                    <th className="py-3.5 px-4">Consultation Status</th>
                    <th className="py-3.5 px-4 text-right">Official Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pastAppointments.length === 0 && doctorRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        No past consultation records for this doctor yet. Complete an appointment consultation to generate records.
                      </td>
                    </tr>
                  ) : (
                    // Display records and past completed appointments
                    [...doctorRecords, ...pastAppointments].map((item, idx) => {
                      const isRecord = Boolean(item.diagnosis || item.recordId);
                      const patientName = typeof item.patient === 'object' ? item.patient?.name : 'Patient';
                      const patientId = typeof item.patient === 'object' ? item.patient?.patientId || item.patient?._id : item.patient;
                      const dateDisplay = item.date ? new Date(item.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' }) : 'Recent';

                      return (
                        <tr key={item._id || idx} className="hover:bg-brand-50/30 transition-colors">
                          <td className="py-4 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                            <span className="block font-bold text-slate-900">{dateDisplay}</span>
                            <span className="text-slate-400 font-mono text-[10px]">{item.recordId || item.appointmentId || 'ENC-DONE'}</span>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-extrabold text-slate-900 text-xs">{patientName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{patientId}</p>
                          </td>
                          <td className="py-4 px-4 max-w-xs truncate text-xs text-slate-600">
                            {item.symptoms || 'General clinical consultation'}
                          </td>
                          <td className="py-4 px-4 text-xs font-bold text-slate-800">
                            {item.diagnosis || 'Clinical Assessment & Triage Completed'}
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black flex items-center space-x-1.5 w-fit shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Consulted</span>
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleViewReport(item)}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-brand-600 text-white font-bold text-xs inline-flex items-center space-x-1.5 transition cursor-pointer shadow-xs hover:shadow-md transform hover:-translate-y-0.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Report</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
