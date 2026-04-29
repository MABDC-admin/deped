import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, GraduationCap, BookOpen, Calendar, DollarSign, TrendingUp, Award, Heart, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonCard } from '../../components/ui/SkeletonLoader';

export default function ParentChildren() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchChildren(); }, [user?.id]);

  const fetchChildren = async () => {
    try {
      // Get guardian record for this user
      const { data: guardians } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id);
      
      if (!guardians?.length) {
        setLoading(false);
        return;
      }

      // Get student links
      const guardianIds = guardians.map(g => g.id);
      const { data: links } = await supabase
        .from('student_guardians')
        .select('student_id')
        .in('guardian_id', guardianIds);

      if (!links?.length) {
        setLoading(false);
        return;
      }

      const studentIds = links.map(l => l.student_id);
      const { data: students } = await supabase
        .from('students')
        .select('*, section_students(sections(name, grade_levels(name)))')
        .in('id', studentIds);

      const { data: activeYear } = await supabase
        .from('school_years')
        .select('id')
        .eq('is_current', true)
        .maybeSingle();

      // Get grades and attendance for each
      const enriched = await Promise.all((students || []).map(async (student) => {
        let gradeQuery = supabase
          .from('quarterly_grades')
          .select('transmuted_grade')
          .eq('student_id', student.id)
          .eq('status', 'approved')
          .limit(20);
        let attendanceQuery = supabase
          .from('attendance_records')
          .select('status')
          .eq('student_id', student.id)
          .limit(50);
        let enrollmentQuery = supabase
          .from('enrollments')
          .select('sections(name, grade_levels(name))')
          .eq('student_id', student.id)
          .maybeSingle();

        if (activeYear?.id) {
          gradeQuery = gradeQuery.eq('school_year_id', activeYear.id);
          attendanceQuery = attendanceQuery.eq('school_year_id', activeYear.id);
          enrollmentQuery = enrollmentQuery.eq('school_year_id', activeYear.id);
        }

        const [grades, attendance, enrollment] = await Promise.all([
          gradeQuery,
          attendanceQuery,
          enrollmentQuery,
        ]);

        const gradeValues = (grades.data || []).map(g => parseFloat(g.transmuted_grade)).filter(g => !isNaN(g));
        const avgGrade = gradeValues.length > 0 ? (gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length).toFixed(1) : 'N/A';
        const totalAtt = attendance.data?.length || 0;
        const presentAtt = attendance.data?.filter(a => a.status === 'present' || a.status === 'PRESENT').length || 0;
        const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

        const section = enrollment.data?.sections || student.section_students?.[0]?.sections;
        return {
          ...student,
          sectionName: section?.name || 'N/A',
          gradeLevelName: section?.grade_levels?.name || 'N/A',
          avgGrade,
          attendanceRate: attRate,
        };
      }));

      setChildren(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{[1,2].map(i => <SkeletonCard key={i} />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-7 h-7 text-teal-500" /> My Children
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor your children's academic progress and school activities</p>
      </div>

      {children.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Children Linked</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Please contact the school registrar to link your children to your account.</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {children.map((child, i) => (
            <motion.div key={child.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.15 }}>
              <GlassCard className="p-6">
                {/* Student Header */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {child.first_name?.charAt(0)}{child.last_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{child.first_name} {child.last_name}</h3>
                    <p className="text-sm text-gray-500">{child.gradeLevelName} • Section {child.sectionName}</p>
                    <p className="text-xs text-gray-400">LRN: {child.lrn || 'N/A'}</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Average Grade</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{child.avgGrade}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">Attendance</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{child.attendanceRate}%</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button className="flex-1 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium hover:shadow-lg transition-shadow flex items-center justify-center gap-2">
                    <BookOpen className="w-4 h-4" /> View Grades
                  </button>
                  <button className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
                    <DollarSign className="w-4 h-4" /> Fees
                  </button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
