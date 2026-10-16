import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  BrainCircuit, 
  FileSpreadsheet, 
  Pill, 
  FlaskConical, 
  Receipt, 
  Clock, 
  RefreshCw,
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, emrApi, labApi, billingApi } from '../../api/hospitalApi';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [labReports, setLabReports] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatientData = async () => {
    try {
      setRefreshing(true);
      const [aptRes, rxRes, labRes, billRes] = await Promise.all([
        appointmentApi.getAll({ limit: 5 }).catch(() => ({ data: { appointments: [] } })),
        emrApi.getPrescriptions({ limit: 5 }).catch(() => ({ data: { prescriptions: [] } })),
        labApi.getReports({ limit: 5 }).catch(() => ({ data: { reports: [] } })),
        billingApi.getBills({ limit: 5 }).catch(() => ({ data: { bills: [] } }))
      ]);

      if (aptRes.data?.appointments) setAppointments(aptRes.data.appointments);
      else if (aptRes.appointments) setAppointments(aptRes.appointments);

      if (rxRes.data?.prescriptions) setPrescriptions(rxRes.data.prescriptions);
      else if (rxRes.prescriptions) setPrescriptions(rxRes.prescriptions);

      if (labRes.data?.reports) setLabReports(labRes.data.reports);
      if (billRes.data?.bills) setBills(billRes.data.bills);
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
  const pendingBill = bills.find(b => b.status === 'pending' || b.status === 'partially_paid');

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
            Access your electronic health records, active prescriptions, lab diagnostic reports, and AI-assisted department triaging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchPatientData}
            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/patient/ai-recommendation"
            className="px-6 py-3.5 rounded-2xl bg-white text-brand-700 font-extrabold text-sm hover:bg-slate-50 transition shadow-lg shrink-0 flex items-center space-x-2"
          >
            <BrainCircuit className="w-5 h-5 text-brand-600" />
            <span>AI Symptom Assister</span>
          </Link>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
          to="/patient/medical-records"
          className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Medical Records</h3>
          <p className="text-slate-500 text-xs mt-1">Vitals, consultation notes & history</p>
        </Link>

        <Link
          to="/patient/prescriptions"
          className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Pill className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">My Prescriptions</h3>
          <p className="text-slate-500 text-xs mt-1">{prescriptions.length} Active prescription notes</p>
        </Link>

        <Link
          to="/patient/lab-reports"
          className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition group"
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FlaskConical className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Lab Reports</h3>
          <p className="text-slate-500 text-xs mt-1">{labReports.length} Diagnostics & blood tests</p>
        </Link>
      </div>

      {/* Upcoming Appointment & Health Summary Section */}
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

          {/* Pending Bill Notice if applicable */}
          {pendingBill && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Receipt className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs font-bold text-amber-900">Outstanding Invoice #{pendingBill.billId}</p>
                  <p className="text-[11px] text-amber-700">Balance: ${pendingBill.balance}</p>
                </div>
              </div>
              <Link
                to="/patient/bills"
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition"
              >
                Pay Online
              </Link>
            </div>
          )}
        </div>

        {/* Health Profile Summary */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
              <HeartPulse className="w-5 h-5 text-rose-500" />
              <span>Vitals Snapshot</span>
            </h3>
            <p className="text-slate-500 text-xs">Clinical vitals recorded during your last visit.</p>
          </div>

          <div className="space-y-3 font-medium text-xs">
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Blood Pressure</span>
              <span className="font-bold text-slate-900">120/80 mmHg</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Heart Rate</span>
              <span className="font-bold text-slate-900">74 bpm</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Oxygen Saturation</span>
              <span className="font-bold text-emerald-600">98% SpO2</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500">Blood Group</span>
              <span className="font-bold text-brand-600">O+ Positive</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <Link
              to="/patient/ai-recommendation"
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-brand-50 text-brand-700 font-bold text-xs hover:bg-brand-100 transition"
            >
              <BrainCircuit className="w-4 h-4 text-brand-600" />
              <span>Check New Symptoms with AI</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
