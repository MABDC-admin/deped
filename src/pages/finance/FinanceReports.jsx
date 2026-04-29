import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

const numeric = (value) => parseFloat(value || 0) || 0;
const netAssessment = (fee) => Math.max(numeric(fee?.total_fees) - numeric(fee?.total_discount), 0);

const getEnrollment = (map, row) =>
  map[`${row?.student_id || ''}:${row?.school_year_id || ''}`] || map[row?.student_id] || null;

const getGradeName = (map, row) => getEnrollment(map, row)?.grade_levels?.name || 'Unassigned Grade';

const gradeSortValue = (name) => {
  const value = String(name || '').toLowerCase();
  if (value.includes('kindergarten') || value.includes('kinder')) return 0;
  const match = value.match(/grade\s*(\d+)/);
  if (match) return Number(match[1]);
  return 999;
};

const compareGradeNames = (a, b) => {
  const diff = gradeSortValue(a) - gradeSortValue(b);
  if (diff !== 0) return diff;
  return String(a || '').localeCompare(String(b || ''));
};

const paymentStatusLabel = (status) => status === 'paid' ? 'Fully Paid' : String(status || '—').replace(/\b\w/g, c => c.toUpperCase());

const FinanceReports = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('year');
  const [studentFees, setStudentFees] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [enrollmentMap, setEnrollmentMap] = useState({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feesRes, expensesRes, paymentsRes, enrollmentsRes, feeTypesRes] = await Promise.all([
        supabase
          .from('student_fees')
          .select('id, student_id, school_year_id, total_fees, total_discount, total_paid, balance, status, created_at, students(first_name, last_name, lrn), school_years(year_name)'),
        supabase.from('expenses').select('*').eq('status', 'approved'),
        supabase
          .from('payments')
          .select('id, student_id, student_fee_id, amount, payment_method, payment_date, created_at, status, is_refunded, fee_type_id, students(first_name, last_name, lrn), student_fees(school_year_id, status, balance)')
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select('student_id, school_year_id, status, grade_levels(id, name, level_order), sections(id, name)'),
        supabase
          .from('fee_types')
          .select('id, name'),
      ]);

      if (feesRes.error) throw feesRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;
      if (feeTypesRes.error) throw feeTypesRes.error;

      const enrollments = (enrollmentsRes.data || []).reduce((map, enrollment) => {
        map[`${enrollment.student_id}:${enrollment.school_year_id}`] = enrollment;
        if (!map[enrollment.student_id]) map[enrollment.student_id] = enrollment;
        return map;
      }, {});
      const feeTypeById = (feeTypesRes.data || []).reduce((map, feeType) => {
        map[feeType.id] = feeType;
        return map;
      }, {});

      setStudentFees(feesRes.data || []);
      setExpenses(expensesRes.data || []);
      setPayments((paymentsRes.data || []).map(payment => ({
        ...payment,
        fee_types: feeTypeById[payment.fee_type_id] || null,
      })));
      setEnrollmentMap(enrollments);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to load financial reports');
      setStudentFees([]);
      setExpenses([]);
      setPayments([]);
      setEnrollmentMap({});
    }
    finally { setLoading(false); }
  };

  const getDateFilter = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    switch (dateRange) {
      case 'month':
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      case 'quarter': {
        const currentQ = Math.floor(now.getMonth() / 3);
        const dateQ = Math.floor(d.getMonth() / 3);
        return dateQ === currentQ && d.getFullYear() === now.getFullYear();
      }
      case 'year':
        return d.getFullYear() === now.getFullYear();
      case 'all':
        return true;
      default:
        return true;
    }
  };

  const reportData = useMemo(() => {
    const filteredFees = studentFees.filter(f => getDateFilter(f.created_at));
    const filteredExpenses = expenses.filter(e => getDateFilter(e.expense_date));
    const filteredPayments = payments.filter(p => getDateFilter(p.payment_date || p.created_at));
    const validPayments = filteredPayments.filter(p => !p.is_refunded && ['completed', 'paid'].includes(p.status || 'completed'));

    const totalRevenue = validPayments.reduce((a, p) => a + numeric(p.amount), 0);
    const totalExpenses = filteredExpenses.reduce((a, e) => a + numeric(e.amount), 0);
    const netIncome = totalRevenue - totalExpenses;
    const totalBilled = filteredFees.reduce((a, f) => a + netAssessment(f), 0);
    const collectionRate = totalBilled > 0 ? ((totalRevenue / totalBilled) * 100) : 0;

    // Collection by grade level
    const gradeMap = {};
    filteredFees.forEach(f => {
      const gradeName = getGradeName(enrollmentMap, f);
      if (!gradeMap[gradeName]) gradeMap[gradeName] = { collected: 0, total: 0 };
      gradeMap[gradeName].collected += numeric(f.total_paid);
      gradeMap[gradeName].total += netAssessment(f);
    });
    const collectionByGrade = Object.entries(gradeMap).map(([name, data]) => ({
      name, collected: data.collected, total: data.total,
      pct: data.total > 0 ? (data.collected / data.total * 100) : 0,
    })).sort((a, b) => compareGradeNames(a.name, b.name));

    // Expense breakdown by category
    const categoryMap = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'other';
      categoryMap[cat] = (categoryMap[cat] || 0) + (parseFloat(e.amount) || 0);
    });
    const maxCatAmount = Math.max(...Object.values(categoryMap), 1);
    const expenseByCategory = Object.entries(categoryMap).map(([cat, amount]) => ({
      category: cat, amount, pct: (amount / maxCatAmount) * 100,
    })).sort((a, b) => b.amount - a.amount);

    // Recent payments
    const recentPayments = validPayments.slice(0, 10);

    // Outstanding by grade level
    const outstandingMap = {};
    filteredFees.forEach(f => {
      const gradeName = getGradeName(enrollmentMap, f);
      const balance = numeric(f.balance);
      if (!outstandingMap[gradeName]) outstandingMap[gradeName] = 0;
      outstandingMap[gradeName] += Math.max(0, balance);
    });
    const maxOutstanding = Math.max(...Object.values(outstandingMap), 1);
    const outstandingByGrade = Object.entries(outstandingMap).map(([name, amount]) => ({
      name, amount, pct: (amount / maxOutstanding) * 100,
    })).sort((a, b) => compareGradeNames(a.name, b.name));

    return { totalRevenue, totalExpenses, netIncome, collectionRate, collectionByGrade, expenseByCategory, recentPayments, outstandingByGrade };
  }, [studentFees, expenses, payments, enrollmentMap, dateRange]);

  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const categoryIcons = {
    supplies: '📦', utilities: '💡', maintenance: '🔧', salary: '💰',
    equipment: '🖥️', events: '🎉', transportation: '🚌', other: '📋',
  };

  const statusStyles = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📊</span> Finance Reports
          </h2>
          <div className="flex items-center gap-2">
            {[
              { id: 'month', label: 'This Month' },
              { id: 'quarter', label: 'This Quarter' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setDateRange(opt.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${dateRange === opt.id
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                  : 'bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(reportData.totalRevenue), icon: '💵', color: 'from-emerald-500 to-teal-400', sub: 'completed payments' },
          { label: 'Total Expenses', value: formatCurrency(reportData.totalExpenses), icon: '💸', color: 'from-red-500 to-rose-400', sub: 'approved expenses' },
          { label: 'Net Income', value: formatCurrency(reportData.netIncome), icon: '📈', color: reportData.netIncome >= 0 ? 'from-blue-500 to-cyan-400' : 'from-red-500 to-rose-400', sub: 'revenue - expenses' },
          { label: 'Collection Rate', value: `${reportData.collectionRate.toFixed(1)}%`, icon: '🎯', color: 'from-purple-500 to-violet-400', sub: 'of total billed' },
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection by Grade Level */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span>📚</span> Collection by Grade Level
            </h3>
            {reportData.collectionByGrade.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data available</p>
            ) : (
              <div className="space-y-4">
                {reportData.collectionByGrade.map((grade, i) => (
                  <motion.div key={grade.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{grade.name}</span>
                      <span className="text-sm text-gray-500">{formatCurrency(grade.collected)} / {formatCurrency(grade.total)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${grade.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{grade.pct.toFixed(0)}% collected</p>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Expense Breakdown by Category */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span>💸</span> Expense Breakdown
            </h3>
            {reportData.expenseByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No expenses recorded</p>
            ) : (
              <div className="space-y-4">
                {reportData.expenseByCategory.map((cat, i) => (
                  <motion.div key={cat.category} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <span>{categoryIcons[cat.category] || '📋'}</span>
                        <span className="capitalize">{cat.category}</span>
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(cat.amount)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>💰</span> Recent Payments
            </h3>
            {reportData.recentPayments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No recent payments</p>
            ) : (
              <div className="space-y-3">
                {reportData.recentPayments.map((payment, i) => (
                  <motion.div key={payment.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {payment.students?.first_name} {payment.students?.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {payment.fee_types?.name || 'General Payment'} • {payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[payment.status] || ''}`}>
                        {paymentStatusLabel(payment.status)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Outstanding by Grade Level */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <span>⚠️</span> Outstanding Balances by Grade
            </h3>
            {reportData.outstandingByGrade.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No outstanding balances</p>
            ) : (
              <div className="space-y-4">
                {reportData.outstandingByGrade.map((grade, i) => (
                  <motion.div key={grade.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{grade.name}</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(grade.amount)}</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${grade.pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default FinanceReports;
