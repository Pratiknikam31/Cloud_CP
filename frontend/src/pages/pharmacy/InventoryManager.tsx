import React, { useEffect, useState } from 'react';
import { 
  Pill, 
  Package, 
  AlertTriangle, 
  Plus, 
  Search, 
  CheckCircle2, 
  BrainCircuit,
  RefreshCw,
  TrendingDown,
  ArrowUpDown
} from 'lucide-react';
import { pharmacyApi } from '../../api/hospitalApi';

export const InventoryManager: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [predictionSummary, setPredictionSummary] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMedForAdjust, setSelectedMedForAdjust] = useState<any>(null);

  // New med form state
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    category: 'Antibiotic',
    manufacturer: '',
    batchNumber: '',
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    quantity: 50,
    unitPrice: 15.0,
    minStockLevel: 20,
    dailyAvgUsage: 5,
    location: 'Shelf A'
  });

  // Adjust stock state
  const [adjustData, setAdjustData] = useState({
    quantity: 20,
    type: 'stock_in',
    reason: 'Routine warehouse replenishment'
  });

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [medRes, predRes] = await Promise.all([
        pharmacyApi.getMedicines({ limit: 50 }),
        pharmacyApi.getPredictions().catch(() => ({ data: { predictions: [], summary: {} } }))
      ]);

      if (medRes.data?.medicines) {
        setMedicines(medRes.data.medicines);
      }
      if (predRes.data?.predictions) {
        setPredictions(predRes.data.predictions);
        setPredictionSummary(predRes.data.summary);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await pharmacyApi.createMedicine({
        ...formData,
        quantity: Number(formData.quantity),
        unitPrice: Number(formData.unitPrice),
        minStockLevel: Number(formData.minStockLevel),
        dailyAvgUsage: Number(formData.dailyAvgUsage)
      });
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create medicine:', err);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedForAdjust) return;
    try {
      await pharmacyApi.adjustStock(selectedMedForAdjust._id, {
        quantity: Number(adjustData.quantity),
        type: adjustData.type,
        reason: adjustData.reason
      });
      setSelectedMedForAdjust(null);
      fetchData();
    } catch (err) {
      console.error('Failed to adjust stock:', err);
    }
  };

  const filteredMedicines = medicines.filter(m =>
    `${m.name} ${m.genericName} ${m.category} ${m.manufacturer}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Pharmacy Inventory & Stock Forecast</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Real-time pharmaceuticals catalog, minimum stock triggers, and AI replenishment predictions.</p>
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
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-medical-teal hover:opacity-95 text-white font-bold text-sm shadow-md transition flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medicine</span>
          </button>
        </div>
      </div>

      {/* AI Forecasting Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-brand-950 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 shrink-0">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
                Automated Inventory Depletion Prediction
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-200 mt-1">
              {predictionSummary?.criticalCount || 0} drugs currently in critical depletion zone (&lt;3 days stock remaining).
              Procurement orders recommended to avoid prescription dispense delays.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Drug Items</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{medicines.length}</p>
            <span className="text-[11px] text-slate-400">Live in catalog</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Pill className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Warnings</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">
              {medicines.filter(m => m.status === 'low_stock').length}
            </p>
            <span className="text-[11px] text-amber-600 font-semibold">Below min threshold</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Out of Stock</span>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">
              {medicines.filter(m => m.status === 'out_of_stock').length}
            </p>
            <span className="text-[11px] text-rose-600 font-semibold">Immediate reorder</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Optimal Levels</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">
              {medicines.filter(m => m.status === 'in_stock').length}
            </p>
            <span className="text-[11px] text-emerald-600 font-semibold">Healthy inventory</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="relative w-64 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, generic, category..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Item Code</th>
                <th className="py-3 px-4">Brand / Generic Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Stock In Hand</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.map((m) => (
                <tr key={m._id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-brand-600">{m.medicineId}</td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900 text-xs">{m.name}</p>
                    <p className="text-[11px] text-slate-400">{m.genericName} • {m.manufacturer}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{m.category}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {m.quantity} units <span className="text-slate-400 font-normal">(Min: {m.minStockLevel})</span>
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-900">${m.unitPrice?.toFixed(2)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      m.status === 'out_of_stock'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : m.status === 'low_stock'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {m.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedMedForAdjust(m)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Adjust</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {selectedMedForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900">
              Adjust Stock: {selectedMedForAdjust.name}
            </h3>
            <p className="text-xs text-slate-500">Current Quantity: {selectedMedForAdjust.quantity} units</p>

            <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustData.type}
                  onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                >
                  <option value="stock_in">Stock In (Replenish)</option>
                  <option value="stock_out">Stock Out (Dispensed/Used)</option>
                  <option value="adjustment">Direct Quantity Override</option>
                  <option value="expired">Mark Expired</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedMedForAdjust(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-lg text-slate-900">Add New Medication to Pharmacy</h3>

            <form onSubmit={handleCreateMedicine} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trade/Brand Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="e.g. Lipitor 20mg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Generic Name</label>
                  <input
                    type="text"
                    required
                    value={formData.genericName}
                    onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="e.g. Atorvastatin"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    required
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="e.g. Pfizer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    required
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    placeholder="BTH-1092"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold cursor-pointer"
                >
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
