import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: '🟢' },
  ongoing: { label: 'Ongoing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '🔵' },
  resolved: { label: 'Resolved', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: '✅' },
  referred: { label: 'Referred', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: '↗️' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-500', icon: '🔒' },
};

const TYPE_ICONS = {
  academic: '📚', behavioral: '🔔', personal: '💭', family: '👨‍👩‍👧', career: '🎯', emotional: '💝', social: '👥',
};

const getCurrentEnrollment = (enrollments = []) => (
  enrollments.find(e => e.status === 'enrolled') || enrollments[0] || null
);

const normalizeCounselingRecord = (record) => {
  const enrollment = getCurrentEnrollment(record.students?.enrollments || []);

  return {
    ...record,
    students: record.students ? { ...record.students, sections: enrollment?.sections || null } : null,
  };
};

const CounselingList = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('counseling_records')
        .select('*, students(id, first_name, last_name, lrn, enrollments(id, status, school_year_id, grade_levels(name), sections(name, grade_levels(name)))))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCases((data || []).map(normalizeCounselingRecord));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return cases.filter(c => {
      const name = `${c.students?.first_name || ''} ${c.students?.last_name || ''}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase()) || (c.concern || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [cases, search, statusFilter]);

  const stats = useMemo(() => ({
    total: cases.length,
    active: cases.filter(c => c.status === 'active' || c.status === 'ongoing').length,
    resolved: cases.filter(c => c.status === 'resolved' || c.status === 'closed').length,
    types: [...new Set(cases.map(c => c.session_type).filter(Boolean))].length,
  }), [cases]);

  if (loading) return <div className="space-y-6"><SkeletonLoader type="dashboard" /><SkeletonLoader type="table" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases', value: stats.total, icon: '📋', color: 'from-blue-500 to-cyan-400' },
          { label: 'Active Cases', value: stats.active, icon: '🟢', color: 'from-emerald-500 to-teal-400' },
          { label: 'Resolved', value: stats.resolved, icon: '✅', color: 'from-gray-500 to-gray-400' },
          { label: 'Concern Types', value: stats.types, icon: '🏷️', color: 'from-purple-500 to-pink-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
                </div>
                <span className="text-3xl">{s.icon}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full sm:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search by name or concern..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
      </GlassCard>

      {/* Cases */}
      {filtered.length === 0 ? (
        <EmptyState title="No counseling records" description="No cases match your criteria" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((caseItem, i) => {
            const status = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.active;
            const typeIcon = TYPE_ICONS[caseItem.session_type] || '📋';
            return (
              <motion.div key={caseItem.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.5) }}
                onClick={() => setSelectedCase(caseItem)} className="cursor-pointer">
                <GlassCard hover className="p-5 h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                        {caseItem.students?.first_name?.[0]}{caseItem.students?.last_name?.[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{caseItem.students?.first_name} {caseItem.students?.last_name}</h4>
                        <p className="text-xs text-gray-400">{caseItem.students?.sections?.grade_levels?.name} - {caseItem.students?.sections?.name}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.icon} {status.label}</span>
                  </div>

                  {caseItem.session_type && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 mb-2">
                      {typeIcon} {caseItem.session_type}
                    </span>
                  )}

                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">{caseItem.concern || 'No concern description'}</p>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">
                      {caseItem.created_at ? new Date(caseItem.created_at).toLocaleDateString() : '—'}
                    </span>
                    {caseItem.follow_up_date && <span className="text-xs text-blue-500">Follow-up {new Date(caseItem.follow_up_date).toLocaleDateString()}</span>}
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Case Detail Modal */}
      <AnimatePresence>
        {selectedCase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCase(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-white font-bold">
                    {selectedCase.students?.first_name?.[0]}{selectedCase.students?.last_name?.[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{selectedCase.students?.first_name} {selectedCase.students?.last_name}</h3>
                    <p className="text-sm text-gray-400">{selectedCase.students?.lrn}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCase(null)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">✕</button>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Session Type', value: selectedCase.session_type },
                  { label: 'Status', value: selectedCase.status },
                  { label: 'Concern', value: selectedCase.concern },
                  { label: 'Findings', value: selectedCase.findings },
                  { label: 'Action Taken', value: selectedCase.action_taken },
                  { label: 'Recommendations', value: selectedCase.recommendations },
                  { label: 'Follow-up Notes', value: selectedCase.follow_up_notes },
                  { label: 'Date', value: selectedCase.session_date ? new Date(selectedCase.session_date).toLocaleDateString() : null },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs text-gray-400 mb-1">{f.label}</p>
                    <p className="text-sm text-gray-900 dark:text-white capitalize">{f.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CounselingList;
