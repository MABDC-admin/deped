import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import AnimatedTabs from '../../components/ui/AnimatedTabs';
import EmptyState from '../../components/ui/EmptyState';

const SEVERITY = {
  minor: { label: 'Minor', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '📝', ring: 'ring-blue-400' },
  moderate: { label: 'Moderate', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: '⚠️', ring: 'ring-amber-400' },
  major: { label: 'Major', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: '🔶', ring: 'ring-orange-400' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '🚨', ring: 'ring-red-400' },
};

const getCurrentEnrollment = (enrollments = []) => (
  enrollments.find(e => e.status === 'enrolled') || enrollments[0] || null
);

const normalizeIncidentForStudent = (incident, link = null) => {
  const student = link?.students || null;
  const enrollment = getCurrentEnrollment(student?.enrollments || []);

  return {
    ...incident,
    student_link_id: link?.id || null,
    participant_role: link?.role || null,
    participant_notes: link?.notes || null,
    students: student ? { ...student, sections: enrollment?.sections || null } : null,
  };
};

const BehavioralList = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('behavioral_incidents')
        .select('*, incident_students(id, role, notes, students(id, first_name, last_name, lrn, enrollments(id, status, school_year_id, grade_levels(name), sections(name, grade_levels(name))))))')
        .order('incident_date', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).flatMap(incident => {
        const links = incident.incident_students || [];
        return links.length
          ? links.map(link => normalizeIncidentForStudent(incident, link))
          : [normalizeIncidentForStudent(incident)];
      });

      setRecords(normalized);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return records.filter(r => {
      const name = `${r.students?.first_name || ''} ${r.students?.last_name || ''}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase()) || (r.description || '').toLowerCase().includes(search.toLowerCase());
      const matchSev = severityFilter === 'all' || r.severity === severityFilter;
      return matchSearch && matchSev;
    });
  }, [records, search, severityFilter]);

  const stats = useMemo(() => ({
    total: records.length,
    minor: records.filter(r => r.severity === 'minor').length,
    moderate: records.filter(r => r.severity === 'moderate').length,
    major: records.filter(r => r.severity === 'major').length,
    critical: records.filter(r => r.severity === 'critical').length,
  }), [records]);

  const tabs = [
    { id: 'timeline', label: 'Timeline', icon: '📅' },
    { id: 'students', label: 'By Student', icon: '👨‍🎓' },
  ];

  // Group by student
  const byStudent = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const sid = r.students?.id || r.id;
      if (!map[sid]) map[sid] = { student: r.students, records: [] };
      map[sid].records.push(r);
    });
    return Object.values(map).sort((a, b) => b.records.length - a.records.length);
  }, [filtered]);

  if (loading) return <div className="space-y-6"><SkeletonLoader type="dashboard" /><SkeletonLoader type="table" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Incidents', value: stats.total, icon: '📋', color: 'from-gray-500 to-gray-400' },
          { label: 'Minor', value: stats.minor, icon: '📝', color: 'from-blue-500 to-cyan-400' },
          { label: 'Moderate', value: stats.moderate, icon: '⚠️', color: 'from-amber-500 to-yellow-400' },
          { label: 'Major', value: stats.major, icon: '🔶', color: 'from-orange-500 to-amber-400' },
          { label: 'Critical', value: stats.critical, icon: '🚨', color: 'from-red-500 to-rose-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <GlassCard className="p-4 text-center">
              <span className="text-2xl">{s.icon}</span>
              <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
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
            <input type="text" placeholder="Search by name or incident description..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex gap-3 items-center">
            <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Severity</option>
              {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <AnimatedTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {filtered.length === 0 ? (
              <EmptyState title="No incidents found" description="No behavioral records match your criteria" />
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-4">
                  {filtered.slice(0, 50).map((record, i) => {
                    const sev = SEVERITY[record.severity] || SEVERITY.minor;
                    return (
                      <motion.div
                        key={`${record.id}-${record.student_link_id || 'incident'}`}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.5) }}
                        className="relative pl-14"
                      >
                        {/* Timeline dot */}
                        <div className={`absolute left-4 top-5 w-5 h-5 rounded-full ${sev.color} flex items-center justify-center text-xs ring-4 ring-white dark:ring-gray-900`}>
                          {sev.icon}
                        </div>

                        <GlassCard className="p-4" hover>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                {record.students?.first_name} {record.students?.last_name}
                              </h4>
                              <p className="text-xs text-gray-400">{record.students?.sections?.grade_levels?.name} - {record.students?.sections?.name} • {record.students?.lrn}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.color}`}>{sev.label}</span>
                              <span className="text-xs text-gray-400">{record.incident_date ? new Date(record.incident_date).toLocaleDateString() : '—'}</span>
                            </div>
                          </div>
                          {record.incident_type && (
                            <span className="inline-block px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 mb-2">{record.incident_type}</span>
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-300">{record.description || 'No description'}</p>
                          {record.action_taken && (
                            <div className="mt-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                              <p className="text-xs text-blue-600 dark:text-blue-400"><strong>Action:</strong> {record.action_taken}</p>
                            </div>
                          )}
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'students' && (
          <motion.div key="students" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {byStudent.length === 0 ? (
              <EmptyState title="No records" description="No students with behavioral records" />
            ) : (
              <div className="space-y-4">
                {byStudent.map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <GlassCard className="p-4" hover>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-400 flex items-center justify-center text-white font-bold text-sm">
                            {item.student?.first_name?.[0]}{item.student?.last_name?.[0]}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{item.student?.first_name} {item.student?.last_name}</h4>
                            <p className="text-xs text-gray-400">{item.student?.sections?.name} • {item.records.length} incident(s)</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {Object.entries(SEVERITY).map(([key, sev]) => {
                            const count = item.records.filter(r => r.severity === key).length;
                            return count > 0 ? (
                              <span key={key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.color}`}>{count} {sev.label}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {item.records.slice(0, 3).map(r => (
                          <div key={r.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span>{SEVERITY[r.severity]?.icon}</span>
                            <span className="text-xs text-gray-400">{r.incident_date ? new Date(r.incident_date).toLocaleDateString() : ''}</span>
                            <span className="truncate">{r.description || r.incident_type || 'No description'}</span>
                          </div>
                        ))}
                        {item.records.length > 3 && <p className="text-xs text-blue-500">+{item.records.length - 3} more records</p>}
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BehavioralList;
