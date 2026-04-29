import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = {
  user_id: '',
  specialization: '',
  license_number: '',
  license_expiry: '',
  position: '',
  employment_status: 'active',
  date_hired: '',
};

const TeacherList = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [userOptions, setUserOptions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchTeachers(); }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const [{ data, error }, usersRes, sectionsRes] = await Promise.all([
        supabase
        .from('teacher_profiles')
        .select(`
          *,
          user_profiles!teacher_profiles_user_id_fkey(first_name, last_name, email, avatar_url, employee_id, role)
        `),
        supabase
          .from('user_profiles')
          .select('id, first_name, last_name, email, employee_id, role')
          .eq('role', 'teacher')
          .order('last_name'),
        supabase
          .from('sections')
          .select('id, name, adviser_id, grade_levels(name)')
          .order('name'),
      ]);
      if (error) throw error;
      const sections = sectionsRes.data || [];
      setTeachers((data || []).map(teacher => ({
        ...teacher,
        sections: sections.filter(section => section.adviser_id === teacher.user_id),
      })));
      setUserOptions(usersRes.data || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setFormOpen(true);
  };

  const openEdit = (teacher) => {
    setForm({
      user_id: teacher.user_id || '',
      specialization: teacher.specialization || '',
      license_number: teacher.license_number || '',
      license_expiry: teacher.license_expiry || '',
      position: teacher.position || '',
      employment_status: teacher.employment_status || 'active',
      date_hired: teacher.date_hired || '',
    });
    setEditId(teacher.id);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.user_id) { toast.error('Select a teacher user'); return; }
    setSaving(true);
    const payload = {
      user_id: form.user_id,
      specialization: form.specialization || null,
      license_number: form.license_number || null,
      license_expiry: form.license_expiry || null,
      position: form.position || null,
      employment_status: form.employment_status || null,
      date_hired: form.date_hired || null,
    };
    const { error } = editId
      ? await supabase.from('teacher_profiles').update(payload).eq('id', editId)
      : await supabase.from('teacher_profiles').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Teacher profile updated' : 'Teacher profile created');
    setFormOpen(false);
    fetchTeachers();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('teacher_profiles').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Teacher profile deleted');
    setDeleteId(null);
    fetchTeachers();
  };

  const positions = ['all', ...new Set(teachers.map(t => t.position).filter(Boolean))];
  const filteredTeachers = teachers.filter(t => {
    const name = `${t.user_profiles?.first_name || ''} ${t.user_profiles?.last_name || ''}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (t.specialization || '').toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'all' || t.position === selectedDept;
    return matchSearch && matchDept;
  });

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => (t.employment_status || 'active') === 'active').length,
    departments: new Set(teachers.map(t => t.position).filter(Boolean)).size,
    withSections: teachers.filter(t => t.sections && t.sections.length > 0).length,
  };

  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    probationary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  const getInitials = (t) => {
    const f = t.user_profiles?.first_name?.[0] || '';
    const l = t.user_profiles?.last_name?.[0] || '';
    return (f + l).toUpperCase() || '?';
  };

  const getGradientClass = (index) => {
    const gradients = [
      'from-blue-500 to-cyan-400', 'from-purple-500 to-pink-400', 'from-emerald-500 to-teal-400',
      'from-orange-500 to-amber-400', 'from-rose-500 to-red-400', 'from-indigo-500 to-violet-400',
      'from-teal-500 to-green-400', 'from-fuchsia-500 to-purple-400',
    ];
    return gradients[index % gradients.length];
  };

  if (loading) return (
    <div className="space-y-6 p-6">
      <SkeletonCard />
      <SkeletonDashboard />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Teachers</h2>
          <p className="text-sm text-gray-500">Manage faculty profiles and teaching assignments</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Faculty', value: stats.total, icon: '👨‍🏫', color: 'from-blue-500 to-cyan-400' },
          { label: 'Active Teachers', value: stats.active, icon: '✅', color: 'from-emerald-500 to-teal-400' },
          { label: 'Positions', value: stats.departments, icon: '🏢', color: 'from-purple-500 to-pink-400' },
          { label: 'With Advisory', value: stats.withSections, icon: '📋', color: 'from-amber-500 to-orange-400' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 bg-gradient-to-r {stat.color} bg-clip-text text-transparent">{stat.value}</p>
                </div>
                <span className="text-3xl">{stat.icon}</span>
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
            <input
              type="text"
              placeholder="Search teachers by name or specialization..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {positions.map(d => <option key={d} value={d}>{d === 'all' ? 'All Positions' : d}</option>)}
            </select>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {['grid', 'list'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === v ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {v === 'grid' ? '▦' : '☰'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Results */}
      {filteredTeachers.length === 0 ? (
        <EmptyState
          title="No teachers found"
          description={search ? 'Try adjusting your search or filters' : 'No teacher profiles have been created yet'}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredTeachers.map((teacher, i) => (
              <motion.div
                key={teacher.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => { setSelectedTeacher(teacher); setShowModal(true); }}
                className="cursor-pointer"
              >
                <GlassCard hover className="p-5 h-full">
                  <div className="flex flex-col items-center text-center">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getGradientClass(i)} flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4 transition-transform hover:scale-110`}>
                      {teacher.user_profiles?.avatar_url ? (
                        <img src={teacher.user_profiles.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                      ) : getInitials(teacher)}
                    </div>

                    {/* Name */}
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {teacher.user_profiles?.first_name} {teacher.user_profiles?.last_name}
                    </h3>

                    {/* Employee ID */}
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{teacher.user_profiles?.employee_id || 'No ID'}</p>

                    {/* Specialization */}
                    {teacher.specialization && (
                      <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {teacher.specialization}
                      </span>
                    )}

                    {/* Department */}
                    {teacher.position && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{teacher.position}</p>
                    )}

                    {/* Status */}
                    <div className="mt-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[teacher.employment_status] || statusColors.active}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(teacher.employment_status || 'active') === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {(teacher.employment_status || 'active').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(teacher); }} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteId(teacher.id); }} className="p-2 rounded-lg text-red-600 hover:bg-red-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Advisory */}
                    {teacher.sections && teacher.sections.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1 justify-center">
                        {teacher.sections.map((s, si) => (
                          <span key={si} className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                            {s.grade_levels?.name} - {s.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        /* List View */
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                <tr>
                  {['Teacher', 'Employee ID', 'Position', 'Specialization', 'Advisory', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredTeachers.map((teacher, i) => (
                  <motion.tr
                    key={teacher.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelectedTeacher(teacher); setShowModal(true); }}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getGradientClass(i)} flex items-center justify-center text-white text-sm font-bold`}>
                          {getInitials(teacher)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{teacher.user_profiles?.first_name} {teacher.user_profiles?.last_name}</p>
                          <p className="text-xs text-gray-400">{teacher.user_profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">{teacher.user_profiles?.employee_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{teacher.position || '—'}</td>
                    <td className="px-4 py-3">
                      {teacher.specialization ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{teacher.specialization}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {teacher.sections?.length > 0 ? teacher.sections.map((s, si) => (
                        <span key={si} className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 mr-1">
                          {s.name}
                        </span>
                      )) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[teacher.employment_status] || statusColors.active}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(teacher.employment_status || 'active') === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {(teacher.employment_status || 'active').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(teacher); }} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteId(teacher.id); }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Teacher Detail Modal */}
      <AnimatePresence>
        {showModal && selectedTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header gradient */}
              <div className={`h-32 bg-gradient-to-br ${getGradientClass(teachers.indexOf(selectedTeacher))} rounded-t-2xl relative`}>
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/40 transition-all"
                >✕</button>
                <div className="absolute -bottom-10 left-6">
                  <div className="w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 p-1 shadow-xl">
                    <div className={`w-full h-full rounded-xl bg-gradient-to-br ${getGradientClass(teachers.indexOf(selectedTeacher))} flex items-center justify-center text-white text-2xl font-bold`}>
                      {getInitials(selectedTeacher)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-14 px-6 pb-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedTeacher.user_profiles?.first_name} {selectedTeacher.user_profiles?.last_name}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedTeacher.user_profiles?.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Employee ID', value: selectedTeacher.user_profiles?.employee_id },
                    { label: 'Position', value: selectedTeacher.position },
                    { label: 'Specialization', value: selectedTeacher.specialization },
                    { label: 'Status', value: selectedTeacher.employment_status },
                    { label: 'License No.', value: selectedTeacher.license_number },
                    { label: 'License Expiry', value: selectedTeacher.license_expiry },
                    { label: 'Date Hired', value: selectedTeacher.date_hired },
                    { label: 'Joined', value: selectedTeacher.created_at ? new Date(selectedTeacher.created_at).toLocaleDateString() : '—' },
                  ].filter(f => f.value).map(field => (
                    <div key={field.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-xs text-gray-400 mb-1">{field.label}</p>
                      <p className="font-medium text-gray-900 dark:text-white text-sm capitalize">{field.value}</p>
                    </div>
                  ))}
                </div>

                {selectedTeacher.sections?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Advisory Sections</h3>
                    <div className="space-y-2">
                      {selectedTeacher.sections.map((s, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/50 dark:bg-purple-900/10">
                          <span className="text-lg">📚</span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.grade_levels?.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editId ? 'Edit Teacher Profile' : 'Add Teacher Profile'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher User</label>
            <select className="input-field" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} disabled={!!editId}>
              <option value="">Select teacher user...</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.last_name}, {u.first_name} {u.employee_id ? `(${u.employee_id})` : ''}
                </option>
              ))}
            </select>
            {!userOptions.length && <p className="text-xs text-amber-600 mt-1">Create a teacher user in Users first, then add the teacher profile here.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <input className="input-field" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
              <input className="input-field" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
              <input className="input-field" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label>
              <input type="date" className="input-field" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
              <select className="input-field" value={form.employment_status} onChange={e => setForm({ ...form, employment_status: e.target.value })}>
                {['active', 'inactive', 'on_leave', 'probationary'].map(status => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Hired</label>
              <input type="date" className="input-field" value={form.date_hired} onChange={e => setForm({ ...form, date_hired: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Teacher Profile"
        message="Delete this teacher profile? This cannot be undone."
      />
    </div>
  );
};

export default TeacherList;
