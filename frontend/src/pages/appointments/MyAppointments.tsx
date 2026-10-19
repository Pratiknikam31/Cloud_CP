import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Stethoscope, RefreshCw, Plus, Hash, AlertCircle } from 'lucide-react';
import { appointmentApi } from '../../api/hospitalApi';

// Lists the appointments the logged-in patient has already booked.
// The backend scopes GET /appointments to the patient's own records.

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-brand-100 text-brand-700',
  checked_in: 'bg-indigo-100 text-indigo-700',
  in_consultation: 'bg-purple-100 text-purple-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
  no_show: 'bg-slate-200 text-slate-600',
};

const ACTIVE = ['pending', 'confirmed', 'checked_in', 'in_consultation'];

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

export const MyAppointments: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const load = async (next?: string) => {
    try {
      setError('');
      next ? setLoadingMore(true) : setLoading(true);
      const res = await appointmentApi.getAll({ limit: 50, ...(next ? { cursor: next } : {}) });
      const items = res.appointments ?? res.data?.appointments ?? [];
      setAppointments((prev) => (next ? [...prev, ...items] : items));
      setCursor(res.pagination?.nextCursor ?? undefined);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not load your appointments.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upcoming = appointments
    .filter((a) => ACTIVE.includes(a.status))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const past = appointments.filter((a) => !ACTIVE.includes(a.status));
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Appointments</h1>
          <p className="text-sm text-slate-500">Appointments you have booked with our doctors.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => load()}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            to="/patient/book-appointment"
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-brand-700"
          >
            <Plus className="w-4 h-4" /> Book New
          </Link>
        </div>
      </div>

      <div className="flex gap-2">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${
              tab === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past & Cancelled (${past.length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-sm">Loading your appointments...</div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">
            {tab === 'upcoming' ? "You don't have any upcoming appointments." : 'No past appointments yet.'}
          </p>
          {tab === 'upcoming' && (
            <Link to="/patient/book-appointment" className="inline-block text-sm font-semibold text-brand-600 hover:underline">
              Book an appointment
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((a) => (
            <div key={a._id} className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{a.doctor?.name || 'Doctor'}</p>
                    <p className="text-xs text-slate-500">
                      {[a.doctor?.specialization, a.department?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                    STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {a.status?.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400" /> {formatDate(a.date)}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" /> {a.timeSlot || '-'}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Hash className="w-4 h-4 text-slate-400" /> Queue {a.queueNumber ?? '-'}
                </div>
              </div>

              {a.symptoms && (
                <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <span className="font-semibold text-slate-600">Reason: </span>
                  {a.symptoms}
                </p>
              )}
              <p className="text-[11px] text-slate-400">Ref: {a.appointmentId}</p>
            </div>
          ))}
        </div>
      )}

      {cursor && !loading && (
        <div className="text-center">
          <button
            onClick={() => load(cursor)}
            disabled={loadingMore}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MyAppointments;
