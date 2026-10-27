import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, 
  BedDouble, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Filter, 
  RefreshCw, 
  User, 
  FileText,
  Activity,
  Check,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { nurseApi, bedApi, patientApi } from '../../api/hospitalApi';

interface CareTask {
  _id: string;
  taskId: string;
  patient: any;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  assignedNurseName?: string;
  notes?: string;
  createdAt: string;
}

export const NurseDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeInpatients: 0,
    todayAppointments: 0,
    pendingTasks: 0,
    completedTasks: 0,
  });
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal state for creating new care task
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTaskPatient, setNewTaskPatient] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [dashRes, tasksRes, bedsRes, patientsRes] = await Promise.all([
        nurseApi.getDashboard().catch(() => ({ data: { stats: {} } })),
        nurseApi.getTasks().catch(() => ({ data: { tasks: [] } })),
        bedApi.getBeds({ limit: 20 }).catch(() => ({ data: { beds: [] } })),
        patientApi.getAll({ limit: 50 }).catch(() => ({ data: { patients: [] } })),
      ]);

      if (dashRes?.data?.stats) {
        setStats({
          activeInpatients: dashRes.data.stats.activeInpatients || 0,
          todayAppointments: dashRes.data.stats.todayAppointments || 0,
          pendingTasks: dashRes.data.stats.pendingTasks || 0,
          completedTasks: dashRes.data.stats.completedTasks || 0,
        });
      }

      if (tasksRes?.data?.tasks) {
        setTasks(tasksRes.data.tasks);
      }

      const bedList = bedsRes.beds || bedsRes.data?.beds || [];
      setBeds(bedList);

      const patientList = patientsRes.patients || patientsRes.data?.patients || [];
      setPatients(patientList);
    } catch (err) {
      console.error('Error loading nurse station data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'pending' | 'in_progress' | 'completed') => {
    try {
      await nurseApi.updateTask(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
      if (newStatus === 'completed') {
        setStats(prev => ({
          ...prev,
          completedTasks: prev.completedTasks + 1,
          pendingTasks: Math.max(0, prev.pendingTasks - 1),
        }));
      }
    } catch (err: any) {
      console.error('Failed to update task:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskPatient || !newTaskTitle) {
      setErrorMsg('Please select a patient and provide a task title.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await nurseApi.createTask({
        patient: newTaskPatient,
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        notes: newTaskNotes,
      });

      if (res.data?.task) {
        const created = res.data.task;
        const patObj = patients.find(p => p._id === newTaskPatient);
        if (patObj) created.patient = patObj;
        setTasks(prev => [created, ...prev]);
        setStats(prev => ({ ...prev, pendingTasks: prev.pendingTasks + 1 }));
      }

      setShowCreateModal(false);
      setNewTaskPatient('');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskPriority('medium');
      setNewTaskNotes('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create care task.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">URGENT</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">LOW</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Station Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <HeartPulse className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nurse Station Command</h1>
              <p className="text-xs text-slate-500 font-medium">Inpatient Ward Management & Clinical Nursing Care Plans</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Station"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Care Task</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Occupied Beds</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.activeInpatients}</h3>
            <p className="text-xs text-teal-600 font-medium mt-1">Inpatient Ward</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <BedDouble className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Visits</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.todayAppointments}</h3>
            <p className="text-xs text-blue-600 font-medium mt-1">Consultation Schedule</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Care Tasks</p>
            <h3 className="text-3xl font-extrabold text-amber-600 mt-1">{stats.pendingTasks}</h3>
            <p className="text-xs text-amber-600 font-medium mt-1">Pending Nurse Action</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Today</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{stats.completedTasks}</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1">Care Plans Executed</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content: Tasks List & Inpatient Ward Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Care Tasks (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Clinical Care Tasks & Vitals</h2>
              <p className="text-xs text-slate-500">Scheduled nursing interventions, medication administration & vitals monitoring</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1" /> Filter:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="p-5 flex-1 divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Loading station care tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                No care tasks found under current filter.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div key={task._id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono text-slate-400">{task.taskId}</span>
                      {getPriorityBadge(task.priority)}
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Patient: {task.patient?.name || (typeof task.patient === 'string' ? task.patient : 'Patient')}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                    {task.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>
                    )}
                    {task.notes && (
                      <p className="text-[11px] text-teal-700 font-medium">Notes: {task.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    {task.status !== 'completed' ? (
                      <>
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateTaskStatus(task._id, 'in_progress')}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-colors"
                          >
                            Start Task
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateTaskStatus(task._id, 'completed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1 transition-colors shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inpatient Ward Overview (1 Column) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Ward Occupancy</h2>
            <p className="text-xs text-slate-500">Live bed status across general & ICU wards</p>
          </div>

          <div className="p-5 divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
            {beds.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">No bed records loaded</p>
            ) : (
              beds.map((b) => (
                <div key={b._id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold ${
                      b.status === 'occupied' 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {b.bedNumber || 'B'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Bed {b.bedNumber}</p>
                      <p className="text-[11px] text-slate-400">
                        {b.status === 'occupied' ? (
                          <span className="text-rose-600 font-medium">Occupied ({b.currentPatient?.name || 'Patient'})</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">Available</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    b.status === 'occupied' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {b.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Create Care Task */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <h3 className="text-xl font-bold text-slate-900 mb-1">New Nursing Care Plan / Task</h3>
            <p className="text-xs text-slate-500 mb-4">Assign a clinical task or scheduled check for a patient.</p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Select Patient</label>
                <select
                  required
                  value={newTaskPatient}
                  onChange={(e) => setNewTaskPatient(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.patientId || p._id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g., Administer IV antibiotic, Check vitals Q4H"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Assigned Nurse</label>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Current Nurse'}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-100 text-slate-500 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Description & Instructions</label>
                <textarea
                  rows={2}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Clinical guidelines, dosage instructions, or observations..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Special Notes</label>
                <input
                  type="text"
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  placeholder="e.g. Allergies: Penicillin, Patient prefers right arm"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Care Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
