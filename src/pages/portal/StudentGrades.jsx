import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, BookOpen, Award, TrendingUp, Star, Target, CheckCircle2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';

export default function StudentGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchGrades(); }, [user?.id]);

  const fetchGrades = async () => {
    try {
      // Find student record for this user
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!student) {
        setLoading(false);
        return;
      }

      const { data: activeYear } = await supabase
        .from('school_years')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();

      let gradeQuery = supabase
        .from('quarterly_grades')
        .select('*, subjects(name), quarters(name, quarter_number)')
        .eq('student_id', student.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (activeYear?.id) gradeQuery = gradeQuery.eq('school_year_id', activeYear.id);

      const { data: gradeData } = await gradeQuery;

      // Group by subject
      const subjectMap = {};
      (gradeData || []).forEach(g => {
        const subjectName = g.subjects?.name || 'Unknown';
        if (!subjectMap[subjectName]) {
          subjectMap[subjectName] = { name: subjectName, quarters: {} };
        }
        const qNum = g.quarters?.quarter_number || 0;
        subjectMap[subjectName].quarters[qNum] = parseFloat(g.transmuted_grade) || 0;
      });

      const subjectGrades = Object.values(subjectMap).map(s => {
        const vals = Object.values(s.quarters);
        const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
        return { ...s, average: parseFloat(avg) };
      });

      const allGrades = subjectGrades.map(s => s.average).filter(g => g > 0);
      const gwa = allGrades.length > 0 ? (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(2) : 0;
      const highest = allGrades.length > 0 ? Math.max(...allGrades) : 0;
      const lowest = allGrades.length > 0 ? Math.min(...allGrades) : 0;

      setStats({ gwa: parseFloat(gwa), highest, lowest, subjectCount: subjectGrades.length });
      setGrades(subjectGrades.sort((a, b) => b.average - a.average));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    if (grade >= 90) return 'text-green-600 dark:text-green-400';
    if (grade >= 85) return 'text-blue-600 dark:text-blue-400';
    if (grade >= 80) return 'text-amber-600 dark:text-amber-400';
    if (grade >= 75) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getGradeBg = (grade) => {
    if (grade >= 90) return 'bg-green-500';
    if (grade >= 85) return 'bg-blue-500';
    if (grade >= 80) return 'bg-amber-500';
    if (grade >= 75) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-indigo-500" /> My Academic Report
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track your grades and academic progress</p>
      </div>

      {/* GWA & Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="p-5 text-center" gradient="from-indigo-500/10 to-blue-500/10">
              <Award className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">General Weighted Average</p>
              <p className={`text-4xl font-bold mt-1 ${getGradeColor(stats.gwa)}`}>{stats.gwa}</p>
              {stats.gwa >= 90 && <p className="text-xs text-green-500 mt-1 font-medium flex items-center justify-center gap-1"><Star className="w-3 h-3" /> With Honors!</p>}
            </GlassCard>
          </motion.div>
          {[
            { label: 'Highest Grade', value: stats.highest, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
            { label: 'Lowest Grade', value: stats.lowest, icon: Target, color: 'from-amber-500 to-orange-500' },
            { label: 'Subjects', value: stats.subjectCount, icon: BookOpen, color: 'from-violet-500 to-purple-500' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 1) * 0.1 }}>
              <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* Subject Grades */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Subject Grades by Quarter</h2>
        <div className="space-y-3">
          {grades.map((subject, i) => (
            <motion.div key={subject.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-xl bg-gray-50 dark:bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded-full ${getGradeBg(subject.average)}`} />
                  <span className="font-medium text-gray-900 dark:text-white">{subject.name}</span>
                </div>
                <span className={`text-lg font-bold ${getGradeColor(subject.average)}`}>{subject.average}</span>
              </div>
              <div className="flex gap-2 ml-5">
                {[1, 2, 3, 4].map(q => (
                  <div key={q} className={`flex-1 text-center p-2 rounded-lg ${subject.quarters[q] ? 'bg-white dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
                    <p className="text-[10px] text-gray-400 mb-0.5">Q{q}</p>
                    <p className={`text-sm font-bold ${subject.quarters[q] ? getGradeColor(subject.quarters[q]) : 'text-gray-300 dark:text-gray-600'}`}>
                      {subject.quarters[q] || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
          {grades.length === 0 && (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Grades Yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Your grades will appear here once your teachers submit them.</p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
