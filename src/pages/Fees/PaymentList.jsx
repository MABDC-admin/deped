import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import AnimatedTabs from '../../components/ui/AnimatedTabs';
import EmptyState from '../../components/ui/EmptyState';

const PaymentList = () => {
  const [payments, setPayments] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, feeTypesRes] = await Promise.all([
        supabase.from('payments').select('*, students(first_name, last_name, lrn, sections(name, grade_levels(name))), fee_types(name, category)').order('payment_date', { ascending: false }),
        supabase.from('fee_types').select('*').order('name'),
      ]);
      setPayments(paymentsRes.data || []);
      setFeeTypes(feeTypesRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const totalCollected = payments.filter(p => p.status === 'completed' || p.status === 'paid').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
    const totalPending = payments.filter(p => p.status === 'pending').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
    const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
    return {
      totalCollected, totalPending, totalOverdue,
      transactionCount: payments.length,
      completedCount: payments.filter(p => p.status === 'completed' || p.status === 'paid').length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const name = `${p.students?.first_name || ''} ${p.students?.last_name || ''}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase()) || (p.receipt_number || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [payments, search, statusFilter]);

  const statusStyles = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const tabs = [
    { id: 'transactions', label: 'Transactions', icon: '💰' },
    { id: 'summary', label: 'Fee Summary', icon: '📊' },
  ];

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Revenue Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Collected', value: formatCurrency(stats.totalCollected), icon: '💵', color: 'from-emerald-500 to-teal-400', sub: `${stats.completedCount} payments` },
          { label: 'Pending', value: formatCurrency(stats.totalPending), icon: '⏳', color: 'from-amber-500 to-orange-400', sub: 'awaiting payment' },
          { label: 'Overdue', value: formatCurrency(stats.totalOverdue), icon: '🚨', color: 'from-red-500 to-rose-400', sub: 'needs follow-up' },
          { label: 'Transactions', value: stats.transactionCount, icon: '📋', color: 'from-blue-500 to-cyan-400', sub: 'all records' },
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
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 relative w-full sm:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search by name or receipt number..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>
            <AnimatedTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div key="transactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {filtered.length === 0 ? (
              <EmptyState title="No payments found" description="No payment records match your search" />
            ) : (
              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                      <tr>
                        {['Date', 'Student', 'Grade/Section', 'Fee Type', 'Amount', 'Status', 'Receipt'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filtered.slice(0, 100).map((payment, i) => (
                        <motion.tr key={payment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                          className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                          onClick={() => setSelectedPayment(payment)}>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{payment.students?.first_name} {payment.students?.last_name}</p>
                            <p className="text-xs text-gray-400 font-mono">{payment.students?.lrn || ''}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{payment.students?.sections?.grade_levels?.name} - {payment.students?.sections?.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{payment.fee_types?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[payment.status] || ''}`}>
                              {payment.status || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{payment.receipt_number || '—'}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {activeTab === 'summary' && (
          <motion.div key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span>📊</span> Fee Collection Summary
              </h3>
              <div className="space-y-4">
                {feeTypes.map((ft, i) => {
                  const feePayments = payments.filter(p => p.fee_type_id === ft.id);
                  const collected = feePayments.filter(p => p.status === 'completed' || p.status === 'paid').reduce((a, p) => a + parseFloat(p.amount || 0), 0);
                  const pending = feePayments.filter(p => p.status === 'pending').reduce((a, p) => a + parseFloat(p.amount || 0), 0);
                  const total = collected + pending;
                  const pct = total > 0 ? (collected / total * 100) : 0;
                  return (
                    <motion.div key={ft.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{ft.name}</span>
                        <span className="text-sm text-gray-500">{formatCurrency(collected)} / {formatCurrency(total)}</span>
                      </div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{pct.toFixed(0)}% collected • {feePayments.length} transactions</p>
                    </motion.div>
                  );
                })}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {selectedPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedPayment(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-3xl text-white mb-3">🧾</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Receipt</h3>
                <p className="text-sm text-gray-400 font-mono">{selectedPayment.receipt_number || 'No receipt #'}</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Student', value: `${selectedPayment.students?.first_name} ${selectedPayment.students?.last_name}` },
                  { label: 'LRN', value: selectedPayment.students?.lrn },
                  { label: 'Fee Type', value: selectedPayment.fee_types?.name },
                  { label: 'Amount', value: formatCurrency(selectedPayment.amount) },
                  { label: 'Status', value: selectedPayment.status },
                  { label: 'Date', value: selectedPayment.payment_date ? new Date(selectedPayment.payment_date).toLocaleDateString() : '—' },
                  { label: 'Method', value: selectedPayment.payment_method },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-500">{f.label}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{f.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedPayment(null)}
                className="w-full mt-6 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PaymentList;
