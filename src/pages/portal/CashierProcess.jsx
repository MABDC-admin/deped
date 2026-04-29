import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, DollarSign, Search, Users, TrendingUp, CheckCircle2, Clock, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Printer, Eye, X, FileText, PiggyBank, AlertCircle, ChevronRight, Plus, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import GlassCard from '../../components/ui/GlassCard';
import AnimatedCounter from '../../components/ui/AnimatedCounter';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import toast from 'react-hot-toast';

export default function CashierProcess() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [outstandingStudents, setOutstandingStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', remarks: '', fee_type_id: '' });
  const [feeTypes, setFeeTypes] = useState([]);
  const [selectedStudentFees, setSelectedStudentFees] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [receiptModal, setReceiptModal] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [payments, fees, students, feeTypesRes, studentFees] = await Promise.all([
        supabase.from('payments').select('*, students(first_name, last_name, lrn)').order('created_at', { ascending: false }).limit(20),
        supabase.from('student_fees').select('balance, student_id'),
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('fee_types').select('*').eq('is_active', true).order('name'),
        supabase.from('student_fees').select('*, students(first_name, last_name, lrn, enrollments(grade_levels(name), sections(name)))').gt('balance', 0).order('balance', { ascending: false }).limit(10),
      ]);

      const paymentData = payments.data || [];
      const today = new Date().toDateString();
      const todayPayments = paymentData.filter(p => new Date(p.created_at).toDateString() === today);
      const todayTotal = todayPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const totalCollected = paymentData.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const totalBalance = (fees.data || []).reduce((sum, f) => sum + (parseFloat(f.balance) || 0), 0);

      setStats({
        todayTotal,
        todayCount: todayPayments.length,
        totalCollected,
        totalBalance,
        totalStudents: students.count || 0,
        studentsWithBalance: (fees.data || []).filter(f => parseFloat(f.balance) > 0).length,
      });
      setRecentPayments(paymentData.slice(0, 10));
      setFeeTypes(feeTypesRes.data || []);
      setOutstandingStudents(studentFees.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Search students
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from('students')
        .select('id, first_name, last_name, lrn, enrollments(grade_levels(name), sections(name))')
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,lrn.ilike.%${searchQuery}%`)
        .limit(8);
      setSearchResults(data || []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openPaymentModal = async (student) => {
    setSelectedStudent(student);
    // Fetch this student's current fees (current school year)
    const { data: sf } = await supabase.from('student_fees')
      .select('id, total_fees, total_discount, total_paid, balance, school_years(year_name)')
      .eq('student_id', student.id)
      .gt('balance', 0)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSelectedStudentFees(sf || null);
    setPaymentForm({ amount: '', payment_method: 'cash', remarks: '', fee_type_id: feeTypes[0]?.id || '' });
    setShowPaymentModal(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const processPayment = async () => {
    if (!selectedStudent || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const amount = parseFloat(paymentForm.amount);

    // Validate: don't allow overpayment
    if (selectedStudentFees && amount > parseFloat(selectedStudentFees.balance || 0)) {
      toast.error(`Amount exceeds outstanding balance of ₱${parseFloat(selectedStudentFees.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
      return;
    }

    setProcessing(true);
    try {
      const orNumber = `OR-${Date.now().toString(36).toUpperCase()}`;
      const paymentData = {
        student_id: selectedStudent.id,
        student_fee_id: selectedStudentFees?.id || null,
        amount: amount,
        payment_method: paymentForm.payment_method,
        payment_date: new Date().toISOString().split('T')[0],
        remarks: paymentForm.remarks || null,
        or_number: orNumber,
        fee_type_id: paymentForm.fee_type_id || null,
        received_by: user?.id,
        status: 'completed',
        receipt_number: orNumber,
        processed_by: user?.id,
      };
      const { data: payment, error } = await supabase.from('payments').insert(paymentData).select().single();
      if (error) throw error;

      // Create receipt
      await supabase.from('receipts').insert({
        or_number: orNumber,
        payment_id: payment.id,
        student_id: selectedStudent.id,
        amount: amount,
        payment_method: paymentForm.payment_method,
        payment_date: new Date().toISOString().split('T')[0],
        cashier_id: user?.id,
        cashier_name: user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}` : user?.email,
        remarks: paymentForm.remarks || null,
      });

      // Update student_fees — only total_paid & status (balance is auto-generated)
      if (selectedStudentFees) {
        const newPaid = (parseFloat(selectedStudentFees.total_paid) || 0) + amount;
        const projectedBalance = parseFloat(selectedStudentFees.total_fees) - parseFloat(selectedStudentFees.total_discount || 0) - newPaid;
        await supabase.from('student_fees').update({
          total_paid: newPaid,
          status: projectedBalance <= 0 ? 'paid' : 'partial',
        }).eq('id', selectedStudentFees.id);
      }

      toast.success(`Payment of ₱${amount.toLocaleString()} processed!`);
      setReceiptModal({
        orNumber,
        student: selectedStudent,
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.payment_method,
        date: new Date(),
        feeType: feeTypes.find(f => f.id === paymentForm.fee_type_id)?.name || 'General',
      });
      setShowPaymentModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (n) => `₱${parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  if (loading) return <SkeletonDashboard />;

  const kpis = [
    { label: "Today's Collection", value: formatCurrency(stats.todayTotal), sub: `${stats.todayCount} transactions today`, icon: Banknote, color: 'from-green-500 to-emerald-500', up: true },
    { label: 'Total Collected', value: formatCurrency(stats.totalCollected), sub: 'This school year', icon: TrendingUp, color: 'from-blue-500 to-cyan-500', up: true },
    { label: 'Outstanding Balance', value: formatCurrency(stats.totalBalance), sub: `${stats.studentsWithBalance} students with balance`, icon: AlertCircle, color: 'from-amber-500 to-orange-500', up: false },
    { label: 'Enrolled Students', value: stats.totalStudents, sub: 'Active enrollees', icon: Users, color: 'from-violet-500 to-purple-500', up: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-7 h-7 text-green-500" /> Cashier Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { setSelectedStudent(null); setShowPaymentModal(true); }}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> New Payment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{kpi.value}</p>
                  <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${kpi.up ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {kpi.sub}
                  </div>
                </div>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shadow-lg`}>
                  <kpi.icon className="w-7 h-7 text-white" />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Quick Search */}
      <GlassCard className="p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-green-500" /> Quick Student Search
        </h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student name or LRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
          />
          {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>}
        </div>
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 space-y-2">
              {searchResults.map((student) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-green-50/50 dark:hover:bg-green-900/10 border border-gray-100 dark:border-gray-700 cursor-pointer transition-all"
                  onClick={() => openPaymentModal(student)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                      {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{student.last_name}, {student.first_name}</p>
                      <p className="text-xs text-gray-400">LRN: {student.lrn} • {student.enrollments?.[0]?.grade_levels?.name || ''} - {student.enrollments?.[0]?.sections?.name || ''}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-medium hover:shadow-md transition-all flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Pay
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" /> Recent Payments
            </h2>
            <span className="text-xs text-gray-400">{recentPayments.length} records</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {recentPayments.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No payment records yet</p>
            ) : (
              recentPayments.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {p.students ? `${p.students.last_name}, ${p.students.first_name}` : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} • {p.payment_method || 'cash'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(p.amount)}</span>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Outstanding Balances */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Outstanding Balances
            </h2>
            <span className="text-xs text-gray-400">Top {outstandingStudents.length}</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {outstandingStudents.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No outstanding balances</p>
            ) : (
              outstandingStudents.map((sf, i) => (
                <motion.div
                  key={sf.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => openPaymentModal(sf.students)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {sf.students?.last_name}, {sf.students?.first_name}
                      </p>
                      <p className="text-xs text-gray-400">LRN: {sf.students?.lrn}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(sf.balance)}</span>
                    <p className="text-xs text-gray-400">balance</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Quick Actions */}
      <GlassCard className="p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-green-500" /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Payment', icon: CreditCard, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', action: () => setShowPaymentModal(true) },
            { label: 'Fee Summary', icon: PiggyBank, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', action: () => window.location.href = '/fees' },
            { label: 'All Payments', icon: FileText, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', action: () => window.location.href = '/payments' },
            { label: 'Students', icon: Users, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', action: () => window.location.href = '/students' },
          ].map((action) => (
            <button key={action.label} onClick={action.action} className={`p-4 rounded-xl ${action.color} flex flex-col items-center gap-2 hover:scale-105 transition-transform`}>
              <action.icon className="w-6 h-6" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-green-500" /> Process Payment
                </h3>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
              </div>

              {!selectedStudent ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Student</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Name or LRN..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      autoFocus
                    />
                  </div>
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map(s => (
                      <div key={s.id} onClick={() => setSelectedStudent(s)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/10 cursor-pointer border border-gray-100 dark:border-gray-800 transition-colors">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs">
                          {s.first_name?.charAt(0)}{s.last_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{s.last_name}, {s.first_name}</p>
                          <p className="text-xs text-gray-400">LRN: {s.lrn}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                      {selectedStudent.first_name?.charAt(0)}{selectedStudent.last_name?.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedStudent.last_name}, {selectedStudent.first_name}</p>
                      <p className="text-xs text-gray-500">LRN: {selectedStudent.lrn}</p>
                    </div>
                    <button onClick={() => setSelectedStudent(null)} className="text-xs text-green-600 hover:underline">Change</button>
                  </div>

                  {/* Student Balance Info */}
                  {selectedStudentFees ? (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-amber-700 dark:text-amber-300">Outstanding Balance</span>
                        <span className="text-lg font-bold text-amber-800 dark:text-amber-200">{formatCurrency(selectedStudentFees.balance)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 mt-1">
                        <span>Total: {formatCurrency(selectedStudentFees.total_fees)}</span>
                        <span>Paid: {formatCurrency(selectedStudentFees.total_paid)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <span className="text-sm text-green-700 dark:text-green-300">✅ No outstanding balance</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fee Type</label>
                    <select value={paymentForm.fee_type_id} onChange={e => setPaymentForm(p => ({...p, fee_type_id: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500">
                      <option value="">General Payment</option>
                      {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₱)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm(p => ({...p, amount: e.target.value}))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'cash', label: 'Cash', icon: '💵' },
                        { id: 'bank_transfer', label: 'Bank', icon: '🏦' },
                        { id: 'gcash', label: 'GCash', icon: '📱' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentForm(p => ({...p, payment_method: m.id}))}
                          className={`p-3 rounded-xl border-2 text-center transition-all ${paymentForm.payment_method === m.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-green-300'}`}
                        >
                          <span className="text-xl">{m.icon}</span>
                          <p className="text-xs font-medium mt-1 text-gray-700 dark:text-gray-300">{m.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks (optional)</label>
                    <textarea
                      value={paymentForm.remarks}
                      onChange={e => setPaymentForm(p => ({...p, remarks: e.target.value}))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>

                  <button
                    onClick={processPayment}
                    disabled={processing || !paymentForm.amount}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Process Payment {paymentForm.amount ? `— ${formatCurrency(paymentForm.amount)}` : ''}
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {receiptModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setReceiptModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Successful!</h3>
                <p className="text-sm text-gray-400 font-mono mt-1">{receiptModal.orNumber}</p>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { label: 'Student', value: `${receiptModal.student?.last_name}, ${receiptModal.student?.first_name}` },
                  { label: 'Fee Type', value: receiptModal.feeType },
                  { label: 'Amount', value: formatCurrency(receiptModal.amount) },
                  { label: 'Method', value: receiptModal.method?.replace('_', ' ') },
                  { label: 'Date', value: receiptModal.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) },
                  { label: 'OR Number', value: receiptModal.orNumber },
                ].map(f => (
                  <div key={f.label} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-500">{f.label}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.print()} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setReceiptModal(null)} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:shadow-lg transition-all">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
