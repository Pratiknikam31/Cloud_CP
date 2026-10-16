import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ListOrdered, 
  Users, 
  Calendar, 
  BedDouble, 
  UserPlus, 
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  PhoneCall
} from 'lucide-react';
import { appointmentApi, patientApi } from '../../api/hospitalApi';

export const ReceptionistDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);

  // New patient quick reg
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '1995-05-15',
    gender: 'male',
    bloodGroup: 'O+',
    address: '100 Medical Blvd, NY',
    emergencyContact: {
      name: 'Primary Contact',
      relationship: 'Relative',
      phone: '+1 555-010-0000'
    }
  });

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [aptRes, patRes] = await Promise.all([
        appointmentApi.getAll({ limit: 50 }),
        patientApi.getAll({ limit: 50 })
      ]);

      const fetchedApts = aptRes.data?.appointments || aptRes.appointments || [];
      const fetchedPats = patRes.data?.patients || patRes.patients || [];

      setAppointments(fetchedApts);
      setPatients(fetchedPats);
    } catch (err) {
      console.error('Failed to load receptionist data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckIn = async (appointmentId: string) => {
    try {
      await appointmentApi.updateStatus(appointmentId, 'checked_in');
      fetchData();
    } catch (err) {
      console.error('Failed to check in patient:', err);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await patientApi.create(newPatient);
      setShowNewPatientModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to register patient:', err);
    }
  };

  const checkedInCount = appointments.filter(a => a.status === 'checked_in').length;
  const inConsultCount = appointments.filter(a => a.status === 'in_consultation').length;
  const waitingCount = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Reception Desk & Smart Queue Counter</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage patient check-ins, call next queue tokens, and direct admissions.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowNewPatientModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition flex items-center space-x-2 cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4 text-brand-600" />
            <span>Register Walk-in Patient</span>
          </button>

          <Link
            to="/patient/book-appointment"
            className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition flex items-center space-x-2 shadow-md"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Visit</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Today's Check-Ins</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{checkedInCount}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">{inConsultCount} In Clinic Room</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Awaiting Check-in</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{waitingCount}</p>
            <span className="text-[11px] text-amber-600 font-semibold">Incoming arrivals</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Total Appointments</span>
            <p className="text-3xl font-extrabold text-indigo-600 mt-2">{appointments.length}</p>
            <span className="text-[11px] text-slate-400">Scheduled on docket</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase">Registered Patients</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{patients.length}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">In hospital directory</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Live Reception Queue Board */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Daily Reception Docket & Check-in Desk</h3>
            <p className="text-slate-500 text-xs">Verify arrived patients and issue clinic room queue tokens.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
            Real-time Reception Sync
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Token</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Doctor</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Slot</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((apt) => (
                <tr key={apt._id} className="hover:bg-slate-50 transition">
                  <td className="py-4 px-4 font-mono font-extrabold text-brand-600 text-sm">
                    #{apt.queueNumber || 101}
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900 text-xs">{apt.patient?.name || 'Patient'}</p>
                    <span className="text-slate-400 font-mono text-[11px]">{apt.patient?.patientId}</span>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-800">{apt.doctor?.name || 'Physician'}</td>
                  <td className="py-4 px-4 text-slate-600">{apt.department?.name || 'General Wing'}</td>
                  <td className="py-4 px-4 font-medium text-slate-700">{apt.timeSlot || '09:30 AM'}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      apt.status === 'checked_in'
                        ? 'bg-emerald-100 text-emerald-800'
                        : apt.status === 'in_consultation'
                        ? 'bg-brand-100 text-brand-800'
                        : apt.status === 'completed'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {apt.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {apt.status !== 'checked_in' && apt.status !== 'in_consultation' && apt.status !== 'completed' ? (
                      <button
                        onClick={() => handleCheckIn(apt._id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                      >
                        Check In
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs font-semibold">Checked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Patient Registration Modal */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-lg text-slate-900">Register New Patient</h3>

            <form onSubmit={handleCreatePatient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newPatient.email}
                    onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="patient@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="+1 555-010-9999"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e: any) => setNewPatient({ ...newPatient, gender: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={newPatient.bloodGroup}
                    onChange={(e: any) => setNewPatient({ ...newPatient, bloodGroup: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold cursor-pointer"
                >
                  Create Patient Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
