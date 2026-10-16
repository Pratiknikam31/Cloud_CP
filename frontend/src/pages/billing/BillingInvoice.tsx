import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  DollarSign, 
  Printer, 
  CheckCircle2, 
  FileText, 
  Download, 
  RefreshCw,
  Plus,
  Clock,
  CreditCard
} from 'lucide-react';
import { billingApi, patientApi } from '../../api/hospitalApi';

export const BillingInvoice: React.FC = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [stats, setStats] = useState<any>({ totalRevenue: 0, totalPending: 0, totalInvoices: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [billsRes, statsRes] = await Promise.all([
        billingApi.getBills({ limit: 50 }),
        billingApi.getStats().catch(() => ({ data: { totalRevenue: 0, totalPending: 0, totalInvoices: 0 } }))
      ]);

      const fetchedBills = billsRes.bills || billsRes.data?.bills || [];
      setBills(fetchedBills);
      if (fetchedBills.length > 0 && !selectedBill) {
        setSelectedBill(fetchedBills[0]);
        setPaymentAmount(fetchedBills[0].balance || 0);
      }
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || paymentAmount <= 0) return;
    try {
      const res = await billingApi.recordPayment(selectedBill._id, Number(paymentAmount));
      if (res.data?.bill) {
        setSelectedBill(res.data.bill);
      }
      setShowPaymentModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to record payment:', err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-3">
            <span>Billing, Invoices & Payment Ledger</span>
            {refreshing && <RefreshCw className="w-5 h-5 text-brand-600 animate-spin" />}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Official hospital invoices, clinical fee collections, and itemized receipts.</p>
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
            onClick={() => window.print()}
            className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-brand-600 text-white font-bold text-sm transition flex items-center space-x-2 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue Collected</span>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">${(stats.totalRevenue || 0).toLocaleString()}</p>
            <span className="text-[11px] text-slate-400">Settled in bank accounts</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Balance</span>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">${(stats.totalPending || 0).toLocaleString()}</p>
            <span className="text-[11px] text-amber-600 font-semibold">{stats.pendingCount || 0} Unpaid invoices</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invoices Issued</span>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{bills.length}</p>
            <span className="text-[11px] text-slate-400">Total patient bills</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Content Layout: Invoices Selector List + Selected Invoice Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Invoice List Panel */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 max-h-[700px] overflow-y-auto">
          <h3 className="font-bold text-slate-900 text-sm">Patient Invoice Directory</h3>
          <div className="space-y-2">
            {bills.map((b) => {
              const isSelected = selectedBill?._id === b._id;
              const isPaid = b.status === 'paid';

              return (
                <div
                  key={b._id}
                  onClick={() => { setSelectedBill(b); setPaymentAmount(b.balance || 0); }}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition text-xs space-y-1.5 ${
                    isSelected 
                      ? 'bg-brand-50/70 border-brand-500 shadow-xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-extrabold text-brand-600">{b.billId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      isPaid 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {b.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900">{b.patient?.name || 'Patient'}</p>
                  <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                    <span>Total: ${b.totalAmount}</span>
                    <span className="font-bold text-slate-700">Balance: ${b.balance}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Invoice View Document Box */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-8">
          {selectedBill ? (
            <>
              {/* Invoice Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-6 gap-4">
                <div>
                  <div className="flex items-center space-x-2 text-brand-600 font-extrabold text-xl">
                    <Receipt className="w-6 h-6" />
                    <span>CloudCare Medical Center Inc.</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">742 Evergreen Medical Parkway, Healthcare Wing A</p>
                </div>

                <div className="text-left sm:text-right">
                  <span className={`px-3 py-1 rounded-full font-extrabold text-xs uppercase ${
                    selectedBill.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {selectedBill.status === 'paid' ? 'PAID IN FULL' : `PENDING BALANCE ($${selectedBill.balance})`}
                  </span>
                  <p className="font-mono font-extrabold text-slate-900 text-base mt-2">{selectedBill.billId}</p>
                  <span className="text-xs text-slate-400">
                    Date: {new Date(selectedBill.invoiceDate || selectedBill.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Patient & Account Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Patient Details</span>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">{selectedBill.patient?.name || 'Patient'}</p>
                  <p className="text-slate-600">ID: {selectedBill.patient?.patientId}</p>
                  <p className="text-slate-600">{selectedBill.patient?.phone || 'Phone on file'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Payment Status</span>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    Paid: <span className="text-emerald-600 font-extrabold">${selectedBill.paidAmount}</span>
                  </p>
                  <p className="text-slate-600">
                    Remaining: <span className="text-rose-600 font-extrabold">${selectedBill.balance}</span>
                  </p>
                  <p className="text-slate-400">Due Date: {new Date(selectedBill.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Itemized Line Items */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Item Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Qty</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBill.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{item.description}</td>
                        <td className="py-3 px-4 text-slate-500 capitalize">{item.category}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{item.quantity || 1}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">${item.amount?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Strip */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-900">${selectedBill.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Discount</span>
                    <span className="font-bold text-emerald-600">-${selectedBill.discount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Tax</span>
                    <span className="font-bold text-slate-900">+${selectedBill.tax?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-slate-900">
                    <span>Total Bill</span>
                    <span>${selectedBill.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Action Button */}
              {selectedBill.balance > 0 && (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-md hover:opacity-95 transition flex items-center space-x-2 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Record Payment on Invoice</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              Select an invoice from the directory to inspect details.
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900">
              Record Payment: {selectedBill.billId}
            </h3>
            <p className="text-xs text-slate-500">Remaining Outstanding Balance: ${selectedBill.balance}</p>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedBill.balance}
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
