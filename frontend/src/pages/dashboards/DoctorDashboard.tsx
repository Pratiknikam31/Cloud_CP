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
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, labApi } from '../../api/hospitalApi';

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingLabCount, setPendingLabCount] = useState(0);

  const fetchDoctorData = async () => {
    try {
      setRefreshing(true);
      const [aptRes, labRes] = await Promise.all([
        appointmentApi.getAll({ limit: 50 }),
        labApi.getReports({ status: 'processing' }).catch(() => ({ data: { reports: [] } }))
      ]);

      if (aptRes.success && aptRes.data?.appointments) {
        setAppointments(aptRes.data.appointments);
      } else if (aptRes.appointments) {
        setAppointments(aptRes.appointments);
      }

      if (labRes.data?.reports) {
        setPendingLabCount(labRes.data.reports.length);
      }
    } catch (err) {
      console.error('Error fetching doctor schedule:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDoctorData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await appointmentApi.updateStatus(id, newStatus);
      setAppointments(prev =>
        prev.map(a => a._id === id ? { ...a, status: newStatus } : a)
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const waitingCount = appointments.filter(a => a.status === 'checked_in' || a.status === 'pending').length;
  const inConsultCount = appointments.filter(a => a.status === 'in_consultation').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Doctor Workspace & Daily Clinic Queue</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {user?.name || 'Physician'} — Electronic Medical Clinic & Patient Triage
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDoctorData}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/doctor/consultations"
            className="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition flex items-center space-x-2"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Open EMR Console</span>
          </Link>
        </div>
      </div>

      {/* Doctor Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Today's Appointments</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{appointments.length}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">{completedCount} Consulted</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Waiting Queue</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{waitingCount}</p>
            <span className="text-[11px] text-brand-600 font-semibold">{inConsultCount} In Exam Room</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ListOrdered className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Pending Lab Reports</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{pendingLabCount}</p>
            <span className="text-[11px] text-amber-600 font-semibold">Active investigations</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Avg Consultation</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">15 m</p>
            <span className="text-[11px] text-slate-500">Smart Scheduling</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Digital Queue & Patient Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Today's Patient Schedule & Queue</h3>
            <p className="text-slate-500 text-xs">Live clinic queue from CloudCare database.</p>
          </div>
          <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live Triage Sync</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Time Slot</th>
                <th className="py-3 px-4">Chief Complaint</th>
                <th className="py-3 px-4">Visit Type</th>
                <th className="py-3 px-4">Status Workflow</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
                    No appointments scheduled for this session.
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => {
                  const patientName = apt.patient?.name || 'Patient';
                  const patientId = apt.patient?.patientId || apt.patient?._id || '';

                  return (
                    <tr key={apt._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-4 px-4 font-mono font-extrabold text-brand-600">
                        #{apt.queueNumber || 1}
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-900">{patientName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{patientId}</p>
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {apt.timeSlot || '09:00 AM'}
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-xs text-slate-600" title={apt.symptoms}>
                        {apt.symptoms || 'General clinical consultation'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold capitalize">
                          {apt.type?.replace('_', ' ') || 'in person'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={apt.status}
                          onChange={(e) => handleUpdateStatus(apt._id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border outline-none cursor-pointer ${
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
                          to={`/doctor/consultations?patientId=${typeof apt.patient === 'object' ? apt.patient?._id : apt.patient}`}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-brand-600 transition inline-flex items-center space-x-1.5 shadow-xs"
                        >
                          <span>EMR Record</span>
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
    </div>
  );
};
