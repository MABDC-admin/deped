import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const ReceiptList = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [voidFilter, setVoidFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [voidConfirm, setVoidConfirm] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('receipts')
        .select('*, students(first_name, last_name, lrn)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReceipts(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const totalReceipts = receipts.length;
    const totalCollected = receipts.filter(r => !r.is_void).reduce((a, r) => a + (parseFloat(r.amount) || 0), 0);
    const voidedCount = receipts.filter(r => r.is_void).length;
    const today = new Date().toISOString().split('T')[0];
    const todaysCollection = receipts.filter(r => !r.is_void && r.payment_date && r.payment_date.startsWith(today)).reduce((a, r) => a + (parseFloat(r.amount) || 0), 0);
    return { totalReceipts, totalCollected, voidedCount, todaysCollection };
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts.filter(r => {
      const name = `${r.students?.first_name || ''} ${r.students?.last_name || ''}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase()) || (r.or_number || '').toLowerCase().includes(search.toLowerCase());
      const matchMethod = methodFilter === 'all' || r.payment_method === methodFilter;
      const matchVoid = voidFilter === 'all' || (voidFilter === 'voided' ? r.is_void : !r.is_void);
      const matchDateFrom = !dateFrom || (r.payment_date && r.payment_date >= dateFrom);
      const matchDateTo = !dateTo || (r.payment_date && r.payment_date <= dateTo);
      return matchSearch && matchMethod && matchVoid && matchDateFrom && matchDateTo;
    });
  }, [receipts, search, methodFilter, voidFilter, dateFrom, dateTo]);

  const statusStyles = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    voided: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const methodStyles = {
    cash: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    check: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    bank_transfer: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    online: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  };

  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const handleVoid = async (receipt) => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }
    try {
      const { error } = await supabase.from('receipts').update({
        is_void: true,
        void_reason: voidReason,
        void_date: new Date().toISOString(),
      }).eq('id', receipt.id);
      if (error) throw error;
      toast.success('Receipt voided successfully');
      setVoidConfirm(null);
      setVoidReason('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to void receipt');
    }
  };

  const handlePrint = (receipt) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Receipt ${receipt.or_number}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} h1{color:#1a365d;} .void{color:red;font-size:24px;font-weight:bold;text-align:center;border:3px solid red;padding:10px;margin-top:20px;}</style>
      </head><body>
      <h1>Official Receipt</h1>
      <p><strong>OR #:</strong> ${receipt.or_number}</p>
      <p><strong>Date:</strong> ${receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString() : '—'}</p>
      <p><strong>Student:</strong> ${receipt.students?.first_name || ''} ${receipt.students?.last_name || ''}</p>
      <p><strong>LRN:</strong> ${receipt.students?.lrn || '—'}</p>
      <table>
        <tr><th>Amount</th><td>${formatCurrency(receipt.amount)}</td></tr>
        <tr><th>Payment Method</th><td>${(receipt.payment_method || '—').replace('_', ' ')}</td></tr>
        <tr><th>Cashier</th><td>${receipt.cashier_name || '—'}</td></tr>
      </table>
      ${receipt.remarks ? `<p><strong>Remarks:</strong> ${receipt.remarks}</p>` : ''}
      ${receipt.is_void ? `<div class="void">VOID - ${receipt.void_reason || ''}</div>` : ''}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Receipts', value: stats.totalReceipts, icon: '🧾', color: 'from-blue-500 to-cyan-400', sub: 'all records' },
          { label: 'Total Collected', value: formatCurrency(stats.totalCollected), icon: '💵', color: 'from-emerald-500 to-teal-400', sub: 'excluding voided' },
          { label: 'Voided', value: stats.voidedCount, icon: '🚫', color: 'from-red-500 to-rose-400', sub: 'voided receipts' },
          { label: "Today's Collection", value: formatCurrency(stats.todaysCollection), icon: '📅', color: 'from-purple-500 to-violet-400', sub: 'collected today' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className={`text-xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
                <span className="text-3xl">{s.icon}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 relative w-full sm:max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search by name or OR number..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online</option>
              </select>
              <select value={voidFilter} onChange={e => setVoidFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                <option value="all">All Receipts</option>
                <option value="active">Active Only</option>
                <option value="voided">Voided Only</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <label className="text-sm text-gray-500 dark:text-gray-400">Date Range:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" />
            <span className="text-sm text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-sm text-blue-500 hover:text-blue-600 transition-colors">Clear dates</button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No receipts found" description="No receipt records match your search criteria" />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                <tr>
                  {['OR #', 'Date', 'Student', 'Amount', 'Method', 'Cashier', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, 100).map((receipt, i) => (
                  <motion.tr key={receipt.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className={`hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors cursor-pointer ${receipt.is_void ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedReceipt(receipt)}>
                    <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{receipt.or_number || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{receipt.payment_date ? new Date(receipt.payment_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{receipt.students?.first_name} {receipt.students?.last_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{receipt.students?.lrn || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(receipt.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${methodStyles[receipt.payment_method] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {(receipt.payment_method || '—').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{receipt.cashier_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${receipt.is_void ? statusStyles.voided : statusStyles.active}`}>
                        {receipt.is_void ? 'Voided' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handlePrint(receipt)} className="p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="Print">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                        {!receipt.is_void && (
                          <button onClick={() => { setVoidConfirm(receipt); setVoidReason(''); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Void">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Receipt Detail Modal */}
      <AnimatePresence>
        {selectedReceipt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedReceipt(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-3xl text-white mb-3">🧾</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Receipt Details</h3>
                <p className="text-sm text-gray-400 font-mono">{selectedReceipt.or_number || 'No OR #'}</p>
              </div>
              {selectedReceipt.is_void && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-center">
                  <p className="text-red-600 dark:text-red-400 font-bold text-sm">VOIDED</p>
                  {selectedReceipt.void_reason && <p className="text-red-500 text-xs mt-1">{selectedReceipt.void_reason}</p>}
                </div>
              )}
              <div className="space-y-3">
                {[
                  { label: 'Student', value: `${selectedReceipt.students?.first_name} ${selectedReceipt.students?.last_name}` },
                  { label: 'LRN', value: selectedReceipt.students?.lrn },
                  { label: 'Amount', value: formatCurrency(selectedReceipt.amount) },
                  { label: 'Payment Method', value: (selectedReceipt.payment_method || '').replace('_', ' ') },
                  { label: 'Payment Date', value: selectedReceipt.payment_date ? new Date(selectedReceipt.payment_date).toLocaleDateString() : '—' },
                  { label: 'Cashier', value: selectedReceipt.cashier_name },
                  { label: 'Remarks', value: selectedReceipt.remarks },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-500">{f.label}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{f.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedReceipt(null)}
                className="w-full mt-6 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Void Confirmation Modal */}
      <AnimatePresence>
        {voidConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setVoidConfirm(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-3xl text-white mb-3">🚫</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Void Receipt</h3>
                <p className="text-sm text-gray-500 mt-2">Please provide a reason for voiding receipt <strong>{voidConfirm.or_number}</strong>.</p>
              </div>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm resize-none mt-2" placeholder="Reason for voiding..." />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setVoidConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  Cancel
                </button>
                <button onClick={() => handleVoid(voidConfirm)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium hover:shadow-lg transition-all">
                  Void Receipt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReceiptList;
