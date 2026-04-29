import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Users, Clock, MapPin, GraduationCap, ChevronRight, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';

export default function TeacherClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalClasses: 0, avgAttendance: 0, pendingGrades: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    try {
      // Get teacher's sections (as adviser)
      const { data: sections } = await supabase
        .from('sections')
        .select('*, grade_levels(name), section_students(id, student_id)')
        .eq('adviser_id', user.id);

      // Get teacher's schedule
      const { data: schedules } = await supabase
        .from('class_schedules')
        .select('*, sections(name, grade_levels(name)), subjects(name)')
        .eq('teacher_id', user.id);

      // Build advisory section IDs set for badge logic
      const advisorySectionIds = new Set((sections || []).map(s => s.id));

      const sectionMap = {};
      (sections || []).forEach(s => {
        sectionMap[s.id] = {
          ...s,
          isAdvisory: true,
          studentCount: s.section_students?.length || 0,
          gradeLevelName: s.grade_levels?.name || '',
          subjects: []
        };
      });

      (schedules || []).forEach(sch => {
        const sid = sch.section_id;
        if (!sectionMap[sid]) {
          sectionMap[sid] = {
            id: sid,
            name: sch.sections?.name || 'Unknown',
            isAdvisory: false,
            gradeLevelName: sch.sections?.grade_levels?.name || '',
            studentCount: 0,
            subjects: []
          };
        }
        sectionMap[sid].subjects.push({
          name: sch.subjects?.name || '',
          day: sch.day_of_week,
          startTime: sch.start_time,
          endTime: sch.end_time,
          room: sch.room
        });
      });

      const classList = Object.values(sectionMap);
      const totalStudents = classList.reduce((sum, c) => sum + (c.studentCount || 0), 0);
      const sectionIds = classList.map(c => c.id);

      // Compute real attendance percentage
      let avgAttendance = 0;
      if (sectionIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('status')
          .in('section_id', sectionIds);

        if (attData && attData.length > 0) {
          const presentCount = attData.filter(r => r.status === 'present' || r.status === 'late').length;
          avgAttendance = Math.round((presentCount / attData.length) * 100);
        }
      }

      // Compute pending grades: sections × subjects that lack quarterly grades for any quarter
      let pendingGrades = 0;
      if (sectionIds.length > 0) {
        const { data: qgData } = await supabase
          .from('quarterly_grades')
          .select('section_id, subject_id, quarter_id')
          .in('section_id', sectionIds);

        // Count unique (section, subject) combos that have schedules
        const expectedCombos = new Set();
        (schedules || []).forEach(sch => {
          expectedCombos.add(`${sch.section_id}::${sch.subject_id}`);
        });

        // Count unique (section, subject) combos that have at least 1 quarterly grade
        const gradedCombos = new Set();
        (qgData || []).forEach(qg => {
          gradedCombos.add(`${qg.section_id}::${qg.subject_id}`);
        });

        pendingGrades = [...expectedCombos].filter(c => !gradedCombos.has(c)).length;
      }

      setClasses(classList);
      setStats({ totalStudents, totalClasses: classList.length, avgAttendance, pendingGrades });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const statCards = [
    { label: 'My Classes', value: stats.totalClasses, icon: BookOpen, color: 'from-blue-500 to-cyan-500' },
    { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'from-violet-500 to-purple-500' },
    { label: 'Avg Attendance', value: `${stats.avgAttendance}%`, icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
    { label: 'Pending Grades', value: stats.pendingGrades, icon: AlertCircle, color: 'from-amber-500 to-orange-500' },
  ];

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your advisory classes and subject assignments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Class Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {classes.map((cls, i) => (
          <motion.div key={cls.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
            <GlassCard className="p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{cls.gradeLevelName} - {cls.name}</h3>
                      <p className="text-xs text-gray-500">{cls.studentCount} students</p>
                    </div>
                  </div>
                </div>
                {cls.isAdvisory ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    Advisory
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400">
                    Subject
                  </span>
                )}
              </div>
              
              {cls.subjects.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Schedule</p>
                  {cls.subjects.slice(0, 5).map((subj, j) => (
                    <div key={j} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-white/5 text-sm">
                      <span className="w-10 text-center font-medium text-blue-600 dark:text-blue-400">{dayNames[subj.day]}</span>
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-300">{subj.startTime?.slice(0,5)} - {subj.endTime?.slice(0,5)}</span>
                      <span className="font-medium text-gray-800 dark:text-white flex-1">{subj.name}</span>
                      {subj.room && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />{subj.room}
                        </span>
                      )}
                    </div>
                  ))}
                  {cls.subjects.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">+{cls.subjects.length - 5} more subjects</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => navigate('/grades/entry', { state: { sectionId: cls.id } })}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:shadow-lg transition-shadow flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" /> View Grades
                </button>
                <button
                  onClick={() => navigate('/attendance', { state: { sectionId: cls.id } })}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Attendance
                </button>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {classes.length === 0 && (
        <GlassCard className="p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Classes Assigned Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Contact the administrator to get your class assignments.</p>
        </GlassCard>
      )}
    </div>
  );
}
