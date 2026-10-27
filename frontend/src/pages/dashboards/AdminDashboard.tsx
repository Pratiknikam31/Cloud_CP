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
    <div className="space-y-8 pb-16">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Hospital Administration</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Departments · Doctors · Patients — complete clinical overview.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAll}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Departments',     value: departments.length,                                                                                          sub: 'Active wings',       icon: Building2,    color: 'blue'    },
          { label: 'Doctors',         value: doctors.length,                                                                                              sub: `${departments.length} specialties`, icon: Stethoscope, color: 'indigo'  },
          { label: 'Total Patients',  value: new Set(appointments.map((a: any) => typeof a.patient === 'object' ? a.patient?._id : a.patient)).size,     sub: 'Unique registered',  icon: Users,        color: 'emerald' },
          { label: 'Upcoming Appts',  value: totalUpcoming,                                                                                               sub: 'In queue / booked',  icon: Calendar,     color: 'amber'   },
          { label: 'Completed',       value: totalCompleted,                                                                                              sub: 'Consultations done', icon: CheckCircle2, color: 'teal'    },
          { label: 'Cancelled',       value: totalCancelled,                                                                                              sub: 'Dropped / no-show',  icon: AlertTriangle,color: 'rose'    },
        ].map(({ label, value, sub, icon: Icon, color }) => {
          const colorMap: Record<string, string> = {
            blue:    'bg-blue-50 text-blue-600',
            indigo:  'bg-indigo-50 text-indigo-600',
            emerald: 'bg-emerald-50 text-emerald-600',
            amber:   'bg-amber-50 text-amber-600',
            teal:    'bg-teal-50 text-teal-600',
            rose:    'bg-rose-50 text-rose-600',
          };
          return (
            <div key={label} className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">{label}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 mt-3">{value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Appointment Trend */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Appointment Volume Trend</h3>
              <p className="text-slate-500 text-xs">Monthly total vs completed consultations</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl flex items-center space-x-1">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              6-Month View
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradApt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c93e7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0c93e7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="appointments" stroke="#0c93e7" strokeWidth={2.5} fillOpacity={1} fill="url(#gradApt)" name="Total Appointments" />
                <Area type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#gradDone)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Department Load</h3>
            <p className="text-slate-500 text-xs">Appointment split across wings</p>
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3">
                {departmentPieData.slice(0, 5).map((item: any) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 text-[11px]">{item.doctors} dr</span>
                      <span className="font-bold text-slate-900">{item.value}</span>
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
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
          <div className="mb-5">
            <h3 className="font-bold text-slate-900 text-lg">Appointment Status by Department</h3>
            <p className="text-slate-500 text-xs">Upcoming vs completed per clinical wing</p>
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
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', border: 'none', color: '#fff', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="upcoming" fill="#f59e0b" name="Upcoming / In Queue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#059669" name="Completed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── DEPARTMENT → DOCTOR → PATIENT HIERARCHY ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              <span>Departments · Doctors · Patients</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click a department or doctor row to expand. Filter patients by status below.
            </p>
          </div>
          <div className="flex items-center space-x-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs text-xs">
            {(['all', 'upcoming', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPatientFilter(f)}
                className={`px-3 py-1.5 rounded-lg font-bold transition capitalize ${
                  patientFilter === f ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Completed'}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Dept Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search doctors, specializations, departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 focus:bg-white transition"
            />
          </div>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedDeptFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedDeptFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Depts
            </button>
            {departments.map((dept: any) => (
              <button
                key={dept._id}
                onClick={() => setSelectedDeptFilter(dept._id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedDeptFilter === dept._id ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
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
              <div key={dept._id} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Department header */}
                <button
                  onClick={() => toggleDept(dept._id)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 hover:bg-slate-50/60 transition text-left"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0"
                      style={{ backgroundColor: deptColor }}
                    >
                      {dept.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{dept.name}</h3>
                      <div className="flex items-center space-x-3 mt-1 text-xs text-slate-500">
                        <span><strong className="text-slate-800">{deptDocs.length}</strong> Doctors</span>
                        <span className="text-amber-600"><strong>{deptUpcoming}</strong> Upcoming</span>
                        <span className="text-emerald-600"><strong>{deptCompleted}</strong> Completed</span>
                        <span className="hidden sm:block text-slate-400">{deptApts.length} total</span>
                      </div>
                    </div>
                  </div>
                  {isDeptExpanded
                    ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                    : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  }
                </button>

                {isDeptExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {deptDocs.map((doc: any) => {
                      const isDrExpanded = expandedDoctors.has(doc._id);
                      const docPatients = getDoctorPatients(doc._id, patientFilter);
                      const docUpcoming = getDoctorPatients(doc._id, 'upcoming').length;
                      const docCompleted = getDoctorPatients(doc._id, 'completed').length;

                      return (
                        <div key={doc._id}>
                          <button
                            onClick={() => toggleDoctor(doc._id)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition text-left"
                          >
                            <div className="flex items-center space-x-4">
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shrink-0"
                                style={{ backgroundColor: deptColor + 'cc' }}
                              >
                                {doc.name?.replace('Dr. ', '').charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900 text-sm">{doc.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {doc.specialization}
                                  {doc.qualification && ` · ${doc.qualification}`}
                                  {doc.roomNumber && ` · Room ${doc.roomNumber}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3 shrink-0">
                              <div className="hidden sm:flex items-center space-x-2 text-[11px]">
                                <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-bold">
                                  {docUpcoming} upcoming
                                </span>
                                <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold">
                                  {docCompleted} done
                                </span>
                              </div>
                              {isDrExpanded
                                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                                : <ChevronRight className="w-4 h-4 text-slate-400" />
                              }
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
                                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="py-3 px-4">#</th>
                                        <th className="py-3 px-4">Patient</th>
                                        <th className="py-3 px-4">Appointment Date</th>
                                        <th className="py-3 px-4">Time Slot</th>
                                        <th className="py-3 px-4">Chief Complaint</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4">Status</th>
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
                                          <tr key={apt._id || i} className="hover:bg-slate-50/80 transition">
                                            <td className="py-3 px-4 font-mono font-bold text-brand-600">
                                              #{apt.queueNumber || i + 1}
                                            </td>
                                            <td className="py-3 px-4">
                                              <p className="font-bold text-slate-900">{patientName}</p>
                                              {patientId && <p className="text-slate-400 font-mono text-[10px]">{patientId}</p>}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 font-semibold whitespace-nowrap">
                                              {apt.date
                                                ? new Date(apt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                              {apt.timeSlot || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 max-w-[160px] truncate" title={apt.symptoms}>
                                              {apt.symptoms || 'General consultation'}
                                            </td>
                                            <td className="py-3 px-4">
                                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 capitalize text-[10px] font-semibold">
                                                {apt.type?.replace('_', ' ') || 'in person'}
                                              </span>
                                            </td>
                                            <td className="py-3 px-4">
                                              <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${sc.bg} ${sc.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
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
                                  { label: 'Total Booked', value: getDoctorPatients(doc._id, 'all').length, color: 'text-slate-700' },
                                  { label: 'Upcoming',     value: docUpcoming,                               color: 'text-amber-600' },
                                  { label: 'Consulted',    value: docCompleted,                              color: 'text-emerald-600' },
                                ].map(({ label, value, color }) => (
                                  <div key={label} className="bg-white border border-slate-200 rounded-2xl p-3 text-center">
                                    <p className={`text-xl font-extrabold ${color}`}>{value}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{label}</p>
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
