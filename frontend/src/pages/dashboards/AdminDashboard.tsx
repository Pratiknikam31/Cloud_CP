import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Stethoscope, 
  Calendar, 
  BedDouble, 
  FlaskConical, 
  Pill, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  BrainCircuit, 
  AlertTriangle,
  Download,
  ShieldCheck,
  RefreshCw,
  Activity
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { analyticsApi } from '../../api/hospitalApi';

const COLORS = ['#0c93e7', '#4f46e5', '#059669', '#d97706', '#e11d48', '#8b5cf6'];

export const AdminDashboard: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await analyticsApi.getOverview();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load analytics overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportCSV = () => {
    if (!data) return;
    const kpis = data.kpis || {};
    const rows = [
      ['Metric', 'Value'],
      ['Total Patients', kpis.totalPatients || 0],
      ['Active Doctors', kpis.totalDoctors || 0],
      ['Total Appointments', kpis.totalAppointments || 0],
      ['Today Appointments', kpis.todayAppointments || 0],
      ['Total Hospital Beds', kpis.totalBeds || 0],
      ['Occupied Beds', kpis.occupiedBeds || 0],
      ['Bed Occupancy Rate', `${kpis.occupancyRate || 0}%`],
      ['Total Revenue ($)', kpis.totalRevenue || 0],
      ['Pending Revenue ($)', kpis.pendingRevenue || 0],
      ['Low Stock Medicines', kpis.lowStockMeds || 0],
      [],
      ['Department', 'Appointments'],
      ...(data.departmentStats || []).map((d: any) => [d.name, d.count])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CloudCare_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kpis = data?.kpis || {
    totalPatients: 4,
    totalDoctors: 2,
    totalAppointments: 3,
    todayAppointments: 2,
    completedToday: 1,
    totalBeds: 5,
    occupiedBeds: 2,
    occupancyRate: 40,
    totalRevenue: 419,
    pendingRevenue: 185,
    lowStockMeds: 4
  };

  const departmentData = (data?.departmentStats || [
    { name: 'Cardiology', count: 35 },
    { name: 'Neurology', count: 22 },
    { name: 'Orthopedics', count: 18 },
    { name: 'Pediatrics', count: 12 }
  ]).map((d: any, idx: number) => ({
    name: d.name,
    value: d.count,
    color: COLORS[idx % COLORS.length]
  }));

  const chartData = data?.monthlyAppointments || [
    { month: 'May', appointments: 120, revenue: 14200 },
    { month: 'Jun', appointments: 145, revenue: 18500 },
    { month: 'Jul', appointments: 190, revenue: 22400 },
    { month: 'Aug', appointments: 230, revenue: 28900 },
    { month: 'Sep', appointments: 280, revenue: 34100 },
    { month: 'Oct', appointments: 320, revenue: 39500 }
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header & Export / Refresh Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Hospital Operations & Analytics</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Live SaaS telemetry, clinical volumes, and financial operations.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition"
            title="Refresh Data"
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

          <div className="flex items-center space-x-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs text-xs">
            {(['today', 'week', 'month'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDateFilter(filter)}
                className={`px-3 py-1.5 rounded-lg font-bold transition capitalize ${
                  dateFilter === filter 
                    ? 'bg-brand-600 text-white shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {filter === 'today' ? 'Today' : filter === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Insights Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-brand-950 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
                Automated System Triage
              </span>
              <span className="text-xs text-slate-400 font-mono">Live Operational Health</span>
            </div>
            <p className="text-sm font-semibold text-slate-200 mt-1.5">
              Hospital is running smoothly with <span className="text-brand-300 font-bold">{kpis.occupancyRate}% bed occupancy</span>. 
              {kpis.lowStockMeds > 0 
                ? ` ${kpis.lowStockMeds} pharmaceuticals require inventory restock.` 
                : ' All medication supplies are at optimal levels.'}
            </p>
          </div>
        </div>
        <Link 
          to="/admin/beds" 
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shrink-0 transition shadow-md"
        >
          Manage Hospital Beds
        </Link>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Patients */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Patients</span>
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{kpis.totalPatients}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +12%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Registered electronic health records</p>
        </div>

        {/* Active Doctors */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Doctors</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{kpis.totalDoctors}</span>
            <span className="text-xs font-bold text-slate-500">{departmentData.length} Specialties</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Available for OPD & rounds</p>
        </div>

        {/* Today's Appointments */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Appointments Today</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{kpis.todayAppointments}</span>
            <span className="text-xs font-bold text-emerald-600">{kpis.completedToday} Consulted</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{Math.max(0, kpis.todayAppointments - kpis.completedToday)} in queue today</p>
        </div>

        {/* Bed Occupancy */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bed Occupancy</span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <BedDouble className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">{kpis.occupancyRate}%</span>
            <span className="text-xs font-bold text-cyan-700">{kpis.occupiedBeds} / {kpis.totalBeds} Beds</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{Math.max(0, kpis.totalBeds - kpis.occupiedBeds)} beds available</p>
        </div>

        {/* Revenue Collected */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">${(kpis.totalRevenue || 0).toLocaleString()}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +14.2%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Settled payments</p>
        </div>

        {/* Pending Receivables */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Receivables</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900">${(kpis.pendingRevenue || 0).toLocaleString()}</span>
            <span className="text-xs font-bold text-amber-600">Unsettled Invoices</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting checkout settlement</p>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pharmacy Alerts</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-rose-600">{kpis.lowStockMeds}</span>
            <span className="text-xs font-bold text-rose-600 flex items-center">
              <AlertTriangle className="w-3.5 h-3.5 mr-0.5" /> Low Stock
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Requires procurement order</p>
        </div>

        {/* Live System Uptime */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Status</span>
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-teal-600">99.98%</span>
            <span className="text-xs font-bold text-teal-700">Online</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">CloudCare API v1.0 connected</p>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue & Volume Area Chart */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Hospital Patient & Revenue Trajectory</h3>
              <p className="text-slate-500 text-xs">Consultation volumes and revenue realization.</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">Multi-Month Trend</span>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0c93e7" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0c93e7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }} 
                />
                <Area type="monotone" dataKey="revenue" stroke="#0c93e7" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution Donut Chart */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Department Case Distribution</h3>
            <p className="text-slate-500 text-xs">Clinical consultation split across hospital wings.</p>
          </div>

          <div className="h-52 w-full relative my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {departmentData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs font-medium">
            {departmentData.map((item: any) => (
              <div key={item.name} className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 truncate">{item.name}</span>
                <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Audit Activities */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <span>Real-Time Audit Security Log</span>
            </h3>
            <p className="text-slate-500 text-xs">Immutable system actions recorded for compliance and governance.</p>
          </div>
          <Link to="/admin/audit-logs" className="text-xs font-bold text-brand-600 hover:text-brand-700">
            View Complete Logs →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.recentLogs || [
                { userName: 'Dr. Arthur Pendelton', userRole: 'hospital_admin', action: 'CREATE', entity: 'System', description: 'Platform initialization', timestamp: new Date() }
              ]).map((log: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{log.userName}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                      {log.userRole?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-brand-600">{log.action}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{log.entity}</td>
                  <td className="py-3 px-4 text-slate-700 max-w-xs truncate">{log.description}</td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
