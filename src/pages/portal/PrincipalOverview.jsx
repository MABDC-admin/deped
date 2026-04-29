import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { School, Users, GraduationCap, TrendingUp, CheckCircle2, AlertTriangle, DollarSign, BarChart3, Award, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import AnimatedCounter from '../../components/ui/AnimatedCounter';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';

export default function PrincipalOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const [students, teachers, sections, attendance, payments, behavioral] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('teacher_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('sections').select('id', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('status').limit(500),
        supabase.from('payments').select('amount'),
        supabase.from('behavioral_incidents').select('severity').limit(100),
      ]);

      const totalAttendance = attendance.data?.length || 0;
      const presentCount = attendance.data?.filter(a => a.status === 'present' || a.status === 'PRESENT').length || 0;
      const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
      const totalRevenue = payments.data?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
      const criticalIncidents = behavioral.data?.filter(b => b.severity === 'major' || b.severity === 'critical').length || 0;

      setStats({
        students: students.count || 0,
        teachers: teachers.count || 0,
        sections: sections.count || 0,
        attendanceRate,
        totalRevenue,
        criticalIncidents,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SkeletonDashboard />;

  const kpis = [
    { label: 'Total Students', value: stats.students, icon: Users, color: 'from-blue-500 to-cyan-500', trend: '+12%', up: true },
    { label: 'Teachers', value: stats.teachers, icon: GraduationCap, color: 'from-violet-500 to-purple-500', trend: 'Full', up: true },
    { label: 'Sections', value: stats.sections, icon: School, color: 'from-amber-500 to-orange-500', trend: 'Active', up: true },
    { label: 'Attendance Rate', value: `${stats.attendanceRate}%`, icon: CheckCircle2, color: 'from-green-500 to-emerald-500', trend: stats.attendanceRate > 85 ? 'Good' : 'Low', up: stats.attendanceRate > 85 },
    { label: 'Revenue', value: `₱${(stats.totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, color: 'from-emerald-500 to-teal-500', trend: '+8%', up: true },
    { label: 'Critical Incidents', value: stats.criticalIncidents, icon: AlertTriangle, color: 'from-red-500 to-rose-500', trend: stats.criticalIncidents > 5 ? 'High' : 'Normal', up: stats.criticalIncidents <= 5 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <School className="w-7 h-7 text-amber-500" /> School Command Center
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time overview of school operations</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <GlassCard className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{kpi.value}</p>
                  <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${kpi.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {kpi.trend}
                  </div>
                </div>
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${kpi.color} flex items-center justify-center shadow-lg`}>
                  <kpi.icon className="w-7 h-7 text-white" />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'View Reports', icon: BarChart3, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
            { label: 'Attendance Today', icon: CheckCircle2, color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
            { label: 'Grade Status', icon: TrendingUp, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
            { label: 'Incidents', icon: AlertTriangle, color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' },
          ].map((action) => (
            <button key={action.label} className={`p-4 rounded-xl ${action.color} flex flex-col items-center gap-2 hover:scale-105 transition-transform`}>
              <action.icon className="w-6 h-6" />
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
