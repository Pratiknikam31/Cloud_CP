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
    <div className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-brand-700 via-brand-600 to-medical-teal text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
              Patient Health Portal
            </span>
            {refreshing && <RefreshCw className="w-4 h-4 animate-spin text-white/80" />}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome Back, {user?.name || 'Patient'}!</h1>
          <p className="text-brand-100 text-sm leading-relaxed">
            Access your diagnostic reports and manage your appointments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchPatientData}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Link
          to="/patient/book-appointment"
          className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Book Appointment</h3>
          <p className="text-slate-500 text-xs mt-1">Schedule with specialist physician</p>
        </Link>

        <Link
          to="/patient/appointments"
          className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">My Appointments</h3>
          <p className="text-slate-500 text-xs mt-1">View all appointment history</p>
        </Link>

        <Link
          to="/patient/lab-reports"
          className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Doctor Reports</h3>
          <p className="text-slate-500 text-xs mt-1">{consultationReports.length} Consultation encounters</p>
        </Link>
      </div>

      {/* Upcoming Appointment & Reports Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next Appointment Card */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">Your Next Appointment</h3>
            {upcomingAppointment ? (
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 capitalize">
                {upcomingAppointment.status?.replace('_', ' ') || 'Confirmed'}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-xs">
                No active booking
              </span>
            )}
          </div>

          {upcomingAppointment ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">Specialist Physician</span>
                  <p className="text-lg font-extrabold text-slate-900">
                    {upcomingAppointment.doctor?.name || 'Dr. Eleanor Vance'}
                  </p>
                  <span className="text-xs font-semibold text-brand-600">
                    {upcomingAppointment.department?.name || 'Cardiology Wing'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase">Live Queue Token</span>
                  <p className="text-2xl font-extrabold text-brand-600 font-mono">
                    #{upcomingAppointment.queueNumber || 101}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-semibold text-slate-600 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>
                    {upcomingAppointment.date ? new Date(upcomingAppointment.date).toLocaleDateString() : 'Scheduled Date'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Slot: {upcomingAppointment.timeSlot || '09:30 AM'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <p className="text-sm text-slate-600 font-medium">You don't have any pending appointments scheduled.</p>
              <Link
                to="/patient/book-appointment"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition"
              >
                <Calendar className="w-4 h-4" />
                <span>Schedule a Doctor Visit</span>
              </Link>
            </div>
          )}
        </div>

        {/* Doctor Consultation Reports Summary */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span>Doctor Reports</span>
              </h3>
              <Link to="/patient/lab-reports" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                View All
              </Link>
            </div>
            <p className="text-slate-500 text-xs mt-1">Official physician consultation encounters</p>
          </div>

          <div className="space-y-3 font-medium text-xs">
            {consultationReports.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No consultation reports published yet
              </div>
            ) : (
              consultationReports.slice(0, 4).map((r) => (
                <div key={r._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="truncate mr-2">
                    <span className="font-bold text-slate-900 block truncate">{r.diagnosis || r.recordId}</span>
                    <span className="text-[10px] text-slate-400">
                      {typeof r.doctor === 'object' ? r.doctor?.name : 'Physician'} • {new Date(r.date || r.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
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
