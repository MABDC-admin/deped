import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const CATEGORIES = [
  { value: 'supplies', label: 'Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'salary', label: 'Salary' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'events', label: 'Events' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'other', label: 'Other' },
];

const ExpenseList = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_year_id: '',
    category: '',
    description: '',
    amount: '',
    expense_date: '',
    vendor: '',
    reference_number: '',
    status: 'pending',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [expensesRes, yearsRes] = await Promise.all([
        supabase.from('expenses').select('*, school_years(year_name)').order('expense_date', { ascending: false }),
        supabase.from('school_years').select('*').order('year_name', { ascending: false }),
      ]);
      setExpenses(expensesRes.data || []);
      setSchoolYears(yearsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const totalExpenses = expenses.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
    const pendingApproval = expenses.filter(e => e.status === 'pending').length;
    const approvedTotal = expenses.filter(e => e.status === 'approved').reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
    const now = new Date();
    const thisMonth = expenses.filter(e => {
      if (!e.expense_date) return false;
      const d = new Date(e.expense_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
    return { totalExpenses, pendingApproval, approvedTotal, thisMonth };
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.vendor || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.reference_number || '').toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchDateFrom = !dateFrom || (e.expense_date && e.expense_date >= dateFrom);
      const matchDateTo = !dateTo || (e.expense_date && e.expense_date <= dateTo);
      return matchSearch && matchCategory && matchStatus && matchDateFrom && matchDateTo;
    });
  }, [expenses, search, categoryFilter, statusFilter, dateFrom, dateTo]);

  const statusStyles = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  const categoryIcons = {
    supplies: '📦', utilities: '💡', maintenance: '🔧', salary: '💰',
    equipment: '🖥️', events: '🎉', transportation: '🚌', other: '📋',
  };

  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const openAddModal = () => {
    setEditingExpense(null);
    setForm({ school_year_id: '', category: '', description: '', amount: '', expense_date: '', vendor: '', reference_number: '', status: 'pending' });
    setShowModal(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setForm({
      school_year_id: exp.school_year_id || '',
      category: exp.category || '',
      description: exp.description || '',
      amount: exp.amount || '',
      expense_date: exp.expense_date || '',
      vendor: exp.vendor || '',
      reference_number: exp.reference_number || '',
      status: exp.status || 'pending',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.category || !form.description || !form.amount || !form.expense_date) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingExpense) {
        const { error } = await supabase.from('expenses').update({
          school_year_id: form.school_year_id || null,
          category: form.category,
          description: form.description,
          amount: parseFloat(form.amount),
          expense_date: form.expense_date,
          vendor: form.vendor || null,
          reference_number: form.reference_number || null,
          status: form.status,
          updated_at: new Date().toISOString(),
        }).eq('id', editingExpense.id);
        if (error) throw error;
        toast.success('Expense updated successfully');
      } else {
        const { error } = await supabase.from('expenses').insert({
          school_year_id: form.school_year_id || null,
          category: form.category,
          description: form.description,
          amount: parseFloat(form.amount),
          expense_date: form.expense_date,
          vendor: form.vendor || null,
          reference_number: form.reference_number || null,
          status: form.status,
          recorded_by: user?.id || null,
        });
        if (error) throw error;
        toast.success('Expense added successfully');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save expense');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Expense deleted');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete expense');
    }
  };

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Expenses', value: formatCurrency(stats.totalExpenses), icon: '💸', color: 'from-blue-500 to-cyan-400', sub: 'all records' },
          { label: 'Pending Approval', value: stats.pendingApproval, icon: '⏳', color: 'from-amber-500 to-orange-400', sub: 'awaiting review' },
          { label: 'Approved Total', value: formatCurrency(stats.approvedTotal), icon: '✅', color: 'from-emerald-500 to-teal-400', sub: 'approved expenses' },
          { label: 'This Month', value: formatCurrency(stats.thisMonth), icon: '📅', color: 'from-purple-500 to-violet-400', sub: 'current month' },
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
              <input type="text" placeholder="Search by description, vendor, or reference..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <button onClick={openAddModal}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all text-sm flex items-center gap-2">
                <span>+</span> Add Expense
              </button>
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
        <EmptyState title="No expenses found" description="No expense records match your search criteria" />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                <tr>
                  {['Date', 'Category', 'Description', 'Vendor', 'Amount', 'School Year', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, 100).map((exp, i) => (
                  <motion.tr key={exp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                        <span>{categoryIcons[exp.category] || '📋'}</span>
                        <span className="capitalize">{exp.category || '—'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{exp.description}</p>
                      {exp.reference_number && <p className="text-xs text-gray-400 font-mono">{exp.reference_number}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{exp.vendor || '—'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(exp.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{exp.school_years?.year_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[exp.status] || ''}`}>
                        {exp.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(exp)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDeleteConfirm(exp)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-3xl text-white mb-3">💸</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                      <option value="">Select category...</option>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm resize-none" placeholder="Expense description..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount *</label>
                    <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                    <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vendor</label>
                    <input type="text" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="Vendor name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference #</label>
                    <input type="text" value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="Reference number" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Year</label>
                  <select value={form.school_year_id} onChange={e => setForm({ ...form, school_year_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                    <option value="">Select school year...</option>
                    {schoolYears.map(sy => (
                      <option key={sy.id} value={sy.id}>{sy.year_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : editingExpense ? 'Update' : 'Add Expense'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center text-3xl text-white mb-3">🗑️</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Expense</h3>
                <p className="text-sm text-gray-500 mt-2">Are you sure you want to delete this expense record for <strong>{formatCurrency(deleteConfirm.amount)}</strong>? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirm.id)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium hover:shadow-lg transition-all">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpenseList;
