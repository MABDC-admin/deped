import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Plus, Pencil, Trash2, Search, ChevronDown, CheckCircle2, X, Layers, Tag, Users, GraduationCap, Percent, Gift } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import AnimatedTabs from '../../components/ui/AnimatedTabs';
import EmptyState from '../../components/ui/EmptyState';
import { SkeletonDashboard, SkeletonTable } from '../../components/ui/SkeletonLoader';
import toast from 'react-hot-toast';

export default function FeeList() {
  const [activeTab, setActiveTab] = useState('types');
  const [loading, setLoading] = useState(true);
  const [feeTypes, setFeeTypes] = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [schoolYear, setSchoolYear] = useState(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('type');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fee Type form
  const [typeForm, setTypeForm] = useState({ name: '', description: '', is_active: true });
  // Fee Structure form
  const [structForm, setStructForm] = useState({ fee_type_id: '', grade_level_id: '', amount: '', due_date: '', is_installment_allowed: false, installment_count: 1 });
  // Discount form
  const [discountForm, setDiscountForm] = useState({ name: '', description: '', type: 'fixed', value: '', category: 'scholarship', is_active: true });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sy, ft, fs, gl, disc] = await Promise.all([
        supabase.from('school_years').select('*').eq('is_current', true).single(),
        supabase.from('fee_types').select('*').order('name'),
        supabase.from('fee_structures').select('*, fee_types(name), grade_levels(name, level_order)').order('created_at', { ascending: false }),
        supabase.from('grade_levels').select('*').order('level_order'),
        supabase.from('discount_types').select('*').order('name'),
      ]);
      setSchoolYear(sy.data);
      setFeeTypes(ft.data || []);
      setFeeStructures(fs.data || []);
      setGradeLevels(gl.data || []);
      setDiscounts(disc.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Stats
  const stats = useMemo(() => {
    const activeFees = feeTypes.filter(f => f.is_active).length;
    const totalStructures = feeStructures.length;
    const totalAmountPerStudent = gradeLevels.length > 0 ? feeStructures.reduce((sum, fs) => sum + (parseFloat(fs.amount) || 0), 0) / gradeLevels.length : 0;
    const activeDiscounts = discounts.filter(d => d.is_active).length;
    return { activeFees, totalStructures, totalAmountPerStudent, activeDiscounts };
  }, [feeTypes, feeStructures, gradeLevels, discounts]);

  const formatCurrency = (n) => `₱${parseFloat(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  // Filtered data
  const filteredTypes = feeTypes.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredStructures = feeStructures.filter(f =>
    f.fee_types?.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.grade_levels?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDiscounts = discounts.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));

  // Fee structure matrix
  const feeMatrix = useMemo(() => {
    const matrix = {};
    gradeLevels.forEach(gl => {
      matrix[gl.id] = { gradeLevel: gl, fees: {} };
      feeTypes.forEach(ft => { matrix[gl.id].fees[ft.id] = null; });
    });
    feeStructures.forEach(fs => {
      if (matrix[fs.grade_level_id]) {
        matrix[fs.grade_level_id].fees[fs.fee_type_id] = fs;
      }
    });
    return Object.values(matrix);
  }, [gradeLevels, feeTypes, feeStructures]);

  // CRUD handlers
  const openAddType = () => { setModalType('type'); setEditing(null); setTypeForm({ name: '', description: '', is_active: true }); setModalOpen(true); };
  const openEditType = (t) => { setModalType('type'); setEditing(t); setTypeForm({ name: t.name, description: t.description || '', is_active: t.is_active }); setModalOpen(true); };
  const openAddStructure = () => { setModalType('structure'); setEditing(null); setStructForm({ fee_type_id: feeTypes[0]?.id || '', grade_level_id: gradeLevels[0]?.id || '', amount: '', due_date: '', is_installment_allowed: false, installment_count: 1 }); setModalOpen(true); };
  const openEditStructure = (s) => { setModalType('structure'); setEditing(s); setStructForm({ fee_type_id: s.fee_type_id, grade_level_id: s.grade_level_id, amount: s.amount || '', due_date: s.due_date || '', is_installment_allowed: s.is_installment_allowed || false, installment_count: s.installment_count || 1 }); setModalOpen(true); };
  const openAddDiscount = () => { setModalType('discount'); setEditing(null); setDiscountForm({ name: '', description: '', type: 'fixed', value: '', category: 'scholarship', is_active: true }); setModalOpen(true); };
  const openEditDiscount = (d) => { setModalType('discount'); setEditing(d); setDiscountForm({ name: d.name, description: d.description || '', type: d.type, value: d.value || '', category: d.category, is_active: d.is_active }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modalType === 'type') {
        const data = { ...typeForm, school_year_id: schoolYear?.id };
        if (editing) {
          const { error } = await supabase.from('fee_types').update(data).eq('id', editing.id);
          if (error) throw error;
          toast.success('Fee type updated');
        } else {
          const { error } = await supabase.from('fee_types').insert(data);
          if (error) throw error;
          toast.success('Fee type created');
        }
      } else if (modalType === 'structure') {
        const data = { ...structForm, school_year_id: schoolYear?.id, amount: parseFloat(structForm.amount) || 0 };
        if (editing) {
          const { error } = await supabase.from('fee_structures').update(data).eq('id', editing.id);
          if (error) throw error;
          toast.success('Fee structure updated');
        } else {
          const { error } = await supabase.from('fee_structures').insert(data);
          if (error) throw error;
          toast.success('Fee structure created');
        }
      } else if (modalType === 'discount') {
        const data = { ...discountForm, school_year_id: schoolYear?.id, value: parseFloat(discountForm.value) || 0 };
        if (editing) {
          const { error } = await supabase.from('discount_types').update(data).eq('id', editing.id);
          if (error) throw error;
          toast.success('Discount updated');
        } else {
          const { error } = await supabase.from('discount_types').insert(data);
          if (error) throw error;
          toast.success('Discount created');
        }
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      const table = deleteConfirm.table;
      const { error } = await supabase.from(table).delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast.success('Deleted successfully');
      setDeleteConfirm(null);
      fetchAll();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'types', label: 'Fee Types', icon: '🏷️' },
    { id: 'structure', label: 'Fee Structure', icon: '📊' },
    { id: 'discounts', label: 'Discounts', icon: '🎁' },
    { id: 'matrix', label: 'Fee Matrix', icon: '📋' },
  ];

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-green-500" /> Fee Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">SY {schoolYear?.year_name || ''} — Manage fee types, structures, and discounts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Fee Types', value: stats.activeFees, icon: '🏷️', color: 'from-blue-500 to-cyan-400' },
          { label: 'Fee Structures', value: stats.totalStructures, icon: '📊', color: 'from-green-500 to-emerald-400' },
          { label: 'Avg. Fees/Grade', value: formatCurrency(stats.totalAmountPerStudent), icon: '💰', color: 'from-amber-500 to-orange-400' },
          { label: 'Active Discounts', value: stats.activeDiscounts, icon: '🎁', color: 'from-purple-500 to-pink-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className={`text-xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
                </div>
                <span className="text-2xl">{s.icon}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <AnimatedTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button onClick={activeTab === 'types' ? openAddType : activeTab === 'structure' ? openAddStructure : activeTab === 'discounts' ? openAddDiscount : null}
              className={`px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'matrix' ? 'opacity-50 pointer-events-none' : ''}`}>
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'types' && (
          <motion.div key="types" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {filteredTypes.length === 0 ? <EmptyState title="No fee types" description="Create your first fee type" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTypes.map((ft, i) => (
                  <motion.div key={ft.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <GlassCard className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                            <Tag className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{ft.name}</h3>
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ft.description || 'No description'}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ft.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                          {ft.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-4 flex items-center gap-2 justify-end">
                        <button onClick={() => openEditType(ft)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm({ id: ft.id, table: 'fee_types', name: ft.name })} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'structure' && (
          <motion.div key="structure" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {filteredStructures.length === 0 ? <EmptyState title="No fee structures" description="Define fee amounts per grade level" /> : (
              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                      <tr>
                        {['Fee Type', 'Grade Level', 'Amount', 'Due Date', 'Installments', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredStructures.map((fs, i) => (
                        <motion.tr key={fs.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                          className="hover:bg-green-50/30 dark:hover:bg-green-900/10 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{fs.fee_types?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{fs.grade_levels?.name || '—'}</td>
                          <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(fs.amount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{fs.due_date ? new Date(fs.due_date).toLocaleDateString() : '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{fs.is_installment_allowed ? `${fs.installment_count} payments` : 'No'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => openEditStructure(fs)} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteConfirm({ id: fs.id, table: 'fee_structures', name: `${fs.fee_types?.name} - ${fs.grade_levels?.name}` })} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {activeTab === 'discounts' && (
          <motion.div key="discounts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {filteredDiscounts.length === 0 ? <EmptyState title="No discounts" description="Create scholarships and discounts" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDiscounts.map((d, i) => (
                  <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <GlassCard className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.category === 'scholarship' ? 'bg-gradient-to-br from-purple-400 to-pink-500' : d.category === 'sibling' ? 'bg-gradient-to-br from-blue-400 to-cyan-500' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                            <Gift className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{d.name}</h3>
                            <p className="text-xs text-gray-400 capitalize">{d.category?.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {d.type === 'percentage' ? `${d.value}%` : formatCurrency(d.value)}
                        </span>
                        <span className="text-xs text-gray-400">{d.type === 'percentage' ? 'off total fees' : 'fixed discount'}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{d.description || 'No description'}</p>
                      <div className="mt-4 flex items-center gap-2 justify-end">
                        <button onClick={() => openEditDiscount(d)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteConfirm({ id: d.id, table: 'discount_types', name: d.name })} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'matrix' && (
          <motion.div key="matrix" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard className="overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">📋 Fee Matrix — {schoolYear?.year_name}</h3>
                <p className="text-xs text-gray-400 mt-1">Fee amounts by grade level and fee type</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50/80 dark:bg-gray-800/80 z-10">Grade Level</th>
                      {feeTypes.filter(f => f.is_active).map(ft => (
                        <th key={ft.id} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{ft.name}</th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-600 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {feeMatrix.map((row) => {
                      const rowTotal = feeTypes.filter(f => f.is_active).reduce((sum, ft) => sum + (parseFloat(row.fees[ft.id]?.amount) || 0), 0);
                      return (
                        <tr key={row.gradeLevel.id} className="hover:bg-green-50/30 dark:hover:bg-green-900/10">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-900 z-10">{row.gradeLevel.name}</td>
                          {feeTypes.filter(f => f.is_active).map(ft => (
                            <td key={ft.id} className="px-4 py-3 text-sm text-center">
                              {row.fees[ft.id] ? (
                                <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(row.fees[ft.id].amount)}</span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-sm text-center font-bold text-green-600 dark:text-green-400">{formatCurrency(rowTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editing ? 'Edit' : 'Add'} {modalType === 'type' ? 'Fee Type' : modalType === 'structure' ? 'Fee Structure' : 'Discount'}
                </h3>
                <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                {modalType === 'type' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fee Name *</label>
                      <input type="text" value={typeForm.name} onChange={e => setTypeForm(p => ({...p, name: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., Tuition Fee" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <textarea value={typeForm.description} onChange={e => setTypeForm(p => ({...p, description: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" rows={2} />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={typeForm.is_active} onChange={e => setTypeForm(p => ({...p, is_active: e.target.checked}))} className="rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                    </label>
                  </>
                )}

                {modalType === 'structure' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fee Type *</label>
                      <select value={structForm.fee_type_id} onChange={e => setStructForm(p => ({...p, fee_type_id: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500">
                        {feeTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grade Level *</label>
                      <select value={structForm.grade_level_id} onChange={e => setStructForm(p => ({...p, grade_level_id: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500">
                        {gradeLevels.map(gl => <option key={gl.id} value={gl.id}>{gl.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₱) *</label>
                      <input type="number" min="0" step="0.01" value={structForm.amount} onChange={e => setStructForm(p => ({...p, amount: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                      <input type="date" value={structForm.due_date} onChange={e => setStructForm(p => ({...p, due_date: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={structForm.is_installment_allowed} onChange={e => setStructForm(p => ({...p, is_installment_allowed: e.target.checked}))} className="rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Allow installments</span>
                    </label>
                    {structForm.is_installment_allowed && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of installments</label>
                        <input type="number" min="2" max="12" value={structForm.installment_count} onChange={e => setStructForm(p => ({...p, installment_count: parseInt(e.target.value) || 2}))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" />
                      </div>
                    )}
                  </>
                )}

                {modalType === 'discount' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                      <input type="text" value={discountForm.name} onChange={e => setDiscountForm(p => ({...p, name: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g., Academic Scholarship" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                      <select value={discountForm.category} onChange={e => setDiscountForm(p => ({...p, category: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500">
                        {['scholarship', 'sibling', 'employee', 'financial_aid', 'early_bird', 'other'].map(c => (
                          <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select value={discountForm.type} onChange={e => setDiscountForm(p => ({...p, type: e.target.value}))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500">
                          <option value="fixed">Fixed (₱)</option>
                          <option value="percentage">Percentage (%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value *</label>
                        <input type="number" min="0" step={discountForm.type === 'percentage' ? '1' : '0.01'} value={discountForm.value} onChange={e => setDiscountForm(p => ({...p, value: e.target.value}))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500"
                          placeholder={discountForm.type === 'percentage' ? '10' : '500.00'} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                      <textarea value={discountForm.description} onChange={e => setDiscountForm(p => ({...p, description: e.target.value}))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500" rows={2} />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={discountForm.is_active} onChange={e => setDiscountForm(p => ({...p, is_active: e.target.checked}))} className="rounded" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                    </label>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium hover:shadow-lg disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <Trash2 className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete {deleteConfirm.name}?</h3>
                <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50">Cancel</button>
                <button onClick={handleDelete} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50">
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
