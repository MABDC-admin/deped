import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import AnimatedTabs from '../../components/ui/AnimatedTabs';
import EmptyState from '../../components/ui/EmptyState';
import { predictFinalGrade, generateClassAnalytics } from '../../utils/aiInsights';

const REMARKS = {
  outstanding: { min: 90, label: 'Outstanding', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20', emoji: '🌟' },
  verySatisfactory: { min: 85, label: 'Very Satisfactory', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20', emoji: '⭐' },
  satisfactory: { min: 80, label: 'Satisfactory', color: 'text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-900/20', emoji: '✅' },
  fairlySatisfactory: { min: 75, label: 'Fairly Satisfactory', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20', emoji: '📝' },
  didNotMeet: { min: 0, label: 'Did Not Meet', color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20', emoji: '⚠️' },
};

const getRemarkInfo = (grade) => {
  if (grade >= 90) return REMARKS.outstanding;
  if (grade >= 85) return REMARKS.verySatisfactory;
  if (grade >= 80) return REMARKS.satisfactory;
  if (grade >= 75) return REMARKS.fairlySatisfactory;
  return REMARKS.didNotMeet;
};

const GradeManagement = () => {
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedQuarter, setSelectedQuarter] = useState('all');
  const [activeTab, setActiveTab] = useState('gradebook');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gradesRes, studentsRes, sectionsRes, subjectsRes] = await Promise.all([
        supabase.from('quarterly_grades').select('*, students(first_name, last_name, lrn, section_id), subjects(name, code)'),
        supabase.from('students').select('id, first_name, last_name, lrn, section_id, sections(name, grade_levels(name))').eq('status', 'active'),
        supabase.from('sections').select('id, name, grade_levels(name)').order('name'),
        supabase.from('subjects').select('id, name, code').order('name'),
      ]);
      setGrades(gradesRes.data || []);
      setStudents(studentsRes.data || []);
      setSections(sectionsRes.data || []);
      setSubjects(subjectsRes.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredGrades = useMemo(() => {
    return grades.filter(g => {
      const matchSection = selectedSection === 'all' || g.students?.section_id === selectedSection;
      const matchSubject = selectedSubject === 'all' || g.subject_id === selectedSubject;
      const matchQuarter = selectedQuarter === 'all' || g.quarter === parseInt(selectedQuarter);
      const name = `${g.students?.first_name || ''} ${g.students?.last_name || ''}`.toLowerCase();
      const matchSearch = name.includes(search.toLowerCase()) || (g.students?.lrn || '').includes(search);
      return matchSection && matchSubject && matchQuarter && matchSearch;
    });
  }, [grades, selectedSection, selectedSubject, selectedQuarter, search]);

  // Stats
  const stats = useMemo(() => {
    if (filteredGrades.length === 0) return { avg: 0, passing: 0, failing: 0, highest: 0, lowest: 0 };
    const gradeValues = filteredGrades.map(g => g.grade);
    return {
      avg: (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(1),
      passing: gradeValues.filter(g => g >= 75).length,
      failing: gradeValues.filter(g => g < 75).length,
      highest: Math.max(...gradeValues),
      lowest: Math.min(...gradeValues),
    };
  }, [filteredGrades]);

  // Grade distribution for chart
  const distribution = useMemo(() => {
    const dist = { outstanding: 0, verySatisfactory: 0, satisfactory: 0, fairlySatisfactory: 0, didNotMeet: 0 };
    filteredGrades.forEach(g => {
      if (g.grade >= 90) dist.outstanding++;
      else if (g.grade >= 85) dist.verySatisfactory++;
      else if (g.grade >= 80) dist.satisfactory++;
      else if (g.grade >= 75) dist.fairlySatisfactory++;
      else dist.didNotMeet++;
    });
    return dist;
  }, [filteredGrades]);

  const maxDist = Math.max(...Object.values(distribution), 1);

  const tabs = [
    { id: 'gradebook', label: 'Gradebook', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '🧠' },
    { id: 'distribution', label: 'Distribution', icon: '📈' },
  ];

  if (loading) return <div className="space-y-6 p-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Class Average', value: stats.avg, icon: '📊', color: 'from-blue-500 to-cyan-400' },
          { label: 'Passing', value: stats.passing, icon: '✅', color: 'from-emerald-500 to-teal-400' },
          { label: 'Failing', value: stats.failing, icon: '⚠️', color: 'from-red-500 to-rose-400' },
          { label: 'Highest', value: stats.highest, icon: '🏆', color: 'from-amber-500 to-yellow-400' },
          { label: 'Lowest', value: stats.lowest, icon: '📉', color: 'from-gray-500 to-gray-400' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <GlassCard className="p-4 text-center">
              <span className="text-2xl">{s.icon}</span>
              <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${s.color} bg-clip-text text-transparent`}>{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full lg:max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" placeholder="Search by name or LRN..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Sections</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.grade_levels?.name} - {s.name}</option>)}
            </select>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Quarters</option>
              {[1,2,3,4].map(q => <option key={q} value={q}>Quarter {q}</option>)}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Tabs */}
      <AnimatedTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'gradebook' && (
          <motion.div key="gradebook" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {filteredGrades.length === 0 ? (
              <EmptyState title="No grades found" description="Adjust filters or add grades to get started" />
            ) : (
              <GlassCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80 sticky top-0">
                      <tr>
                        {['Student', 'LRN', 'Subject', 'Quarter', 'Grade', 'Transmuted', 'Remark', 'AI Prediction'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredGrades.slice(0, 100).map((grade, i) => {
                        const remark = getRemarkInfo(grade.grade);
                        // Gather all grades for this student+subject for prediction
                        const studentSubjectGrades = grades
                          .filter(g => g.student_id === grade.student_id && g.subject_id === grade.subject_id)
                          .sort((a, b) => a.quarter - b.quarter)
                          .map(g => g.grade);
                        const prediction = predictFinalGrade(studentSubjectGrades);

                        return (
                          <motion.tr
                            key={grade.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: Math.min(i * 0.02, 0.5) }}
                            className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {grade.students?.first_name} {grade.students?.last_name}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{grade.students?.lrn || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700 dark:text-gray-300">{grade.subjects?.name || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-bold">
                                Q{grade.quarter}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-lg font-bold ${grade.grade >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {grade.grade}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {grade.transmuted_grade || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${remark.color}`}>
                                {remark.emoji} {remark.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {prediction && (
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-semibold ${prediction.willPass ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {prediction.predicted}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {prediction.trend === 'improving' ? '📈' : prediction.trend === 'declining' ? '📉' : '➡️'}
                                  </span>
                                  <span className="text-xs text-gray-400">{prediction.confidence}%</span>
                                </div>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredGrades.length > 100 && (
                  <div className="p-3 text-center text-sm text-gray-400 border-t border-gray-100 dark:border-gray-800">
                    Showing 100 of {filteredGrades.length} records
                  </div>
                )}
              </GlassCard>
            )}
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Subject Performance */}
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">📚</span> Subject Performance
                </h3>
                <div className="space-y-3">
                  {subjects.map(subject => {
                    const subjectGrades = filteredGrades.filter(g => g.subject_id === subject.id);
                    if (subjectGrades.length === 0) return null;
                    const avg = subjectGrades.reduce((a, b) => a + b.grade, 0) / subjectGrades.length;
                    const passingRate = (subjectGrades.filter(g => g.grade >= 75).length / subjectGrades.length * 100);
                    return (
                      <div key={subject.id} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{subject.name}</span>
                          <span className={`text-sm font-bold ${avg >= 75 ? 'text-emerald-600' : 'text-red-600'}`}>{avg.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${passingRate}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className={`h-full rounded-full ${passingRate >= 85 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : passingRate >= 75 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
                          />
                        </div>
                        <p className="text-xs text-gray-400">{passingRate.toFixed(0)}% passing rate • {subjectGrades.length} grades</p>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              </GlassCard>

              {/* AI Grade Predictions */}
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🧠</span> AI Final Grade Predictions
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Based on weighted moving average of quarterly performance
                </p>
                <div className="space-y-3">
                  {students.slice(0, 10).map(student => {
                    const studentGrades = grades.filter(g => g.student_id === student.id).sort((a, b) => a.quarter - b.quarter);
                    if (studentGrades.length === 0) return null;
                    const avgGrades = studentGrades.map(g => g.grade);
                    const prediction = predictFinalGrade(avgGrades);
                    if (!prediction) return null;
                    return (
                      <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                            {student.first_name?.[0]}{student.last_name?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.first_name} {student.last_name}</p>
                            <p className="text-xs text-gray-400">{student.sections?.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {prediction.trend === 'improving' ? '📈 Improving' : prediction.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                          </span>
                          <span className={`text-lg font-bold ${prediction.willPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {prediction.predicted}
                          </span>
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              </GlassCard>
            </div>
          </motion.div>
        )}

        {activeTab === 'distribution' && (
          <motion.div key="distribution" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="text-xl">📈</span> Grade Distribution (DepEd Scale)
              </h3>
              <div className="space-y-4">
                {Object.entries(REMARKS).map(([key, remark], i) => (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {remark.emoji} {remark.label}
                        <span className="text-xs text-gray-400">({remark.min}%+)</span>
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{distribution[key]}</span>
                    </div>
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(distribution[key] / maxDist) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                        className={`h-full rounded-xl ${remark.color} flex items-center justify-end pr-3`}
                        style={{ minWidth: distribution[key] > 0 ? '2rem' : 0 }}
                      >
                        {distribution[key] > 0 && (
                          <span className="text-xs font-bold">{((distribution[key] / Math.max(filteredGrades.length, 1)) * 100).toFixed(0)}%</span>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <span>💡</span>
                  {stats.passing > stats.failing
                    ? `Great performance! ${((stats.passing / Math.max(filteredGrades.length, 1)) * 100).toFixed(0)}% passing rate across ${filteredGrades.length} grades.`
                    : `Attention needed: ${stats.failing} students below passing. Consider remediation programs.`
                  }
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GradeManagement;
