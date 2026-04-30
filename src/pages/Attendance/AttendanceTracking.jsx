import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import AnimatedTabs from '../../components/ui/AnimatedTabs';
import EmptyState from '../../components/ui/EmptyState';
import { detectAttendanceAnomalies } from '../../utils/aiInsights';

const STATUS_CONFIG = {
  present: { label: 'Present', color: 'bg-emerald-500', light: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: '✅' },
  absent: { label: 'Absent', color: 'bg-red-500', light: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '❌' },
  late: { label: 'Late', color: 'bg-amber-500', light: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: '⏰' },
  excused: { label: 'Excused', color: 'bg-blue-500', light: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '📋' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const AttendanceTracking = () => {
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkStatus, setBulkStatus] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: activeYear } = await supabase
        .from('school_years')
        .select('id')
        .or('is_current.eq.true,status.eq.active')
        .limit(1)
        .maybeSingle();
      const schoolYearId = activeYear?.id || null;

      const [recordsRes, studentsRes, sectionsRes] = await Promise.all([
        supabase.from('attendance_records').select('*, students(id, first_name, last_name, lrn), sections(id, name, grade_levels(name))').order('date', { ascending: false }),
        schoolYearId
          ? supabase.from('enrollments').select('student_id, section_id, students(id, first_name, last_name, lrn), sections(id, name, grade_levels(name))').eq('school_year_id', schoolYearId).eq('status', 'enrolled').order('students(last_name)')
          : supabase.from('enrollments').select('student_id, section_id, students(id, first_name, last_name, lrn), sections(id, name, grade_levels(name))').eq('status', 'enrolled').order('students(last_name)'),
        schoolYearId
          ? supabase.from('sections').select('id, name, grade_levels(name)').eq('school_year_id', schoolYearId).order('name')
          : supabase.from('sections').select('id, name, grade_levels(name)').order('name'),
      ]);
      setActiveSchoolYearId(schoolYearId);
      setRecords(recordsRes.data || []);
      setStudents((studentsRes.data || []).filter(e => e.students).map(e => ({
        ...e.students,
        section_id: e.section_id,
        sections: e.sections,
      })));
      setSections(sectionsRes.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const filtered = selectedSection === 'all' ? records : records.filter(r => r.section_id === selectedSection);
    const total = filtered.length;
    const present = filtered.filter(r => r.status === 'present').length;
    const absent = filtered.filter(r => r.status === 'absent').length;
    const late = filtered.filter(r => r.status === 'late').length;
    return {
      total, present, absent, late,
      rate: total > 0 ? ((present / total) * 100).toFixed(1) : '0',
      absentRate: total > 0 ? ((absent / total) * 100).toFixed(1) : '0',
    };
  }, [records, selectedSection]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startPad = firstDay.getDay();
    const days = [];

    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRecords = records.filter(r => r.date === dateStr && (selectedSection === 'all' || r.section_id === selectedSection));
      const present = dayRecords.filter(r => r.status === 'present').length;
      const total = dayRecords.length;
      days.push({ day: d, date: dateStr, total, present, rate: total > 0 ? (present / total * 100) : null });
    }
    return days;
  }, [records, selectedMonth, selectedYear, selectedSection]);

  const getHeatColor = (rate) => {
    if (rate === null) return 'bg-gray-100 dark:bg-gray-800';
    if (rate >= 95) return 'bg-emerald-500';
    if (rate >= 85) return 'bg-emerald-400';
    if (rate >= 75) return 'bg-amber-400';
    if (rate >= 60) return 'bg-orange-400';
    return 'bg-red-500';
  };

  // AI anomalies
  const anomalies = useMemo(() => {
    const filtered = selectedSection === 'all' ? records : records.filter(r => r.section_id === selectedSection);
    return detectAttendanceAnomalies(filtered);
  }, [records, selectedSection]);

  // Bulk attendance
  const sectionStudents = useMemo(() => {
    if (selectedSection === 'all') return students;
    return students.filter(s => s.section_id === selectedSection);
  }, [students, selectedSection]);

  const handleBulkSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(bulkStatus).map(([studentId, status]) => ({
        student_id: studentId,
        section_id: students.find(s => s.id === studentId)?.section_id || null,
        date: bulkDate,
        status,
        school_year_id: activeSchoolYearId,
      }));
      if (entries.length > 0) {
        const { error } = await supabase.from('attendance_records').upsert(entries, { onConflict: 'student_id,date' });
        if (error) throw error;
        await fetchData();
        setBulkStatus({});
      }
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status) => {
    const newStatus = {};
    sectionStudents.forEach(s => { newStatus[s.id] = status; });
    setBulkStatus(newStatus);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'heatmap', label: 'Calendar Heatmap', icon: '🗓️' },
    { id: 'bulk', label: 'Bulk Marking', icon: '✏️' },
    { id: 'anomalies', label: 'AI Anomalies', icon: '🧠', count: anomalies.length },
  ];

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Attendance Rate', value: `${stats.rate}%`, icon: '📊', color: 'from-emerald-500 to-teal-400', sub: `${stats.present} present` },
          { label: 'Total Records', value: stats.total, icon: '📋', color: 'from-blue-500 to-cyan-400', sub: 'all time' },
          { label: 'Absences', value: stats.absent, icon: '❌', color: 'from-red-500 to-rose-400', sub: `${stats.absentRate}% rate` },
          { label: 'Late Arrivals', value: stats.late, icon: '⏰', color: 'from-amber-500 to-orange-400', sub: 'tardiness' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
                <span className="text-3xl">{s.icon}</span>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Section Filter */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none">
            <option value="all">All Sections</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.grade_levels?.name} - {s.name}</option>)}
          </select>
          <AnimatedTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </GlassCard>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                    <tr>
                      {['Date', 'Student', 'LRN', 'Section', 'Status', 'Time In'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {records.slice(0, 100).map((record, i) => (
                      <motion.tr key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{record.students?.first_name} {record.students?.last_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{record.students?.lrn || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.sections?.grade_levels?.name} {record.sections?.name ? `- ${record.sections.name}` : ''}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[record.status]?.light || ''}`}>
                            {STATUS_CONFIG[record.status]?.icon} {STATUS_CONFIG[record.status]?.label || record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{record.time_in || '—'}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {activeTab === 'heatmap' && (
          <motion.div key="heatmap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🗓️</span> Attendance Heatmap
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); } else setSelectedMonth(m => m - 1); }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">←</button>
                  <span className="px-4 py-1.5 font-medium text-gray-700 dark:text-gray-300">{MONTHS[selectedMonth]} {selectedYear}</span>
                  <button onClick={() => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); } else setSelectedMonth(m => m + 1); }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">→</button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAYS.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400">{d}</div>)}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {heatmapData.map((day, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-all ${
                      day ? `${getHeatColor(day.rate)} ${day.rate !== null ? 'text-white shadow-sm hover:scale-110 cursor-pointer' : 'text-gray-400'}` : ''
                    }`}
                    title={day ? `${day.date}: ${day.present}/${day.total} present (${day.rate?.toFixed(0) || 0}%)` : ''}
                  >
                    {day && <>
                      <span className="font-bold">{day.day}</span>
                      {day.rate !== null && <span className="text-[10px] opacity-80">{day.rate.toFixed(0)}%</span>}
                    </>}
                  </motion.div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-6">
                {[
                  { label: '95%+', color: 'bg-emerald-500' },
                  { label: '85-94%', color: 'bg-emerald-400' },
                  { label: '75-84%', color: 'bg-amber-400' },
                  { label: '60-74%', color: 'bg-orange-400' },
                  { label: '<60%', color: 'bg-red-500' },
                  { label: 'No data', color: 'bg-gray-200 dark:bg-gray-700' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded ${l.color}`} />
                    <span className="text-xs text-gray-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {activeTab === 'bulk' && (
          <motion.div key="bulk" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>✏️</span> Bulk Attendance Marking
                </h3>
                <div className="flex items-center gap-3">
                  <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" />
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mb-4">
                <span className="text-sm text-gray-500 py-1.5">Quick:</span>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => markAll(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 ${cfg.light}`}>
                    {cfg.icon} Mark All {cfg.label}
                  </button>
                ))}
              </div>

              {sectionStudents.length === 0 ? (
                <EmptyState title="Select a section" description="Choose a section above to mark attendance" />
              ) : (
                <>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {sectionStudents.map((student, i) => (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium w-6 text-gray-400">{i + 1}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.last_name}, {student.first_name}</p>
                            <p className="text-xs text-gray-400 font-mono">{student.lrn || 'No LRN'}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <button
                              key={key}
                              onClick={() => setBulkStatus(prev => ({ ...prev, [student.id]: key }))}
                              className={`w-9 h-9 rounded-xl text-sm flex items-center justify-center transition-all ${
                                bulkStatus[student.id] === key
                                  ? `${cfg.color} text-white shadow-lg scale-110`
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                              }`}
                              title={cfg.label}
                            >
                              {cfg.icon}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {Object.keys(bulkStatus).length} of {sectionStudents.length} marked
                    </p>
                    <button
                      onClick={handleBulkSave}
                      disabled={saving || Object.keys(bulkStatus).length === 0}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {saving ? (
                        <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</span>
                      ) : `Save Attendance (${Object.keys(bulkStatus).length})`}
                    </button>
                  </div>
                </>
              )}
            </GlassCard>
          </motion.div>
        )}

        {activeTab === 'anomalies' && (
          <motion.div key="anomalies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span>🧠</span> AI-Detected Attendance Anomalies
              </h3>
              {anomalies.length === 0 ? (
                <EmptyState title="No anomalies detected" description="AI analysis shows normal attendance patterns. Great job!" />
              ) : (
                <div className="space-y-3">
                  {anomalies.map((anomaly, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`p-4 rounded-xl border ${
                        anomaly.type === 'spike' ? 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30' :
                        anomaly.type === 'consecutive' ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30' :
                        'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{anomaly.type === 'spike' ? '📊' : anomaly.type === 'consecutive' ? '📅' : '🔄'}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm capitalize">{anomaly.type} Anomaly</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{anomaly.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceTracking;
