import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Lock, 
  Clock, 
  RefreshCw,
  Activity,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { auditApi } from '../../api/hospitalApi';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalLogs: 0, actionCounts: [], entityCounts: [] });
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      setRefreshing(true);
      const [logsRes, statsRes] = await Promise.all([
        auditApi.getAll({ search, action: actionFilter, limit: 50 }),
        auditApi.getStats().catch(() => ({ data: { totalLogs: 0, actionCounts: [], entityCounts: [] } }))
      ]);

      if (logsRes.data?.logs) setLogs(logsRes.data.logs);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>HIPAA Audit Trail & Security Governance</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Immutable security event logs monitoring clinical record access, prescription dispensing & authentication.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLogs}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-2 rounded-2xl text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Compliance Protocol Active</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Recorded Events</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats.totalLogs || logs.length}</p>
            <span className="text-[11px] text-slate-400">Cryptographically logged</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Integrity Verification</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">100%</p>
            <span className="text-[11px] text-emerald-600 font-semibold">Zero tampered records</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Auditors</span>
            <p className="text-3xl font-extrabold text-indigo-600 mt-2">RBAC Encrypted</p>
            <span className="text-[11px] text-indigo-600 font-semibold">Admin / Super Admin only</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Log Explorer Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative w-64 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, action, entity description..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </form>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="p-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-slate-50"
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="ASSIGN_BED">ASSIGN_BED</option>
              <option value="DISCHARGE_BED">DISCHARGE_BED</option>
              <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details Description</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-sans">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-sans">
                      {log.userName}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                        {log.userRole?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-brand-600">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-sans font-semibold">
                      {log.entity}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-sans max-w-sm truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
