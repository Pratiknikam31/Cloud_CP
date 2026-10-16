import React, { useState, useEffect } from 'react';
import { 
  FlaskConical, 
  FileText, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  AlertTriangle,
  Plus,
  ArrowRight,
  User
} from 'lucide-react';
import { labApi } from '../../api/hospitalApi';

export const LabDashboard: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Result entry state
  const [resultItem, setResultItem] = useState({
    parameter: 'Total Cholesterol',
    result: '210',
    unit: 'mg/dL',
    normalRange: '< 200',
    isAbnormal: true
  });

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [reportsRes, testsRes] = await Promise.all([
        labApi.getReports({ status: statusFilter }),
        labApi.getTests()
      ]);

      const fetchedReports = reportsRes.data?.reports || reportsRes.reports || [];
      const fetchedTests = testsRes.data?.tests || testsRes.tests || [];

      setReports(fetchedReports);
      setTests(fetchedTests);
      if (fetchedReports.length > 0 && !selectedReport) {
        setSelectedReport(fetchedReports[0]);
      }
    } catch (err) {
      console.error('Failed to load lab data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleUpdateStatus = async (reportId: string, status: string) => {
    try {
      await labApi.updateReport(reportId, { status });
      fetchData();
    } catch (err) {
      console.error('Failed to update report status:', err);
    }
  };

  const handleAddResultItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;
    try {
      const existing = selectedReport.results || [];
      const updated = [...existing, resultItem];
      const res = await labApi.updateReport(selectedReport._id, {
        results: updated,
        status: 'completed'
      });
      if (res.data?.report) {
        setSelectedReport(res.data.report);
      }
      fetchData();
    } catch (err) {
      console.error('Failed to append lab result:', err);
    }
  };

  const requestedCount = reports.filter(r => r.status === 'requested').length;
  const processingCount = reports.filter(r => r.status === 'processing' || r.status === 'sample_collected').length;
  const completedCount = reports.filter(r => r.status === 'completed').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Laboratory Diagnostics Workspace</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage diagnostic test catalog, specimen processing, and automated report validation.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center space-x-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs text-xs font-bold">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === '' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('requested')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'requested' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Requested
            </button>
            <button
              onClick={() => setStatusFilter('processing')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'processing' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Processing
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'completed' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Requisitions</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{requestedCount}</p>
            <span className="text-[11px] text-amber-600 font-semibold">Awaiting specimen collection</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Processing Samples</span>
            <p className="text-3xl font-extrabold text-brand-600 mt-2">{processingCount}</p>
            <span className="text-[11px] text-brand-600 font-semibold">In laboratory analyzer</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Reports</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{completedCount}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">Published to patient EMR</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Requisitions List & Detailed Report Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Requisitions List */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 max-h-[700px] overflow-y-auto">
          <h3 className="font-bold text-slate-900 text-sm">Diagnostic Requisitions ({reports.length})</h3>
          <div className="space-y-2">
            {reports.map((r) => {
              const isSelected = selectedReport?._id === r._id;
              const isCompleted = r.status === 'completed';

              return (
                <div
                  key={r._id}
                  onClick={() => setSelectedReport(r)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition text-xs space-y-2 ${
                    isSelected 
                      ? 'bg-brand-50/70 border-brand-500 shadow-xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-brand-600">{r.reportId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      isCompleted 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : r.status === 'processing'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {r.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <p className="font-bold text-slate-900 text-sm">{r.labTest?.name || 'Diagnostic Test'}</p>
                    <p className="text-slate-500 text-[11px]">
                      Patient: <strong className="text-slate-700">{r.patient?.name}</strong> • Dr. {r.doctor?.name}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400">
                      Req: {new Date(r.requestedDate || r.createdAt).toLocaleDateString()}
                    </span>
                    <select
                      value={r.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateStatus(r._id, e.target.value)}
                      className="p-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-700 outline-none"
                    >
                      <option value="requested">Requested</option>
                      <option value="sample_collected">Sample Collected</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Report Inspection Panel */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          {selectedReport ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                    {selectedReport.reportId}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-xl mt-1">
                    {selectedReport.labTest?.name}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Normal Reference: {selectedReport.labTest?.normalRange || 'Standard clinical range'}
                  </p>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  selectedReport.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedReport.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Patient and Doctor Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Subject Patient</span>
                  <p className="font-bold text-slate-900">{selectedReport.patient?.name}</p>
                  <p className="text-slate-500 font-mono text-[11px]">{selectedReport.patient?.patientId}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">Requesting Physician</span>
                  <p className="font-bold text-slate-900">{selectedReport.doctor?.name}</p>
                  <p className="text-slate-500 text-[11px]">{selectedReport.doctor?.specialization}</p>
                </div>
              </div>

              {/* Results Table */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Quantified Parameter Results</h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Parameter</th>
                        <th className="py-2.5 px-3">Result Value</th>
                        <th className="py-2.5 px-3">Reference Range</th>
                        <th className="py-2.5 px-3 text-right">Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {(selectedReport.results || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 font-sans text-xs">
                            No specimen values entered yet. Use the entry box below.
                          </td>
                        </tr>
                      ) : (
                        selectedReport.results.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-sans font-bold text-slate-800">{item.parameter}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.result} {item.unit}</td>
                            <td className="py-2.5 px-3 text-slate-500">{item.normalRange}</td>
                            <td className="py-2.5 px-3 text-right">
                              {item.isAbnormal ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                                  ABNORMAL
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                  NORMAL
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Enter Parameter Value Form */}
              <form onSubmit={handleAddResultItem} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <span className="font-bold text-slate-800 block">Enter Diagnostic Reading:</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Parameter"
                    value={resultItem.parameter}
                    onChange={(e) => setResultItem({ ...resultItem, parameter: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Result value"
                    value={resultItem.result}
                    onChange={(e) => setResultItem({ ...resultItem, result: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Unit (e.g. mg/dL)"
                    value={resultItem.unit}
                    onChange={(e) => setResultItem({ ...resultItem, unit: e.target.value })}
                    className="p-2 rounded-xl border border-slate-200 bg-white"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold cursor-pointer"
                  >
                    Add & Publish Result
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              Select a lab report requisition to view parameters and input diagnostic values.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
