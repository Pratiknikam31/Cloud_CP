import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  FileText, 
  Clock, 
  RefreshCw,
  Stethoscope
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, emrApi } from '../../api/hospitalApi';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultationReports, setConsultationReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatientData = async () => {
    try {
      setRefreshing(true);
      const [aptRes, recRes] = await Promise.all([
        appointmentApi.getAll({ limit: 5 }).catch(() => ({ data: { appointments: [] } })),
        emrApi.getRecords({ limit: 5 }).catch(() => ({ records: [] }))
      ]);

      if (aptRes.data?.appointments) setAppointments(aptRes.data.appointments);
      else if (aptRes.appointments) setAppointments(aptRes.appointments);

      const records = recRes.records || recRes.data?.records || [];
      setConsultationReports(records);
    } catch (err) {
      console.error('Error fetching patient dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [user]);

  const upcomingAppointment = appointments.find(a => a.status !== 'completed' && a.status !== 'cancelled') || appointments[0];

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-2 max-w-xl relative z-10">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold uppercase tracking-wider">
              Patient Health Portal
            </span>
            {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-brand-400" />}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Welcome, {user?.name || 'Patient'}!</h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Real-time patient clinical workspace. Access your verified diagnostic reports, track live consultation queue, and schedule specialist appointments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={fetchPatientData}
            className="p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/80 transition cursor-pointer shadow-xs"
            title="Refresh Health Records"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Link
          to="/patient/book-appointment"
          className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-cyan-500" />
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 shadow-xs transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Book Appointment</h3>
          <p className="text-slate-500 text-xs mt-1">Schedule with a board-certified clinical specialist</p>
        </Link>

        <Link
          to="/patient/appointments"
          className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 shadow-xs transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">My Appointments</h3>
          <p className="text-slate-500 text-xs mt-1">Track active bookings and check-in timeline</p>
        </Link>

        <Link
          to="/patient/lab-reports"
          className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 shadow-xs transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Doctor Reports</h3>
          <p className="text-slate-500 text-xs mt-1">{consultationReports.length} Verified consultation encounters</p>
        </Link>
      </div>

      {/* Upcoming Appointment & Reports Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next Appointment Card */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span>
              <h3 className="font-extrabold text-slate-900 text-lg">Active Consultation Schedule</h3>
            </div>
            {upcomingAppointment ? (
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200/80 capitalize flex items-center space-x-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{upcomingAppointment.status?.replace('_', ' ') || 'Confirmed'}</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-xs">
                No active booking
              </span>
            )}
          </div>

          {upcomingAppointment ? (
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consulting Specialist</span>
                  <p className="text-xl font-black text-slate-900 mt-0.5">
                    {upcomingAppointment.doctor?.name || 'Dr. Eleanor Vance'}
                  </p>
                  <span className="inline-block mt-1 text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200/60">
                    {upcomingAppointment.department?.name || 'Cardiology Wing'}
                  </span>
                </div>
                <div className="sm:text-right p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Queue Token</span>
                  <p className="text-3xl font-black text-brand-600 font-mono mt-0.5">
                    #{upcomingAppointment.queueNumber || 101}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-semibold text-slate-600 border-t border-slate-200/70">
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/70 shadow-2xs">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  <span>
                    {upcomingAppointment.date ? new Date(upcomingAppointment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Scheduled Date'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200/70 shadow-2xs">
                  <Clock className="w-4 h-4 text-brand-600" />
                  <span className="font-mono">Slot: {upcomingAppointment.timeSlot || '09:30 AM'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">You don't have any pending appointments scheduled.</p>
              <Link
                to="/patient/book-appointment"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md transition"
              >
                <Calendar className="w-4 h-4" />
                <span>Schedule Specialist Visit</span>
              </Link>
            </div>
          )}
        </div>

        {/* Doctor Consultation Reports Summary */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Doctor Reports</span>
              </h3>
              <Link to="/patient/lab-reports" className="text-xs font-extrabold text-brand-600 hover:text-brand-700">
                View All
              </Link>
            </div>
            <p className="text-slate-500 text-xs mt-2">Verified clinical consults & electronic medical records</p>
          </div>

          <div className="space-y-3 font-medium text-xs">
            {consultationReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-xs">
                No consultation reports published yet
              </div>
            ) : (
              consultationReports.slice(0, 4).map((r) => (
                <div key={r._id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-100/60 transition shadow-2xs">
                  <div className="truncate mr-2">
                    <span className="font-extrabold text-slate-900 block truncate text-xs">{r.diagnosis || r.recordId}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                      {typeof r.doctor === 'object' ? r.doctor?.name : 'Physician'} • {new Date(r.date || r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Verified
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
