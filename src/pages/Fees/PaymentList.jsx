import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getSavedCashierSchoolYearId, saveCashierSchoolYearId } from '../../lib/schoolYearSelection';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import AnimatedTabs from '../../components/ui/AnimatedTabs';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const formatPaymentMethod = (value) =>
  String(value || 'cash')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const getReceiptNumber = (payment) =>
  payment?.or_number || payment?.receipt_number || payment?.reference_number || '—';

const getPaymentDisplayStatus = (payment) => {
  if (payment?.is_refunded) return 'refunded';

  const feeIsPaid = payment?.student_fees?.status === 'paid' || parseFloat(payment?.student_fees?.balance || 0) <= 0;
  if (feeIsPaid && ['completed', 'paid'].includes(payment?.status || 'completed')) return 'paid';

  return payment?.status || '';
};

const getGradeSection = (payment) => {
  const grade = payment?.enrollment?.grade_levels?.name;
  const section = payment?.enrollment?.sections?.name;
  return [grade, section].filter(Boolean).join(' - ') || '—';
};

const PaymentList = () => {
  const location = useLocation();
  const [payments, setPayments] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [selectedSY, setSelectedSY] = useState('');
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState(null);

  useEffect(() => { fetchSchoolYears(); }, [location.search]);

  useEffect(() => {
    if (!selectedSY) return;
    const nextYear = schoolYears.find(y => y.id === selectedSY) || null;
    setSelectedYear(nextYear);
    saveCashierSchoolYearId(selectedSY);
    setSearch('');
    fetchData(selectedSY);
  }, [selectedSY]);

  const fetchSchoolYears = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('school_years')
        .select('id, year_name, status, is_current, start_date')
        .order('start_date', { ascending: false });
      if (error) throw error;

      const years = data || [];
      const requestedYear = new URLSearchParams(location.search).get('school_year_id');
      const savedYear = getSavedCashierSchoolYearId();
      const nextYear = years.find(y => y.id === requestedYear)
        || years.find(y => y.id === savedYear)
        || years.find(y => y.is_current || y.status === 'active')
        || years[0];

      setSchoolYears(years);
      setSelectedYear(nextYear || null);
      if (nextYear) {
        if (selectedSY === nextYear.id) await fetchData(nextYear.id);
        else setSelectedSY(nextYear.id);
      } else {
        setPayments([]);
        setFeeTypes([]);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load school years');
      setLoading(false);
    }
  };

  const fetchYearEnrollmentMap = async (schoolYearId) => {
    const { data, error } = await supabase
      .from('enrollments')
      .select('student_id, grade_levels(name), sections(name)')
      .eq('school_year_id', schoolYearId)
      .eq('status', 'enrolled');

    if (error) {
      console.error(error);
      return {};
    }

    return (data || []).reduce((map, enrollment) => {
      map[enrollment.student_id] = enrollment;
      return map;
    }, {});
  };

  const fetchData = async (schoolYearId = selectedSY) => {
    if (!schoolYearId) return;
    setLoading(true);
    try {
      const [paymentsRes, feeTypesRes, enrollmentMap] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, payment_method, payment_date, created_at, status, receipt_number, or_number, reference_number, remarks, is_refunded, fee_type_id, student_id, students(id, first_name, last_name, lrn), student_fees!inner(id, school_year_id, balance, status, school_years(year_name))')
          .eq('student_fees.school_year_id', schoolYearId)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.from('fee_types').select('id, name, school_year_id, is_active').order('name'),
        fetchYearEnrollmentMap(schoolYearId),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (feeTypesRes.error) throw feeTypesRes.error;

      const feeTypeById = (feeTypesRes.data || []).reduce((map, feeType) => {
        map[feeType.id] = feeType;
        return map;
      }, {});

      setPayments((paymentsRes.data || []).map(payment => ({
        ...payment,
        fee_type: feeTypeById[payment.fee_type_id] || null,
        enrollment: enrollmentMap[payment.student_id] || null,
      })));
      setFeeTypes(feeTypesRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to load payment records');
      setPayments([]);
      setFeeTypes([]);
    }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const validPayments = payments.filter(p => !p.is_refunded);
    const totalCollected = validPayments.filter(p => p.status === 'completed' || p.status === 'paid').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
    const totalPending = validPayments.filter(p => p.status === 'pending').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
    const totalOverdue = validPayments.filter(p => p.status === 'overdue').reduce((a, p) => a + (parseFloat(p.amount) || 0), 0);
    return {
      totalCollected, totalPending, totalOverdue,
      transactionCount: payments.length,
      completedCount: validPayments.filter(p => p.status === 'completed' || p.status === 'paid').length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const q = search.trim().toLowerCase();
      const name = `${p.students?.first_name || ''} ${p.students?.last_name || ''}`.toLowerCase();
      const reverseName = `${p.students?.last_name || ''} ${p.students?.first_name || ''}`.toLowerCase();
      const receipt = `${p.or_number || ''} ${p.receipt_number || ''}`.toLowerCase();
      const lrn = (p.students?.lrn || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || reverseName.includes(q) || receipt.includes(q) || lrn.includes(q);
      const matchStatus = statusFilter === 'all' || getPaymentDisplayStatus(p) === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [payments, search, statusFilter]);

  const summaryFeeTypes = useMemo(() => {
    return feeTypes.filter(ft =>
      (ft.is_active !== false && (!ft.school_year_id || ft.school_year_id === selectedSY))
      || payments.some(p => p.fee_type_id === ft.id)
    );
  }, [feeTypes, payments, selectedSY]);

  const statusStyles = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    refunded: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const statusLabels = {
    completed: 'Completed',
    paid: 'Fully Paid',
    pending: 'Pending',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
  };

  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const handleYearChange = (schoolYearId) => {
    setSelectedSY(schoolYearId);
    setSelectedPayment(null);
    setStatusFilter('all');
  };

  const tabs = [
    { id: 'transactions', label: 'Transactions', icon: '💰' },
    { id: 'summary', label: 'Fee Summary', icon: '📊' },
  ];

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Records</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedYear?.year_name || 'Selected school year'} transactions
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedSY}
            onChange={e => handleYearChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-sm font-medium text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>
                {sy.year_name}{sy.is_current || sy.status === 'active' ? ' (Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

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
              <option value="paid">Fully Paid</option>
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
                          <td className="px-4 py-3 text-sm text-gray-500">{getGradeSection(payment)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{payment.fee_type?.name || 'General Payment'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[getPaymentDisplayStatus(payment)] || ''}`}>
                              {statusLabels[getPaymentDisplayStatus(payment)] || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{getReceiptNumber(payment)}</td>
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
                {summaryFeeTypes.length === 0 ? (
                  <EmptyState title="No fee summary" description="No fee types or transactions found for this school year." />
                ) : summaryFeeTypes.map((ft, i) => {
                  const feePayments = payments.filter(p => p.fee_type_id === ft.id);
                  const collected = feePayments.filter(p => !p.is_refunded && (p.status === 'completed' || p.status === 'paid')).reduce((a, p) => a + parseFloat(p.amount || 0), 0);
                  const pending = feePayments.filter(p => !p.is_refunded && p.status === 'pending').reduce((a, p) => a + parseFloat(p.amount || 0), 0);
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
                <p className="text-sm text-gray-400 font-mono">{getReceiptNumber(selectedPayment)}</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Student', value: `${selectedPayment.students?.first_name} ${selectedPayment.students?.last_name}` },
                  { label: 'LRN', value: selectedPayment.students?.lrn },
                  { label: 'Grade/Section', value: getGradeSection(selectedPayment) },
                  { label: 'School Year', value: selectedPayment.student_fees?.school_years?.year_name || selectedYear?.year_name },
                  { label: 'Fee Type', value: selectedPayment.fee_type?.name || 'General Payment' },
                  { label: 'Amount', value: formatCurrency(selectedPayment.amount) },
                  { label: 'Status', value: statusLabels[getPaymentDisplayStatus(selectedPayment)] },
                  { label: 'Date', value: selectedPayment.payment_date ? new Date(selectedPayment.payment_date).toLocaleDateString() : '—' },
                  { label: 'Method', value: formatPaymentMethod(selectedPayment.payment_method) },
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
