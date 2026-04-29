import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import AnimatedBadge from '../../components/ui/AnimatedBadge';
import EmptyState from '../../components/ui/EmptyState';

const TeacherList = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchTeachers(); }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select(`
          *,
          user_profiles!teacher_profiles_user_id_fkey(first_name, last_name, email, avatar_url),
          sections(name, grade_levels(name))
        `);
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  const departments = ['all', ...new Set(teachers.map(t => t.department).filter(Boolean))];
  const filteredTeachers = teachers.filter(t => {
    const name = `${t.user_profiles?.first_name || ''} ${t.user_profiles?.last_name || ''}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (t.specialization || '').toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'all' || t.department === selectedDept;
    return matchSearch && matchDept;
  });

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.status === 'active').length,
    departments: new Set(teachers.map(t => t.department).filter(Boolean)).size,
    withSections: teachers.filter(t => t.sections && t.sections.length > 0).length,
  };

  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
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
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Faculty', value: stats.total, icon: '👨‍🏫', color: 'from-blue-500 to-cyan-400' },
          { label: 'Active Teachers', value: stats.active, icon: '✅', color: 'from-emerald-500 to-teal-400' },
          { label: 'Departments', value: stats.departments, icon: '🏢', color: 'from-purple-500 to-pink-400' },
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
              {departments.map(d => <option key={d} value={d}>{d === 'all' ? 'All Departments' : d}</option>)}
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
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{teacher.employee_id || 'No ID'}</p>

                    {/* Specialization */}
                    {teacher.specialization && (
                      <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {teacher.specialization}
                      </span>
                    )}

                    {/* Department */}
                    {teacher.department && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{teacher.department}</p>
                    )}

                    {/* Status */}
                    <div className="mt-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[teacher.status] || statusColors.active}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${teacher.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {(teacher.status || 'active').replace('_', ' ')}
                      </span>
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
                  {['Teacher', 'Employee ID', 'Department', 'Specialization', 'Advisory', 'Status'].map(h => (
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
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">{teacher.employee_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{teacher.department || '—'}</td>
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
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[teacher.status] || statusColors.active}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${teacher.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {(teacher.status || 'active').replace('_', ' ')}
                      </span>
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
                    { label: 'Employee ID', value: selectedTeacher.employee_id },
                    { label: 'Department', value: selectedTeacher.department },
                    { label: 'Specialization', value: selectedTeacher.specialization },
                    { label: 'Status', value: selectedTeacher.status },
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
    </div>
  );
};

export default TeacherList;
