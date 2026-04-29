import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  ClipboardList, Users, Layers, Target, FileText, CheckCircle2, Clock, AlertCircle,
  TrendingUp, TrendingDown, GraduationCap, ChevronRight, UserPlus, BookOpen, Calendar, Settings,
  BarChart3, PlusCircle, Search, ArrowRight, Building, Brain, Sparkles, Award,
  AlertTriangle, Zap, ArrowUpRight, Activity, Shield, FileSearch
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GlassCard, AnimatedCounter, SkeletonDashboard, AnimatedBadge } from '../../components/ui';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function RegistrarDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [stats, setStats] = useState({
    totalEnrolled: 0, pendingEnrollments: 0, unassignedSections: 0,
    totalSections: 0, gradeLevels: 0, totalStudents: 0, sectionCapacity: 0,
    maleCount: 0, femaleCount: 0, totalCapacity: 0, totalOccupied: 0,
    totalRecords: 0,
  });
  const [enrollmentsByGrade, setEnrollmentsByGrade] = useState([]);
  const [enrollmentTypeData, setEnrollmentTypeData] = useState([]);
  const [recentEnrollments, setRecentEnrollments] = useState([]);
  const [sectionStats, setSectionStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState(null);
  const [insights, setInsights] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { data: yearData } = await supabase
        .from('school_years')
        .select('id, year_name')
        .eq('is_current', true)
        .maybeSingle();

      const yearId = yearData?.id;
      setActiveYear(yearData);

      let enrollQuery = supabase.from('enrollments')
        .select('id, status, enrollment_date, enrollment_type, grade_level_id, section_id, student_id, students(first_name, last_name, lrn, gender), grade_levels(name, level_order, category), sections(name)')
        .order('enrollment_date', { ascending: false });
      let sectionsQuery = supabase.from('sections')
        .select('id, name, max_capacity, grade_level_id, grade_levels(name, level_order), section_students(id)')
        .eq('is_active', true);

      if (yearId) {
        enrollQuery = enrollQuery.eq('school_year_id', yearId);
        sectionsQuery = sectionsQuery.eq('school_year_id', yearId);
      } else {
        enrollQuery = enrollQuery.limit(0);
        sectionsQuery = sectionsQuery.limit(0);
      }

      const [enrollRes, sectionsRes, gradeLevelsRes] = await Promise.all([
        enrollQuery,
        sectionsQuery,
        supabase.from('grade_levels')
          .select('id, name, level_order, category')
          .eq('is_active', true)
          .order('level_order'),
      ]);

      const enrollments = enrollRes.data || [];
      const sections = sectionsRes.data || [];
      const gradeLevels = gradeLevelsRes.data || [];
      const totalStudents = enrollments.filter(e => e.status === 'enrolled').length;

      const enrolled = enrollments.filter(e => e.status === 'enrolled').length;
      const pending = enrollments.filter(e => e.status === 'pending').length;
      const unassigned = enrollments.filter(e => !e.section_id).length;
      const totalCapacity = sections.reduce((sum, s) => sum + (s.max_capacity || 40), 0);
      const totalOccupied = sections.reduce((sum, s) => sum + (s.section_students?.length || 0), 0);
      const maleCount = enrollments.filter(e => e.students?.gender === 'Male').length;
      const femaleCount = enrollments.filter(e => e.students?.gender === 'Female').length;

      setStats({
        totalEnrolled: enrolled, pendingEnrollments: pending, unassignedSections: unassigned,
        totalSections: sections.length, gradeLevels: gradeLevels.length, totalStudents,
        sectionCapacity: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0,
        maleCount, femaleCount, totalCapacity, totalOccupied,
        totalRecords: enrollments.length,
      });

      // Enrollment by grade
      const gradeMap = {};
      gradeLevels.forEach(gl => {
        gradeMap[gl.id] = { id: gl.id, name: gl.name.replace('Grade ', 'G'), fullName: gl.name, order: gl.level_order, category: gl.category, enrolled: 0, pending: 0 };
      });
      enrollments.forEach(e => {
        if (gradeMap[e.grade_level_id]) {
          if (e.status === 'enrolled') gradeMap[e.grade_level_id].enrolled++;
          if (e.status === 'pending') gradeMap[e.grade_level_id].pending++;
        }
      });
      setEnrollmentsByGrade(Object.values(gradeMap).sort((a, b) => a.order - b.order));

      // Enrollment type breakdown
      const typeMap = {};
      enrollments.forEach(e => {
        const t = e.enrollment_type || 'new';
        typeMap[t] = (typeMap[t] || 0) + 1;
      });
      const typeColors = { new: '#10b981', old: '#3b82f6', transferee: '#8b5cf6', returnee: '#f59e0b', cross_enrollee: '#ec4899' };
      const typeLabels = { new: 'New', old: 'Old/Continuing', transferee: 'Transferee', returnee: 'Returnee', cross_enrollee: 'Cross-Enrollee' };
      setEnrollmentTypeData(Object.entries(typeMap).map(([k, v]) => ({
        name: typeLabels[k] || k, value: v, color: typeColors[k] || '#64748b',
      })));

      // Section capacity
      const sectionData = sections.map(s => ({
        name: `${s.grade_levels?.name?.replace('Grade ', 'G') || ''} - ${s.name}`,
        students: s.section_students?.length || 0,
        capacity: s.max_capacity || 40,
        pct: Math.round(((s.section_students?.length || 0) / (s.max_capacity || 40)) * 100),
      })).sort((a, b) => b.pct - a.pct);
      setSectionStats(sectionData.slice(0, 8));

      // Recent enrollments
      setRecentEnrollments(enrollments.slice(0, 8));

      // Smart insights
      const newInsights = [];
      if (!yearId) {
        newInsights.push({ type: 'danger', icon: Calendar, title: 'No Active School Year', message: 'Set one school year as current before processing enrollment and records.' });
      }
      if (pending > 0) {
        newInsights.push({ type: 'warning', icon: Clock, title: 'Pending Enrollments', message: `${pending} enrollment${pending > 1 ? 's' : ''} awaiting approval. Review and process to avoid delays.` });
      }
      if (unassigned > 0) {
        newInsights.push({ type: 'danger', icon: AlertTriangle, title: 'No Section Assigned', message: `${unassigned} student${unassigned > 1 ? 's' : ''} enrolled but not assigned to any section.` });
      }
      const overCap = sections.filter(s => (s.section_students?.length || 0) >= (s.max_capacity || 40));
      if (overCap.length > 0) {
        newInsights.push({ type: 'danger', icon: AlertCircle, title: 'Sections at Capacity', message: `${overCap.length} section${overCap.length > 1 ? 's are' : ' is'} at or over capacity. Consider creating more sections.` });
      }
      if (enrolled > 0 && pending === 0 && unassigned === 0) {
        newInsights.push({ type: 'success', icon: CheckCircle2, title: 'All Clear', message: `All ${enrolled} enrollments are processed and assigned. Great work!` });
      }
      const capPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
      newInsights.push({ type: 'info', icon: Brain, title: 'Capacity Analysis', message: `Overall section fill rate is ${capPct}%. ${capPct > 85 ? 'Consider adding sections.' : capPct < 40 ? 'Room for more students.' : 'Utilization looks healthy.'}` });
      setInsights(newInsights.slice(0, 3));
    } catch (err) {
      console.error('RegistrarRecords error:', err);
    } finally {
      setLoading(false);
    }
  };

  const genderData = useMemo(() => [
    { name: 'Male', value: stats.maleCount, color: isDark ? '#60a5fa' : '#3b82f6' },
    { name: 'Female', value: stats.femaleCount, color: isDark ? '#f472b6' : '#ec4899' },
  ], [stats, isDark]);

  const colors = isDark
    ? ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f472b6', '#fb923c', '#2dd4bf', '#818cf8', '#a3e635']
    : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16'];

  if (loading) return <SkeletonDashboard />;

  const statCards = [
    { label: 'Enrolled', value: stats.totalEnrolled, icon: CheckCircle2, color: 'from-emerald-600 to-emerald-400', shadow: 'shadow-emerald-500/25', glow: 'hover:shadow-neon-green', desc: 'Active this SY' },
    { label: 'Pending', value: stats.pendingEnrollments, icon: Clock, color: 'from-amber-600 to-amber-400', shadow: 'shadow-amber-500/25', glow: 'hover:shadow-neon-amber', desc: 'Awaiting approval' },
    { label: 'No Section', value: stats.unassignedSections, icon: AlertCircle, color: stats.unassignedSections > 0 ? 'from-red-600 to-red-400' : 'from-slate-500 to-gray-400', shadow: stats.unassignedSections > 0 ? 'shadow-red-500/25' : '', glow: stats.unassignedSections > 0 ? 'hover:shadow-neon-red' : '', desc: 'Need assignment' },
    { label: 'Sections', value: stats.totalSections, icon: Layers, color: 'from-blue-600 to-blue-400', shadow: 'shadow-blue-500/25', glow: 'hover:shadow-neon-blue', desc: `${stats.sectionCapacity}% filled` },
  ];

  const statusColors = {
    enrolled: 'success', pending: 'warning', dropped: 'danger', transferred: 'neutral',
  };
  const typeColors = {
    new: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    old: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    transferee: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
    returnee: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
    cross_enrollee: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-400',
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card !p-3 !rounded-xl text-sm border border-white/10 dark:border-white/5 shadow-xl">
        <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
            <span className="text-gray-500 dark:text-gray-400">{p.name}:</span>
            <span className="font-bold text-gray-800 dark:text-gray-100">{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Registrar';

  return (
    <motion.div className="space-y-6" variants={stagger} initial="initial" animate="animate">
      {/* ═══ Welcome Banner ═══ */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-500 p-6 md:p-8 text-white">
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/5 rounded-full blur-xl" />
        <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-amber-400/10 rounded-full blur-lg" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <AnimatedBadge variant="info" size="xs" dot pulse>
              <Shield className="w-3 h-3" /> Records Office
            </AnimatedBadge>
            {activeYear && (
              <AnimatedBadge variant="neutral" size="xs">
                <Calendar className="w-3 h-3" /> SY {activeYear.year_name}
              </AnimatedBadge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{getGreeting()}, {firstName} 📋</h1>
          <p className="text-teal-200 text-sm mb-5">Enrollment, students, sections &amp; academic records</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Students', val: stats.totalStudents, icon: Users },
              { label: 'Enrolled', val: stats.totalEnrolled, icon: CheckCircle2 },
              { label: 'Sections', val: stats.totalSections, icon: Layers },
              { label: 'Capacity', val: `${stats.sectionCapacity}%`, icon: Target },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5">
                <m.icon className="w-4 h-4 text-teal-200 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold leading-tight">{typeof m.val === 'number' ? m.val.toLocaleString() : m.val}</p>
                  <p className="text-[10px] text-teal-200 font-medium">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ═══ Stat Cards ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className={`glass-card glass-card-hover p-5 group cursor-pointer transition-shadow duration-300 ${card.glow}`}
            variants={fadeUp}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(card.label === 'Sections' ? '/sections' : '/enrollment')}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg ${card.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="w-5.5 h-5.5 text-white" />
              </div>
              <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{card.desc}</span>
            </div>
            <AnimatedCounter value={card.value} className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{card.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ Smart Insights ═══ */}
      {insights.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Smart Insights</h2>
            <AnimatedBadge variant="info" size="xs" dot pulse>Live</AnimatedBadge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, i) => {
              const colorMap = {
                success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200/60 dark:border-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15' },
                warning: { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200/60 dark:border-amber-500/20', icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-500/15' },
                danger: { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200/60 dark:border-red-500/20', icon: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-500/15' },
                info: { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200/60 dark:border-blue-500/20', icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-500/15' },
              };
              const c = colorMap[insight.type] || colorMap.info;
              return (
                <GlassCard key={i} delay={i * 0.1} className={`!p-4 border ${c.border} ${c.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
                      <insight.icon className={`w-5 h-5 ${c.icon}`} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{insight.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{insight.message}</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ Charts Row 1: Enrollment by Grade (Stacked Bar) + Enrollment Type Donut ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between -mx-5 -mt-5 mb-5 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-teal-500 via-teal-400 to-cyan-400 dark:from-teal-600 dark:via-teal-500 dark:to-cyan-500 border-b border-teal-600 dark:border-teal-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Enrollment by Grade Level</span>
            </h3>
            <button onClick={() => navigate('/enrollment')} className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={enrollmentsByGrade} barSize={24}>
              <defs>
                <linearGradient id="gradEnrolled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={1} />
                  <stop offset="100%" stopColor={isDark ? '#34d399' : '#10b981'} stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isDark ? '#fbbf24' : '#f59e0b'} stopOpacity={1} />
                  <stop offset="100%" stopColor={isDark ? '#fbbf24' : '#f59e0b'} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
              <Legend formatter={(v) => <span className="text-xs font-medium">{v}</span>} />
              <Bar dataKey="enrolled" name="Enrolled" stackId="a" fill="url(#gradEnrolled)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="pending" name="Pending" stackId="a" fill="url(#gradPending)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <div className="-mx-5 -mt-5 mb-4 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-violet-500 via-violet-400 to-purple-400 dark:from-violet-600 dark:via-violet-500 dark:to-purple-500 border-b border-violet-600 dark:border-violet-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <ClipboardList className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Enrollment Type</span>
            </h3>
          </div>
          {enrollmentTypeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={enrollmentTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {enrollmentTypeData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 -mt-2">
                {enrollmentTypeData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{d.name}</span>
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">No data</div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ Charts Row 2: Section Capacity Bar + Gender Donut ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between -mx-5 -mt-5 mb-5 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-sky-400 dark:from-cyan-600 dark:via-cyan-500 dark:to-sky-500 border-b border-cyan-600 dark:border-cyan-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <Building className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Section Capacity</span>
            </h3>
            <button onClick={() => navigate('/sections')} className="text-xs text-white/80 hover:text-white hover:underline font-medium flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {sectionStats.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sectionStats} layout="vertical" barSize={16}>
                  <defs>
                    <linearGradient id="gradCap" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={isDark ? '#22d3ee' : '#06b6d4'} stopOpacity={1} />
                      <stop offset="100%" stopColor={isDark ? '#60a5fa' : '#3b82f6'} stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} horizontal={false} />
                  <XAxis type="number" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 5']} />
                  <YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="glass-card !p-3 !rounded-xl text-sm border border-white/10 shadow-xl">
                        <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">{d.name}</p>
                        <p className="text-xs text-gray-500">{d.students}/{d.capacity} students ({d.pct}%)</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="students" name="Students" fill="url(#gradCap)" radius={[0, 8, 8, 0]} background={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: [0, 8, 8, 0] }} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 pt-3 border-t border-gray-200 dark:border-white/10 text-[10px] text-gray-400">
                <span>Overall: <strong className="text-gray-600 dark:text-gray-300">{stats.totalOccupied}/{stats.totalCapacity}</strong> ({stats.sectionCapacity}%)</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-gray-400">
              <Layers className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No sections created yet</p>
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="-mx-5 -mt-5 mb-4 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-pink-500 via-pink-400 to-rose-400 dark:from-pink-600 dark:via-pink-500 dark:to-rose-500 border-b border-pink-600 dark:border-pink-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Gender Distribution</span>
            </h3>
          </div>
          {(stats.maleCount > 0 || stats.femaleCount > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value" strokeWidth={0}>
                    {genderData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-8 -mt-2">
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center mb-0.5">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Male</span>
                  </div>
                  <AnimatedCounter value={stats.maleCount} className="text-xl font-extrabold text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1.5 justify-center mb-0.5">
                    <span className="w-3 h-3 rounded-full bg-pink-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Female</span>
                  </div>
                  <AnimatedCounter value={stats.femaleCount} className="text-xl font-extrabold text-pink-600 dark:text-pink-400" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">No gender data</div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ Recent Enrollments ═══ */}
      <motion.div variants={fadeUp}>
        <GlassCard className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-500 via-emerald-400 to-green-400 dark:from-emerald-600 dark:via-emerald-500 dark:to-green-500 border-b border-emerald-600 dark:border-emerald-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <ClipboardList className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Recent Enrollments</span>
            </h3>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/enrollment/new')} className="text-xs bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 hover:shadow-lg transition-shadow">
                <UserPlus className="w-3 h-3" /> New
              </button>
              <button onClick={() => navigate('/enrollment')} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700/50">
            {recentEnrollments.map((enr, i) => {
              const name = enr.students ? `${enr.students.last_name}, ${enr.students.first_name}` : 'Unknown Student';
              const initials = enr.students ? `${enr.students.first_name?.[0] || ''}${enr.students.last_name?.[0] || ''}` : '?';
              const avatarColors = ['from-teal-500 to-cyan-400', 'from-blue-500 to-indigo-400', 'from-violet-500 to-purple-400', 'from-emerald-500 to-green-400', 'from-amber-500 to-orange-400', 'from-pink-500 to-rose-400', 'from-sky-500 to-blue-400', 'from-lime-500 to-green-400'];
              return (
                <motion.div
                  key={enr.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors cursor-pointer group"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/enrollment/${enr.id}`)}
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-[11px] font-bold text-white shadow-sm flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      LRN: {enr.students?.lrn || 'N/A'} · {enr.grade_levels?.name}{enr.sections?.name ? ` · ${enr.sections.name}` : ''}
                    </p>
                  </div>
                  <AnimatedBadge variant={statusColors[enr.status] || 'neutral'} size="xs">{enr.status}</AnimatedBadge>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeColors[enr.enrollment_type] || typeColors.new}`}>
                    {enr.enrollment_type?.replace('_', ' ') || 'new'}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:block">
                    {new Date(enr.enrollment_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
                </motion.div>
              );
            })}
            {recentEnrollments.length === 0 && (
              <div className="px-5 py-10 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No enrollments yet this school year</p>
                <button onClick={() => navigate('/enrollment/new')}
                  className="mt-3 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-shadow inline-flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" /> Create First Enrollment
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/25">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Enrollment', icon: UserPlus, path: '/enrollment/new', color: 'from-emerald-500 to-teal-400', shadow: 'shadow-emerald-500/20' },
            { label: 'Records Office', icon: FileSearch, path: '/portal/registrar/records', color: 'from-slate-600 to-slate-400', shadow: 'shadow-slate-500/20' },
            { label: 'Students', icon: Users, path: '/students', color: 'from-blue-500 to-cyan-400', shadow: 'shadow-blue-500/20' },
            { label: 'Sections', icon: Layers, path: '/sections', color: 'from-violet-500 to-purple-400', shadow: 'shadow-violet-500/20' },
            { label: 'Grade Levels', icon: Target, path: '/grade-levels', color: 'from-amber-500 to-orange-400', shadow: 'shadow-amber-500/20' },
            { label: 'Subjects', icon: BookOpen, path: '/subjects', color: 'from-pink-500 to-rose-400', shadow: 'shadow-pink-500/20' },
            { label: 'Schedule', icon: Calendar, path: '/schedule', color: 'from-cyan-500 to-sky-400', shadow: 'shadow-cyan-500/20' },
            { label: 'Grade Reports', icon: BarChart3, path: '/grades/reports', color: 'from-orange-500 to-red-400', shadow: 'shadow-orange-500/20' },
            { label: 'Promotions', icon: GraduationCap, path: '/school-years/promotions', color: 'from-indigo-500 to-blue-400', shadow: 'shadow-indigo-500/20' },
            { label: 'School Years', icon: Settings, path: '/school-years', color: 'from-slate-500 to-gray-400', shadow: 'shadow-slate-500/20' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              className="glass-card glass-card-hover !p-4 flex items-center gap-3 group"
              onClick={() => navigate(action.path)}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.04 }}
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg ${action.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{action.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
