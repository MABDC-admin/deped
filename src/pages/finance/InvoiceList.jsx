import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const InvoiceList = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [voidConfirm, setVoidConfirm] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    school_year_id: '',
    total_amount: '',
    discount_amount: '0',
    due_date: '',
    notes: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, studentsRes, yearsRes] = await Promise.all([
        supabase.from('invoices').select('*, students(first_name, last_name, lrn), school_years(year_name)').order('created_at', { ascending: false }),
        supabase.from('students').select('id, first_name, last_name, lrn').order('last_name'),
        supabase.from('school_years').select('*').order('year_name', { ascending: false }),
      ]);
      setInvoices(invoicesRes.data || []);
      setStudents(studentsRes.data || []);
      setSchoolYears(yearsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const totalInvoices = invoices.length;
    const unpaidAmount = invoices.filter(i => i.status === 'unpaid' || i.status === 'partial' || i.status === 'overdue').reduce((a, i) => a + (parseFloat(i.balance) || 0), 0);
    const paidAmount = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + (parseFloat(i.net_amount) || 0), 0);
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;
    return { totalInvoices, unpaidAmount, paidAmount, overdueCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      const name = `${inv.students?.first_name || ''} ${inv.students?.last_name || ''}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase()) || (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students.slice(0, 20);
    return students.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.lrn || '').includes(studentSearch)
    ).slice(0, 20);
  }, [students, studentSearch]);

  const statusStyles = {
    unpaid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    partial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    void: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };

  const formatCurrency = (amount) => `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const generateInvoiceNumber = () => {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `INV-${date}-${rand}`;
  };

  const openAddModal = () => {
    setEditingInvoice(null);
    setForm({ student_id: '', school_year_id: '', total_amount: '', discount_amount: '0', due_date: '', notes: '' });
    setStudentSearch('');
    setShowModal(true);
  };

  const openEditModal = (inv) => {
    setEditingInvoice(inv);
    setForm({
      student_id: inv.student_id || '',
      school_year_id: inv.school_year_id || '',
      total_amount: inv.total_amount || '',
      discount_amount: inv.discount_amount || '0',
      due_date: inv.due_date || '',
      notes: inv.notes || '',
    });
    setStudentSearch('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.student_id || !form.total_amount || !form.due_date) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      const totalAmount = parseFloat(form.total_amount) || 0;
      const discountAmount = parseFloat(form.discount_amount) || 0;
      const netAmount = totalAmount - discountAmount;

      if (editingInvoice) {
        const { error } = await supabase.from('invoices').update({
          student_id: form.student_id,
          school_year_id: form.school_year_id || null,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          net_amount: netAmount,
          balance: netAmount - (parseFloat(editingInvoice.amount_paid) || 0),
          due_date: form.due_date,
          notes: form.notes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', editingInvoice.id);
        if (error) throw error;
        toast.success('Invoice updated successfully');
      } else {
        const { error } = await supabase.from('invoices').insert({
          invoice_number: generateInvoiceNumber(),
          student_id: form.student_id,
          school_year_id: form.school_year_id || null,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          net_amount: netAmount,
          amount_paid: 0,
          balance: netAmount,
          due_date: form.due_date,
          status: 'unpaid',
          notes: form.notes || null,
          generated_by: user?.id || null,
        });
        if (error) throw error;
        toast.success('Invoice created successfully');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save invoice');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Invoice deleted');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete invoice');
    }
  };

  const handleVoid = async (inv) => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }
    try {
      const { error } = await supabase.from('invoices').update({
        status: 'void',
        notes: `${inv.notes ? inv.notes + ' | ' : ''}VOID: ${voidReason}`,
        updated_at: new Date().toISOString(),
      }).eq('id', inv.id);
      if (error) throw error;
      toast.success('Invoice voided');
      setVoidConfirm(null);
      setVoidReason('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to void invoice');
    }
  };

  const handlePrint = (inv) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Invoice ${inv.invoice_number}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} h1{color:#1a365d;}</style>
      </head><body>
      <h1>Invoice</h1>
      <p><strong>Invoice #:</strong> ${inv.invoice_number}</p>
      <p><strong>Student:</strong> ${inv.students?.first_name || ''} ${inv.students?.last_name || ''}</p>
      <p><strong>LRN:</strong> ${inv.students?.lrn || '—'}</p>
      <p><strong>School Year:</strong> ${inv.school_years?.year_name || '—'}</p>
      <p><strong>Due Date:</strong> ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</p>
      <table>
        <tr><th>Total Amount</th><td>${formatCurrency(inv.total_amount)}</td></tr>
        <tr><th>Discount</th><td>${formatCurrency(inv.discount_amount)}</td></tr>
        <tr><th>Net Amount</th><td>${formatCurrency(inv.net_amount)}</td></tr>
        <tr><th>Amount Paid</th><td>${formatCurrency(inv.amount_paid)}</td></tr>
        <tr><th>Balance</th><td>${formatCurrency(inv.balance)}</td></tr>
      </table>
      <p><strong>Status:</strong> ${inv.status}</p>
      ${inv.notes ? `<p><strong>Notes:</strong> ${inv.notes}</p>` : ''}
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
          { label: 'Total Invoices', value: stats.totalInvoices, icon: '🧾', color: 'from-blue-500 to-cyan-400', sub: 'all records' },
          { label: 'Unpaid Amount', value: formatCurrency(stats.unpaidAmount), icon: '⏳', color: 'from-amber-500 to-orange-400', sub: 'outstanding balance' },
          { label: 'Paid Amount', value: formatCurrency(stats.paidAmount), icon: '💵', color: 'from-emerald-500 to-teal-400', sub: 'fully settled' },
          { label: 'Overdue', value: stats.overdueCount, icon: '🚨', color: 'from-red-500 to-rose-400', sub: 'needs follow-up' },
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
            <input type="text" placeholder="Search by name or invoice number..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="void">Void</option>
            </select>
            <button onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all text-sm flex items-center gap-2">
              <span>+</span> New Invoice
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No invoices found" description="No invoice records match your search" />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                <tr>
                  {['Invoice #', 'Student', 'School Year', 'Net Amount', 'Paid', 'Balance', 'Due Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, 100).map((inv, i) => (
                  <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{inv.students?.first_name} {inv.students?.last_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{inv.students?.lrn || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{inv.school_years?.year_name || '—'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(inv.net_amount)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(inv.amount_paid)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(inv.balance)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[inv.status] || ''}`}>
                        {inv.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(inv)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handlePrint(inv)} className="p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="Print">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                        {inv.status !== 'void' && (
                          <button onClick={() => { setVoidConfirm(inv); setVoidReason(''); }} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 transition-colors" title="Void">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          </button>
                        )}
                        <button onClick={() => setDeleteConfirm(inv)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Delete">
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
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-3xl text-white mb-3">🧾</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Student *</label>
                  <input type="text" placeholder="Search student by name or LRN..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm mb-2" />
                  <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
                    <option value="">Select student...</option>
                    {filteredStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.last_name}, {s.first_name} ({s.lrn || 'No LRN'})</option>
                    ))}
                  </select>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Amount *</label>
                    <input type="number" step="0.01" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount</label>
                    <input type="number" step="0.01" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="0.00" />
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                  Net Amount: <span className="font-bold text-gray-900 dark:text-white">{formatCurrency((parseFloat(form.total_amount) || 0) - (parseFloat(form.discount_amount) || 0))}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date *</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm resize-none" placeholder="Optional notes..." />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50">
                  {saving ? 'Saving...' : editingInvoice ? 'Update' : 'Create Invoice'}
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Invoice</h3>
                <p className="text-sm text-gray-500 mt-2">Are you sure you want to delete invoice <strong>{deleteConfirm.invoice_number}</strong>? This action cannot be undone.</p>
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

      {/* Void Confirmation Modal */}
      <AnimatePresence>
        {voidConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setVoidConfirm(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl text-white mb-3">🚫</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Void Invoice</h3>
                <p className="text-sm text-gray-500 mt-2">Please provide a reason for voiding invoice <strong>{voidConfirm.invoice_number}</strong>.</p>
              </div>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm resize-none mt-2" placeholder="Reason for voiding..." />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setVoidConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                  Cancel
                </button>
                <button onClick={() => handleVoid(voidConfirm)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:shadow-lg transition-all">
                  Void Invoice
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceList;
