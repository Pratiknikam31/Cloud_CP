import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Pill, 
  Package, 
  AlertTriangle, 
  FileSpreadsheet, 
  CheckCircle2, 
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';
import { pharmacyApi, emrApi } from '../../api/hospitalApi';

export const PharmacyDashboard: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [medsRes, rxRes, predRes] = await Promise.all([
        pharmacyApi.getMedicines({ limit: 50 }),
        emrApi.getPrescriptions({ limit: 50 }).catch(() => ({ data: { prescriptions: [] } })),
        pharmacyApi.getPredictions().catch(() => ({ data: { predictions: [] } }))
      ]);

      if (medsRes.data?.medicines) setMedicines(medsRes.data.medicines);
      // GET /emr/prescriptions returns { success, prescriptions } at the top level.
      const rxList = (rxRes as any).prescriptions ?? rxRes.data?.prescriptions;
      if (rxList) setPrescriptions(rxList);
      if (predRes.data?.predictions) setPredictions(predRes.data.predictions);
    } catch (err) {
      console.error('Failed to load pharmacy dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispense = async (prescriptionId: string) => {
    try {
      await pharmacyApi.dispensePrescription(prescriptionId);
      fetchData();
    } catch (err) {
      console.error('Failed to dispense prescription:', err);
    }
  };

  const lowStockCount = medicines.filter(m => m.status === 'low_stock' || m.status === 'out_of_stock').length;
  const dispensedCount = prescriptions.filter(p => p.status === 'dispensed').length;
  const pendingRxCount = prescriptions.filter(p => p.status !== 'dispensed').length;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Pharmacy Operations & Prescription Dispensing</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Dispense electronic doctor prescriptions and monitor AI smart inventory depletion alerts.</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/pharmacy/inventory"
            className="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition flex items-center space-x-2"
          >
            <Package className="w-4 h-4" />
            <span>Manage Catalog & Stock</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Medicines</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{medicines.length}</p>
            <span className="text-[11px] text-slate-400">In hospital formulary</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Warnings</span>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">{lowStockCount}</p>
            <span className="text-[11px] text-rose-600 font-semibold">Immediate reorder</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Orders</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{pendingRxCount}</p>
            <span className="text-[11px] text-amber-600 font-semibold">Awaiting fulfillment</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispensed Total</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{dispensedCount}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">Completed orders</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Prescription Dispense Queue */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Electronic Prescription Fulfillment Queue</h3>
            <p className="text-slate-500 text-xs">Verify doctor electronic orders and execute inventory fulfillment.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
            Real-time Formulary Sync
          </span>
        </div>

        <div className="space-y-4">
          {prescriptions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No active prescriptions in the queue.
            </div>
          ) : (
            prescriptions.map((rx) => {
              const isDispensed = rx.status === 'dispensed';

              return (
                <div key={rx._id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-brand-600 text-xs">{rx.prescriptionId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isDispensed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {rx.status || 'Active'}
                      </span>
                    </div>

                    <p className="font-bold text-slate-900 text-sm">
                      Patient: {rx.patient?.name || 'Patient'} <span className="text-slate-400 font-normal">({rx.patient?.patientId})</span>
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {rx.medicines?.map((med: any, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700">
                          {med.medicineName} ({med.dosage}) — {med.frequency}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center space-x-3">
                    {!isDispensed ? (
                      <button
                        onClick={() => handleDispense(rx._id)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center space-x-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Dispense Prescription</span>
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center space-x-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Dispensed</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
