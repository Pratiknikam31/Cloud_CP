import React, { useState, useEffect } from 'react';
import {
  Users,
  Stethoscope,
  Calendar,
  BedDouble,
  Clock,
  TrendingUp,
  AlertTriangle,
  Download,
  RefreshCw,
  Activity,
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Search,
  Pill,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { analyticsApi, doctorApi, departmentApi, appointmentApi } from '../../api/hospitalApi';

const DEPT_COLORS = ['#0c93e7', '#4f46e5', '#059669', '#d97706', '#e11d48', '#8b5cf6', '#0891b2', '#b45309'];

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:         { label: 'Pending',         color: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-400' },
  confirmed:       { label: 'Confirmed',       color: 'text-blue-700',    bg: 'bg-blue-50',    dot: 'bg-blue-400' },
  checked_in:      { label: 'Checked In',      color: 'text-cyan-700',    bg: 'bg-cyan-50',    dot: 'bg-cyan-400' },
  in_consultation: { label: 'In Consultation', color: 'text-brand-700',   bg: 'bg-brand-50',   dot: 'bg-brand-500' },
  completed:       { label: 'Completed',       color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  cancelled:       { label: 'Cancelled',       color: 'text-rose-700',    bg: 'bg-rose-50',    dot: 'bg-rose-500' },
};

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedDoctors, setExpandedDoctors] = useState<Set<string>>(new Set());
  const [patientFilter, setPatientFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  const fetchAll = async () => {
    try {
      setRefreshing(true);
      const [analytRes, docRes, deptRes, aptRes] = await Promise.all([
        analyticsApi.getOverview().catch(() => ({ success: false })),
        doctorApi.getAll().catch(() => ({ doctors: [] })),
        departmentApi.getAll().catch(() => ({ departments: [] })),
        appointmentApi.getAll({ all: 'true', limit: 300 }).catch(() => ({ appointments: [] })),
      ]);

      if ((analytRes as any).success) setAnalyticsData((analytRes as any).data);
      setDoctors((docRes as any).doctors || (docRes as any).data?.doctors || []);
      setDepartments((deptRes as any).departments || (deptRes as any).data?.departments || []);
      setAppointments((aptRes as any).appointments || (aptRes as any).data?.appointments || []);
    } catch (err) {
      console.error('Admin dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Default: expand all departments
  useEffect(() => {
    if (departments.length > 0) {
      setExpandedDepts(new Set(departments.map((d: any) => d._id)));
    }
  }, [departments]);

  const kpis = analyticsData?.kpis || {
    totalPatients: new Set(appointments.map((a: any) => typeof a.patient === 'object' ? a.patient?._id : a.patient)).size,
    totalDoctors: doctors.length,
    totalAppointments: appointments.length,
    todayAppointments: appointments.filter((a: any) => {
      const today = new Date();
      return a.date && new Date(a.date).toDateString() === today.toDateString();
    }).length,
    completedToday: appointments.filter((a: any) => a.status === 'completed').length,
    totalBeds: 50,
    occupiedBeds: 18,
    occupancyRate: 36,
    totalRevenue: 0,
    pendingRevenue: 0,
    lowStockMeds: 0,
  };

  const chartData = analyticsData?.monthlyAppointments || [
    { month: 'May', appointments: 120, completed: 88 },
    { month: 'Jun', appointments: 145, completed: 110 },
    { month: 'Jul', appointments: 190, completed: 154 },
    { month: 'Aug', appointments: 230, completed: 198 },
    { month: 'Sep', appointments: 280, completed: 240 },
    { month: 'Oct', appointments: 320, completed: 271 },
  ];

  const departmentPieData = departments.map((dept: any, idx: number) => {
    const deptDocs = doctors.filter((d: any) =>
      (typeof d.department === 'object' ? d.department?._id : d.department) === dept._id
    );
    const deptApts = appointments.filter((a: any) => {
      const docId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
      return deptDocs.some((d: any) => d._id === docId);
    });
    return {
      name: dept.name,
      value: deptApts.length,
      color: DEPT_COLORS[idx % DEPT_COLORS.length],
      doctors: deptDocs.length,
    };
  }).filter((d: any) => d.value > 0);

  const getDoctorPatients = (doctorId: string, filter: 'all' | 'upcoming' | 'completed') => {
    return appointments.filter((a: any) => {
      const docId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
      if (docId !== doctorId) return false;
      if (filter === 'upcoming') return ['pending', 'confirmed', 'checked_in', 'in_consultation'].includes(a.status);
      if (filter === 'completed') return a.status === 'completed';
      return true;
    });
  };

  const filteredDoctors = doctors.filter((doc: any) => {
    const docDeptId = typeof doc.department === 'object' ? doc.department?._id : doc.department;
    const matchesDept = selectedDeptFilter === 'all' || docDeptId === selectedDeptFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      doc.name?.toLowerCase().includes(q) ||
      doc.specialization?.toLowerCase().includes(q) ||
      (typeof doc.department === 'object' ? doc.department?.name : '').toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  const groupedByDepartment: Record<string, { dept: any; doctors: any[] }> = departments.reduce((acc: any, dept: any) => {
    const deptDocs = filteredDoctors.filter((d: any) =>
      (typeof d.department === 'object' ? d.department?._id : d.department) === dept._id
    );
    if (deptDocs.length > 0) acc[dept._id] = { dept, doctors: deptDocs };
    return acc;
  }, {});

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDoctor = (id: string) => {
    setExpandedDoctors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ['Department', 'Doctor', 'Specialization', 'Room', 'Total Patients', 'Upcoming', 'Completed'],
      ...doctors.map((doc: any) => {
        const deptName = typeof doc.department === 'object' ? doc.department?.name : 'N/A';
        const all = getDoctorPatients(doc._id, 'all');
        const up = getDoctorPatients(doc._id, 'upcoming');
        const done = getDoctorPatients(doc._id, 'completed');
        return [deptName, doc.name, doc.specialization, doc.roomNumber || '-', all.length, up.length, done.length];
      }),
    ];
    const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `CloudCare_Admin_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalUpcoming = appointments.filter((a: any) =>
    ['pending', 'confirmed', 'checked_in', 'in_consultation'].includes(a.status)
  ).length;
  const totalCompleted = appointments.filter((a: any) => a.status === 'completed').length;
  const totalCancelled = appointments.filter((a: any) => a.status === 'cancelled').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-72">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
          <p className="text-slate-500 text-sm font-medium">Loading hospital data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[11px] font-bold text-brand-600 uppercase tracking-widest mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            <span>Clinical Operations Command</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Hospital Administration</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Real-time analytics across departments, clinical specialists, and patient telemetry.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAll}
            className="p-2.5 rounded-2xl border border-slate-200/90 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs hover:shadow-sm transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4 text-slate-300" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Departments',     value: departments.length,                                                                                          sub: 'Active Wings',       icon: Building2,    color: 'blue',   glow: 'rgba(12,147,231,0.1)'   },
          { label: 'Doctors',         value: doctors.length,                                                                                              sub: `${departments.length} Specialties`, icon: Stethoscope, color: 'indigo', glow: 'rgba(99,102,241,0.1)' },
          { label: 'Total Patients',  value: new Set(appointments.map((a: any) => typeof a.patient === 'object' ? a.patient?._id : a.patient)).size,     sub: 'Registered',         icon: Users,        color: 'emerald',glow: 'rgba(16,185,129,0.1)' },
          { label: 'Upcoming Appts',  value: totalUpcoming,                                                                                               sub: 'Queue Active',       icon: Calendar,     color: 'amber',  glow: 'rgba(245,158,11,0.1)'  },
          { label: 'Completed',       value: totalCompleted,                                                                                              sub: 'Consultations Done', icon: CheckCircle2, color: 'teal',   glow: 'rgba(13,148,136,0.1)'  },
          { label: 'Cancelled',       value: totalCancelled,                                                                                              sub: 'Dropped / Void',    icon: AlertTriangle,color: 'rose',   glow: 'rgba(244,63,94,0.1)'   },
        ].map(({ label, value, sub, icon: Icon, color }) => {
          const colorStyles: Record<string, { iconBg: string; text: string; badge: string; accent: string }> = {
            blue:    { iconBg: 'bg-blue-50 text-blue-600',       text: 'text-blue-600',    badge: 'bg-blue-50/80 text-blue-700',       accent: 'from-blue-500 to-cyan-500' },
            indigo:  { iconBg: 'bg-indigo-50 text-indigo-600',   text: 'text-indigo-600',  badge: 'bg-indigo-50/80 text-indigo-700',   accent: 'from-indigo-500 to-purple-500' },
            emerald: { iconBg: 'bg-emerald-50 text-emerald-600', text: 'text-emerald-600', badge: 'bg-emerald-50/80 text-emerald-700',accent: 'from-emerald-500 to-teal-500' },
            amber:   { iconBg: 'bg-amber-50 text-amber-600',     text: 'text-amber-600',   badge: 'bg-amber-50/80 text-amber-700',     accent: 'from-amber-500 to-orange-500' },
            teal:    { iconBg: 'bg-teal-50 text-teal-600',       text: 'text-teal-600',    badge: 'bg-teal-50/80 text-teal-700',       accent: 'from-teal-500 to-cyan-500' },
            rose:    { iconBg: 'bg-rose-50 text-rose-600',       text: 'text-rose-600',    badge: 'bg-rose-50/80 text-rose-700',       accent: 'from-rose-500 to-pink-500' },
          };
          const style = colorStyles[color];
          return (
            <div 
              key={label} 
              className="relative p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
            >
              {/* Subtle top color highlight accent */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.accent} opacity-80 group-hover:h-1.5 transition-all`} />
              
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${style.iconBg} shadow-2xs group-hover:scale-110 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3 tracking-tight font-mono">{value}</p>
              <div className="flex items-center space-x-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Appointment Trend */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                <h3 className="font-extrabold text-slate-900 text-lg">Appointment Volume Trend</h3>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">Monthly total scheduled vs completed consultations</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100/80 border border-slate-200/60 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 shadow-2xs self-start sm:self-auto">
              <BarChart3 className="w-3.5 h-3.5 text-brand-600" />
              <span>6-Month Clinical Telemetry</span>
            </span>
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradApt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c93e7" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0c93e7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '14px', border: 'none', color: '#fff', fontSize: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: '10px' }} />
                <Area type="monotone" dataKey="appointments" stroke="#0c93e7" strokeWidth={3} fillOpacity={1} fill="url(#gradApt)" name="Total Appointments" />
                <Area type="monotone" dataKey="completed" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#gradDone)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-medical-teal"></span>
              <h3 className="font-extrabold text-slate-900 text-lg">Department Load</h3>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">Appointment distribution across clinical wings</p>
          </div>
          {departmentPieData.length > 0 ? (
            <>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={departmentPieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                      {departmentPieData.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3">
                {departmentPieData.slice(0, 5).map((item: any) => (
                  <div key={item.name} className="flex items-center justify-between text-xs p-1 rounded-lg hover:bg-slate-50 transition">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 font-medium truncate max-w-[120px]">{item.name}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-slate-400 text-[11px] font-mono">{item.doctors} dr</span>
                      <span className="font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded-md">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex items-center justify-center text-slate-400 text-sm">No appointment data yet</div>
          )}
        </div>
      </div>

      {/* ── STATUS BAR CHART ── */}
      {appointments.length > 0 && departments.length > 0 && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <div className="mb-5 border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-lg">Appointment Status by Department</h3>
            <p className="text-slate-500 text-xs mt-0.5">Upcoming vs completed consultations per clinical specialty</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departments.map((dept: any) => {
                  const deptDocs = doctors.filter((d: any) =>
                    (typeof d.department === 'object' ? d.department?._id : d.department) === dept._id
                  );
                  const deptApts = appointments.filter((a: any) => {
                    const docId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
                    return deptDocs.some((d: any) => d._id === docId);
                  });
                  return {
                    name: dept.name.length > 10 ? dept.name.substring(0, 9) + '…' : dept.name,
                    upcoming: deptApts.filter((a: any) => ['pending', 'confirmed', 'checked_in', 'in_consultation'].includes(a.status)).length,
                    completed: deptApts.filter((a: any) => a.status === 'completed').length,
                  };
                }).filter((d: any) => d.upcoming + d.completed > 0)}
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={11} tickLine={false} stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="upcoming" fill="#f59e0b" name="Upcoming / In Queue" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" fill="#059669" name="Completed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── DEPARTMENT → DOCTOR → PATIENT HIERARCHY ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-2xs">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              <span>Departments · Clinical Specialists · Patient Roster</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive clinical drill-down. Filter patient consultation records by status.
            </p>
          </div>
          <div className="flex items-center space-x-1 bg-slate-100/80 border border-slate-200/80 p-1.5 rounded-2xl shadow-2xs text-xs">
            {(['all', 'upcoming', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPatientFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold transition capitalize ${
                  patientFilter === f ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {f === 'all' ? 'All Patients' : f === 'upcoming' ? 'Upcoming' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Dept Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search doctors, specializations, departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200/90 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white shadow-xs transition"
            />
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedDeptFilter('all')}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all shadow-2xs ${
                selectedDeptFilter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Depts
            </button>
            {departments.map((dept: any) => (
              <button
                key={dept._id}
                onClick={() => setSelectedDeptFilter(dept._id)}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all shadow-2xs ${
                  selectedDeptFilter === dept._id ? 'bg-brand-600 text-white shadow-brand-500/20 shadow-md' : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {dept.name}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion */}
        {Object.keys(groupedByDepartment).length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No departments or doctors match your filter.</p>
          </div>
        ) : (
          Object.values(groupedByDepartment).map(({ dept, doctors: deptDocs }: any) => {
            const isDeptExpanded = expandedDepts.has(dept._id);
            const deptIdx = departments.findIndex((d: any) => d._id === dept._id);
            const deptColor = DEPT_COLORS[deptIdx % DEPT_COLORS.length];
            const deptApts = appointments.filter((a: any) => {
              const docId = typeof a.doctor === 'object' ? a.doctor?._id : a.doctor;
              return deptDocs.some((d: any) => d._id === docId);
            });
            const deptUpcoming = deptApts.filter((a: any) => ['pending', 'confirmed', 'checked_in', 'in_consultation'].includes(a.status)).length;
            const deptCompleted = deptApts.filter((a: any) => a.status === 'completed').length;

            return (
              <div key={dept._id} className="rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md transition-all overflow-hidden">
                {/* Department header */}
                <button
                  onClick={() => toggleDept(dept._id)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-slate-50/70 transition-all text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0 ring-2 ring-white/50"
                      style={{ backgroundColor: deptColor }}
                    >
                      {dept.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-base flex items-center space-x-2">
                        <span>{dept.name}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">Wing {dept.code || 'CLIN'}</span>
                      </h3>
                      <div className="flex items-center flex-wrap gap-2.5 mt-1 text-xs">
                        <span className="font-semibold text-slate-700 bg-slate-100/70 px-2 py-0.5 rounded-md"><strong className="text-slate-900">{deptDocs.length}</strong> Specialists</span>
                        <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50"><strong>{deptUpcoming}</strong> In Queue</span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50"><strong>{deptCompleted}</strong> Consulted</span>
                        <span className="hidden sm:inline-block text-slate-400 font-mono text-[11px]">{deptApts.length} total records</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 transition">
                    {isDeptExpanded
                      ? <ChevronDown className="w-5 h-5 shrink-0" />
                      : <ChevronRight className="w-5 h-5 shrink-0" />
                    }
                  </div>
                </button>

                {isDeptExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/30">
                    {deptDocs.map((doc: any) => {
                      const isDrExpanded = expandedDoctors.has(doc._id);
                      const docPatients = getDoctorPatients(doc._id, patientFilter);
                      const docUpcoming = getDoctorPatients(doc._id, 'upcoming').length;
                      const docCompleted = getDoctorPatients(doc._id, 'completed').length;

                      return (
                        <div key={doc._id} className="transition-colors">
                          <button
                            onClick={() => toggleDoctor(doc._id)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-all text-left"
                          >
                            <div className="flex items-center space-x-4">
                              <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-xs"
                                style={{ backgroundColor: deptColor }}
                              >
                                {doc.name?.replace('Dr. ', '').charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm flex items-center space-x-2">
                                  <span>{doc.name}</span>
                                  {doc.roomNumber && (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                      Rm {doc.roomNumber}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {doc.specialization}
                                  {doc.qualification && ` · ${doc.qualification}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 shrink-0">
                              <div className="hidden sm:flex items-center space-x-2 text-[11px]">
                                <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-bold border border-amber-200/50">
                                  {docUpcoming} queued
                                </span>
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/50">
                                  {docCompleted} done
                                </span>
                              </div>
                              <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                                {isDrExpanded
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />
                                }
                              </div>
                            </div>
                          </button>

                          {isDrExpanded && (
                            <div className="px-6 pb-5 bg-slate-50/40">
                              {docPatients.length === 0 ? (
                                <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                                  {patientFilter === 'all'
                                    ? 'No appointments for this doctor yet.'
                                    : patientFilter === 'upcoming'
                                    ? 'No upcoming appointments.'
                                    : 'No completed consultations yet.'
                                  }
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/80 border-b border-slate-100">
                                      <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="py-3.5 px-4"># Queue</th>
                                        <th className="py-3.5 px-4">Patient Details</th>
                                        <th className="py-3.5 px-4">Consultation Date</th>
                                        <th className="py-3.5 px-4">Time Slot</th>
                                        <th className="py-3.5 px-4">Chief Complaint</th>
                                        <th className="py-3.5 px-4">Visit Mode</th>
                                        <th className="py-3.5 px-4">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {docPatients.map((apt: any, i: number) => {
                                        const patientName = typeof apt.patient === 'object' ? apt.patient?.name : 'Patient';
                                        const patientId = typeof apt.patient === 'object'
                                          ? apt.patient?.patientId || apt.patient?._id?.slice(-6)
                                          : '';
                                        const sc = statusConfig[apt.status] || statusConfig.pending;
                                        return (
                                          <tr key={apt._id || i} className="hover:bg-brand-50/30 transition-colors">
                                            <td className="py-3.5 px-4 font-mono font-black text-brand-600">
                                              <span className="px-2 py-0.5 rounded-md bg-brand-50 border border-brand-200/60 text-[11px]">
                                                #{apt.queueNumber || i + 1}
                                              </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                              <p className="font-extrabold text-slate-900">{patientName}</p>
                                              {patientId && <p className="text-slate-400 font-mono text-[10px]">{patientId}</p>}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                                              {apt.date
                                                ? new Date(apt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—'}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                              {apt.timeSlot || '—'}
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600 max-w-[180px] truncate" title={apt.symptoms}>
                                              {apt.symptoms || 'General clinical review'}
                                            </td>
                                            <td className="py-3.5 px-4">
                                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 capitalize text-[10px] font-bold">
                                                {apt.type?.replace('_', ' ') || 'in person'}
                                              </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                              <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border border-current/15 ${sc.bg} ${sc.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} animate-pulse`} />
                                                <span>{sc.label}</span>
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {/* Doctor Quick Stats */}
                              <div className="mt-3 grid grid-cols-3 gap-3">
                                {[
                                  { label: 'Total Patients', value: getDoctorPatients(doc._id, 'all').length, color: 'text-slate-900',  bg: 'bg-white',        border: 'border-slate-200/90' },
                                  { label: 'In Queue',       value: docUpcoming,                               color: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-200/60' },
                                  { label: 'Consulted',      value: docCompleted,                              color: 'text-emerald-700',bg: 'bg-emerald-50/50', border: 'border-emerald-200/60' },
                                ].map(({ label, value, color, bg, border }) => (
                                  <div key={label} className={`${bg} border ${border} rounded-2xl p-3 text-center shadow-2xs`}>
                                    <p className={`text-xl font-black font-mono ${color}`}>{value}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{label}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
