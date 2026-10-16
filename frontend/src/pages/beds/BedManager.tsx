import React, { useEffect, useState } from 'react';
import { 
  BedDouble, 
  CheckCircle2, 
  AlertCircle, 
  Wrench, 
  Building2, 
  User, 
  RefreshCw,
  LogOut,
  UserPlus
} from 'lucide-react';
import { bedApi, patientApi } from '../../api/hospitalApi';

export const BedManager: React.FC = () => {
  const [beds, setBeds] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalBeds: 0, occupied: 0, available: 0, occupancyRate: 0 });
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assign modal state
  const [selectedBedForAssign, setSelectedBedForAssign] = useState<any>(null);
  const [assignPatientId, setAssignPatientId] = useState<string>('');

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [bedsRes, roomsRes, patsRes] = await Promise.all([
        bedApi.getBeds(),
        bedApi.getRooms(),
        patientApi.getAll()
      ]);

      if (bedsRes.data?.beds) {
        setBeds(bedsRes.data.beds);
        if (bedsRes.data?.stats) setStats(bedsRes.data.stats);
      }
      if (roomsRes.data?.rooms) setRooms(roomsRes.data.rooms);
      if (patsRes.patients || patsRes.data?.patients) {
        setPatients(patsRes.patients || patsRes.data?.patients);
        if ((patsRes.patients || patsRes.data?.patients).length > 0) {
          setAssignPatientId((patsRes.patients || patsRes.data?.patients)[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load beds data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDischarge = async (bedId: string) => {
    try {
      await bedApi.dischargeBed(bedId);
      fetchData();
    } catch (err) {
      console.error('Failed to discharge bed:', err);
    }
  };

  const handleAssignBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForAssign || !assignPatientId) return;
    try {
      await bedApi.assignBed(selectedBedForAssign._id, assignPatientId);
      setSelectedBedForAssign(null);
      fetchData();
    } catch (err) {
      console.error('Failed to assign bed:', err);
    }
  };

  const handleStatusChange = async (bedId: string, status: string) => {
    try {
      await bedApi.updateBed(bedId, { status });
      fetchData();
    } catch (err) {
      console.error('Failed to update bed status:', err);
    }
  };

  const filteredBeds = selectedWard === 'all' 
    ? beds 
    : beds.filter(b => b.room?.roomType === selectedWard);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Hospital Bed & Ward Management</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Live inpatient bed occupancy matrix, ICU monitoring, and admission allocations.</p>
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
              onClick={() => setSelectedWard('all')}
              className={`px-3 py-1.5 rounded-lg transition ${selectedWard === 'all' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              All Wings
            </button>
            <button
              onClick={() => setSelectedWard('icu')}
              className={`px-3 py-1.5 rounded-lg transition ${selectedWard === 'icu' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              ICU
            </button>
            <button
              onClick={() => setSelectedWard('general')}
              className={`px-3 py-1.5 rounded-lg transition ${selectedWard === 'general' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              General Wards
            </button>
            <button
              onClick={() => setSelectedWard('private')}
              className={`px-3 py-1.5 rounded-lg transition ${selectedWard === 'private' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Private Suites
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bed Capacity</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{stats.totalBeds}</p>
            <span className="text-[11px] text-slate-400">Licensed inpatient beds</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <BedDouble className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Occupied Beds</span>
            <p className="text-3xl font-extrabold text-brand-600 mt-2">{stats.occupied}</p>
            <span className="text-[11px] text-brand-600 font-semibold">{stats.occupancyRate}% Occupancy Rate</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Beds</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">{stats.available}</p>
            <span className="text-[11px] text-emerald-600 font-semibold">Ready for admission</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Under Maintenance</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">{stats.maintenance || 0}</p>
            <span className="text-[11px] text-amber-600 font-semibold">Sanitization / Repairs</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Bed Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Live Bed Occupancy Grid</h3>
            <p className="text-slate-500 text-xs">Visual floor map and patient bed assignment statuses.</p>
          </div>
          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Available</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-brand-600" />
              <span>Occupied</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Maintenance</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBeds.map((bed) => {
            const isOccupied = bed.status === 'occupied';
            const isAvailable = bed.status === 'available';
            const isMaintenance = bed.status === 'maintenance';
            const patientName = bed.currentPatient?.name;
            const patientId = bed.currentPatient?.patientId;

            return (
              <div
                key={bed._id}
                className={`p-5 rounded-2xl border transition-all ${
                  isOccupied
                    ? 'bg-brand-50/50 border-brand-200 shadow-xs'
                    : isAvailable
                    ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-400'
                    : 'bg-amber-50/40 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-base text-slate-900 font-mono">{bed.bedNumber}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                      {bed.room?.roomType || 'General'}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isOccupied 
                      ? 'bg-brand-600 text-white' 
                      : isAvailable 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-amber-600 text-white'
                  }`}>
                    {bed.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs mb-4">
                  <p className="text-slate-500">
                    Room: <strong className="text-slate-800">{bed.room?.roomNumber || 'R-101'}</strong> ({bed.room?.building}, {bed.room?.floor})
                  </p>
                  <p className="text-slate-500">Rate: <strong className="text-slate-800">${bed.room?.ratePerDay || 150}/day</strong></p>
                  {isOccupied && patientName && (
                    <div className="pt-2 border-t border-brand-100">
                      <p className="font-bold text-slate-900 flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-brand-600" />
                        <span>{patientName}</span>
                      </p>
                      <span className="text-[11px] text-slate-400 font-mono">Patient ID: {patientId}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                  {isAvailable && (
                    <button
                      onClick={() => setSelectedBedForAssign(bed)}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign Patient</span>
                    </button>
                  )}

                  {isOccupied && (
                    <button
                      onClick={() => handleDischarge(bed._id)}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-rose-600 text-white font-bold text-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Discharge Patient</span>
                    </button>
                  )}

                  {isMaintenance && (
                    <button
                      onClick={() => handleStatusChange(bed._id, 'available')}
                      className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Mark Available
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assign Patient Modal */}
      {selectedBedForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900">
              Assign Bed: {selectedBedForAssign.bedNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Room: {selectedBedForAssign.room?.roomNumber} ({selectedBedForAssign.room?.roomType})
            </p>

            <form onSubmit={handleAssignBed} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Patient to Admit</label>
                <select
                  value={assignPatientId}
                  onChange={(e) => setAssignPatientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold bg-slate-50"
                >
                  {patients.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.patientId}) — {p.bloodGroup}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBedForAssign(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold cursor-pointer"
                >
                  Confirm Bed Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
