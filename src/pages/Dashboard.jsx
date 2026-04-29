import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar
} from 'recharts'
import {
  Users, GraduationCap, BookOpen, ClipboardList, TrendingUp, TrendingDown,
  Calendar, DollarSign, AlertTriangle, Brain, Sparkles, ArrowRight,
  CheckCircle, Clock, UserCheck, Activity, Zap, Target, Award, BarChart3,
  ArrowUpRight, Shield, Bell, Percent, PieChart as PieIcon
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { GlassCard, AnimatedCounter, SkeletonDashboard, AnimatedBadge } from '../components/ui'

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}
const stagger = {
  animate: { transition: { staggerChildren: 0.08 } }
}

const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16']
const darkChartColors = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f472b6', '#fb923c', '#2dd4bf', '#818cf8', '#a3e635']

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const { user, role } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    students: 0, teachers: 0, sections: 0, enrollments: 0,
    maleCount: 0, femaleCount: 0, enrolledCount: 0, pendingCount: 0, droppedCount: 0,
  })
  const [enrollmentByGrade, setEnrollmentByGrade] = useState([])
  const [attendanceTrend, setAttendanceTrend] = useState([])
  const [recentEnrollments, setRecentEnrollments] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [aiInsights, setAiInsights] = useState([])

  useEffect(() => { fetchDashboardData() }, [])

  const fetchDashboardData = async () => {
    try {
      const [
        { count: studentCount },
        { count: teacherCount },
        { count: sectionCount },
        { count: enrollmentCount },
        { data: students },
        { data: enrollments },
        { data: attendanceData },
        { data: announcementData },
        { data: gradeData },
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('teacher_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('sections').select('*', { count: 'exact', head: true }),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('gender'),
        supabase.from('enrollments').select('*, grade_levels(name), students(first_name, last_name, lrn)').order('created_at', { ascending: false }).limit(10),
        supabase.from('attendance').select('status, date').order('date', { ascending: false }).limit(500),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('quarterly_grades').select('grade, subject_id'),
      ])

      const maleCount = students?.filter(s => s.gender === 'Male').length || 0
      const femaleCount = students?.filter(s => s.gender === 'Female').length || 0

      const enrolledCount = enrollments?.filter(e => e.status === 'enrolled').length || 0
      const pendingCount = enrollments?.filter(e => e.status === 'pending').length || 0
      const droppedCount = enrollments?.filter(e => e.status === 'dropped').length || 0

      const gradeMap = {}
      enrollments?.forEach(e => {
        const name = e.grade_levels?.name || 'Unknown'
        gradeMap[name] = (gradeMap[name] || 0) + 1
      })
      const enrollByGrade = Object.entries(gradeMap).map(([name, count]) => ({ name: name.replace('Grade ', 'G'), count }))

      const dateMap = {}
      attendanceData?.forEach(a => {
        if (!dateMap[a.date]) dateMap[a.date] = { present: 0, absent: 0, late: 0 }
        if (a.status === 'present') dateMap[a.date].present++
        else if (a.status === 'absent') dateMap[a.date].absent++
        else if (a.status === 'late') dateMap[a.date].late++
      })
      const trend = Object.entries(dateMap).slice(0, 7).reverse().map(([date, d]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Present: d.present, Absent: d.absent, Late: d.late,
      }))

      const insights = []
      const avgGrade = gradeData?.length ? gradeData.reduce((sum, g) => sum + (g.grade || 0), 0) / gradeData.length : 0
      if (avgGrade > 0 && avgGrade < 80) {
        insights.push({ type: 'warning', icon: AlertTriangle, title: 'Grade Alert', message: `Average grade is ${avgGrade.toFixed(1)}% — below 80% target. Consider remedial programs.` })
      } else if (avgGrade >= 80) {
        insights.push({ type: 'success', icon: Award, title: 'Strong Performance', message: `Average grade is ${avgGrade.toFixed(1)}% — above target! Students are performing well.` })
      }
      const absentRate = attendanceData?.length ? (attendanceData.filter(a => a.status === 'absent').length / attendanceData.length * 100) : 0
      if (absentRate > 15) {
        insights.push({ type: 'danger', icon: AlertTriangle, title: 'Attendance Concern', message: `${absentRate.toFixed(1)}% absence rate detected. Follow up with frequently absent students.` })
      } else {
        insights.push({ type: 'success', icon: CheckCircle, title: 'Good Attendance', message: `Only ${absentRate.toFixed(1)}% absence rate. Attendance tracking is healthy.` })
      }
      insights.push({ type: 'info', icon: Brain, title: 'AI Recommendation', message: `With ${studentCount || 0} students across ${sectionCount || 0} sections, optimal class size ratio is ${sectionCount ? Math.round((studentCount || 0) / sectionCount) : 0} students/section.` })

      setStats({ students: studentCount || 0, teachers: teacherCount || 0, sections: sectionCount || 0, enrollments: enrollmentCount || 0, maleCount, femaleCount, enrolledCount, pendingCount, droppedCount })
      setEnrollmentByGrade(enrollByGrade)
      setAttendanceTrend(trend)
      setRecentEnrollments(enrollments?.slice(0, 5) || [])
      setAnnouncements(announcementData || [])
      setAiInsights(insights)
    } catch (error) { console.error('Dashboard error:', error) } finally { setLoading(false) }
  }

  const genderData = useMemo(() => [
    { name: 'Male', value: stats.maleCount },
    { name: 'Female', value: stats.femaleCount },
  ], [stats])

  const statusData = useMemo(() => [
    { name: 'Enrolled', value: stats.enrolledCount, color: '#10b981' },
    { name: 'Pending', value: stats.pendingCount, color: '#f59e0b' },
    { name: 'Dropped', value: stats.droppedCount, color: '#ef4444' },
  ].filter(d => d.value > 0), [stats])

  const colors = isDark ? darkChartColors : chartColors
  if (loading) return <SkeletonDashboard />

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: GraduationCap, color: 'from-blue-600 to-blue-400', shadow: 'shadow-blue-500/25', glow: 'hover:shadow-neon-blue', trend: '+12%', trendUp: true },
    { label: 'Teachers', value: stats.teachers, icon: UserCheck, color: 'from-emerald-600 to-emerald-400', shadow: 'shadow-emerald-500/25', glow: 'hover:shadow-neon-green', trend: '+3', trendUp: true },
    { label: 'Sections', value: stats.sections, icon: BookOpen, color: 'from-amber-600 to-amber-400', shadow: 'shadow-amber-500/25', glow: 'hover:shadow-neon-amber', trend: 'Active', trendUp: true },
    { label: 'Enrollments', value: stats.enrollments, icon: ClipboardList, color: 'from-purple-600 to-purple-400', shadow: 'shadow-purple-500/25', glow: 'hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]', trend: 'SY 2025–2026', trendUp: true },
  ]

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="glass-card !p-3 !rounded-xl text-sm border border-white/10 dark:border-white/5 shadow-xl">
        <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500 dark:text-gray-400">{p.name}:</span>
            <span className="font-bold text-gray-800 dark:text-gray-100">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Admin'

  return (
    <motion.div className="space-y-6" variants={stagger} initial="initial" animate="animate">
      {/* ═══ Welcome Banner ═══ */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-500 p-6 md:p-8 text-white">
        {/* Decorative orbs */}
        <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/5 rounded-full blur-xl" />
        <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-amber-400/10 rounded-full blur-lg" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <AnimatedBadge variant="purple" size="xs" dot pulse>
              <Sparkles className="w-3 h-3" /> AI-Powered
            </AnimatedBadge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{getGreeting()}, {firstName} 👋</h1>
          <p className="text-primary-200 text-sm mb-5">Here&apos;s what&apos;s happening at your school today</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Students', val: stats.students, icon: GraduationCap },
              { label: 'Teachers', val: stats.teachers, icon: UserCheck },
              { label: 'Sections', val: stats.sections, icon: BookOpen },
              { label: 'Enrolled', val: stats.enrolledCount, icon: CheckCircle },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5">
                <m.icon className="w-4 h-4 text-primary-200 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold leading-tight">{m.val.toLocaleString()}</p>
                  <p className="text-[10px] text-primary-200 font-medium">{m.label}</p>
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
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg ${card.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="w-5.5 h-5.5 text-white" />
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${card.trendUp ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400'}`}>
                {card.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {card.trend}
              </div>
            </div>
            <AnimatedCounter value={card.value} className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{card.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ AI Insights ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/25">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">AI Insights</h2>
          <AnimatedBadge variant="purple" size="xs" dot pulse>Live</AnimatedBadge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiInsights.map((insight, i) => {
            const colorMap = {
              success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200/60 dark:border-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15' },
              warning: { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200/60 dark:border-amber-500/20', icon: 'text-white/80 hover:text-white', iconBg: 'bg-amber-100 dark:bg-amber-500/15' },
              danger: { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200/60 dark:border-red-500/20', icon: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-500/15' },
              info: { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200/60 dark:border-blue-500/20', icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-500/15' },
            }
            const c = colorMap[insight.type] || colorMap.info
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
            )
          })}
        </div>
      </motion.div>

      {/* ═══ Charts Row 1: Enrollment by Grade + Gender ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between -mx-5 -mt-5 mb-5 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300 dark:from-blue-600 dark:via-blue-500 dark:to-blue-400 border-b border-blue-600 dark:border-blue-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Enrollment by Grade Level</span>
            </h3>
            <button onClick={() => navigate('/enrollment')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={enrollmentByGrade} barSize={28}>
              <defs>
                {enrollmentByGrade.map((_, i) => (
                  <linearGradient key={i} id={`barGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={1} />
                    <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="count" name="Students" radius={[8, 8, 0, 0]}>
                {enrollmentByGrade.map((_, i) => (<Cell key={i} fill={`url(#barGrad${i})`} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <div className="-mx-5 -mt-5 mb-4 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-pink-500 via-pink-400 to-pink-300 dark:from-pink-600 dark:via-pink-500 dark:to-pink-400 border-b border-pink-600 dark:border-pink-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Gender Distribution</span>
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value" strokeWidth={0}>
                <Cell fill={isDark ? '#60a5fa' : '#3b82f6'} />
                <Cell fill={isDark ? '#f472b6' : '#ec4899'} />
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
        </GlassCard>
      </motion.div>

      {/* ═══ Charts Row 2: Attendance Trend + Enrollment Status ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <div className="-mx-5 -mt-5 mb-5 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 dark:from-emerald-600 dark:via-emerald-500 dark:to-emerald-400 border-b border-emerald-600 dark:border-emerald-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Attendance Trend (7 Days)</span>
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={attendanceTrend}>
              <defs>
                <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
              <XAxis dataKey="date" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Present" stroke="#10b981" fill="url(#gradPresent)" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Absent" stroke="#ef4444" fill="url(#gradAbsent)" strokeWidth={2.5} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Late" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              <Legend formatter={(v) => <span className="text-xs font-medium">{v}</span>} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <div className="-mx-5 -mt-5 mb-4 px-5 py-3.5 rounded-t-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 dark:from-amber-600 dark:via-amber-500 dark:to-amber-400 border-b border-amber-600 dark:border-amber-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                <PieIcon className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Enrollment Status</span>
            </h3>
          </div>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {statusData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-5 -mt-2">
                {statusData.map((d) => (
                  <div key={d.name} className="text-center">
                    <div className="flex items-center gap-1.5 justify-center mb-0.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">{d.name}</span>
                    </div>
                    <AnimatedCounter value={d.value} className="text-lg font-extrabold text-gray-900 dark:text-white" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">No enrollment data</div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ Recent Enrollments + Announcements ═══ */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-500 via-indigo-400 to-indigo-300 dark:from-indigo-600 dark:via-indigo-500 dark:to-indigo-400 border-b border-indigo-600 dark:border-indigo-700">
            <h3 className="font-bold text-sm flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-500/25">
                <ClipboardList className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-gray-800 dark:text-white">Recent Enrollments</span>
            </h3>
            <button onClick={() => navigate('/enrollment')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-dark-700/50">
            {recentEnrollments.slice(0, 5).map((e, i) => {
              const name = e.students ? `${e.students.last_name}, ${e.students.first_name}` : `Student #${e.student_id?.slice(0, 8)}`
              const initials = e.students ? `${e.students.first_name?.[0] || ''}${e.students.last_name?.[0] || ''}` : '?'
              const avatarColors = ['from-blue-500 to-cyan-400', 'from-violet-500 to-purple-400', 'from-emerald-500 to-teal-400', 'from-amber-500 to-orange-400', 'from-pink-500 to-rose-400']
              return (
                <motion.div
                  key={e.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors cursor-pointer"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/enrollment/${e.id}`)}
                >
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-[11px] font-bold text-white shadow-sm flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                    <p className="text-[10px] text-gray-400">{e.grade_levels?.name || 'N/A'} · {new Date(e.created_at).toLocaleDateString()}</p>
                  </div>
                  <AnimatedBadge variant={e.status === 'enrolled' ? 'success' : e.status === 'pending' ? 'warning' : 'neutral'} size="xs">{e.status}</AnimatedBadge>
                </motion.div>
              )
            })}
            {recentEnrollments.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No recent enrollments</div>
            )}
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300 dark:from-orange-600 dark:via-orange-500 dark:to-orange-400 border-b border-orange-600 dark:border-orange-700">
              <h3 className="font-bold text-sm flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-500/25">
                  <Bell className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-gray-800 dark:text-white">Announcements</span>
              </h3>
              <button onClick={() => navigate('/announcements')} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-dark-700/50">
              {announcements.slice(0, 4).map((a, i) => (
                <motion.div
                  key={a.id}
                  className="px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors cursor-pointer"
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </motion.div>
              ))}
              {announcements.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">No announcements yet</div>
              )}
            </div>
          </GlassCard>
        </div>
      </motion.div>

      {/* ═══ Quick Actions ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Enrollment', icon: ClipboardList, path: '/enrollment/new', color: 'from-blue-500 to-blue-400', shadow: 'shadow-blue-500/20' },
            { label: 'Grade Entry', icon: BarChart3, path: '/grades/entry', color: 'from-emerald-500 to-emerald-400', shadow: 'shadow-emerald-500/20' },
            { label: 'Attendance', icon: Calendar, path: '/attendance', color: 'from-amber-500 to-amber-400', shadow: 'shadow-amber-500/20' },
            { label: 'Payments', icon: DollarSign, path: '/payments', color: 'from-purple-500 to-purple-400', shadow: 'shadow-purple-500/20' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              className="glass-card glass-card-hover !p-4 flex items-center gap-3 group"
              onClick={() => navigate(action.path)}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.05 }}
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
  )
}
