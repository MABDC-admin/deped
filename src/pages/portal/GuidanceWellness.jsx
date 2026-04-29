import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Users, AlertTriangle, Brain, Shield, TrendingUp, Activity, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';

export default function GuidanceWellness() {
  const [stats, setStats] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [behavioral, counseling, students] = await Promise.all([
        supabase.from('behavioral_incidents').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('counseling_records').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('students').select('id', { count: 'exact', head: true }),
      ]);

      const incidents = behavioral.data || [];
      const sessions = counseling.data || [];
      const criticalCount = incidents.filter(i => i.severity === 'major' || i.severity === 'critical').length;
      const activeSessionCount = sessions.filter(s => s.status === 'ongoing' || s.status === 'scheduled').length;

      setStats({
        totalStudents: students.count || 0,
        totalIncidents: incidents.length,
        criticalIncidents: criticalCount,
        activeSessions: activeSessionCount,
        resolvedCases: sessions.filter(s => s.status === 'completed' || s.status === 'resolved').length,
      });

      setRecentCases([...incidents.slice(0, 5).map(i => ({ ...i, type: 'behavioral' })), ...sessions.slice(0, 5).map(s => ({ ...s, type: 'counseling' }))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SkeletonDashboard />;

  const wellnessCards = [
    { label: 'Students Monitored', value: stats.totalStudents, icon: Users, color: 'from-pink-500 to-rose-500' },
    { label: 'Active Sessions', value: stats.activeSessions, icon: Brain, color: 'from-violet-500 to-purple-500' },
    { label: 'Behavioral Incidents', value: stats.totalIncidents, icon: AlertTriangle, color: 'from-amber-500 to-orange-500' },
    { label: 'Resolved Cases', value: stats.resolvedCases, icon: Shield, color: 'from-green-500 to-emerald-500' },
  ];

  const severityColor = { minor: 'text-blue-500', moderate: 'text-amber-500', major: 'text-orange-500', critical: 'text-red-500' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Heart className="w-7 h-7 text-pink-500" /> Student Wellness Center
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor student welfare, behavioral patterns, and counseling progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {wellnessCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* At-Risk Alert */}
      {stats.criticalIncidents > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <GlassCard className="p-5 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 animate-pulse" />
              <div>
                <h3 className="font-bold text-red-600 dark:text-red-400">Attention Required</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{stats.criticalIncidents} critical/major behavioral incidents need review</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Recent Activity */}
      <GlassCard className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-pink-500" /> Recent Activity
        </h2>
        <div className="space-y-3">
          {recentCases.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'behavioral' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-violet-100 dark:bg-violet-900/30'}`}>
                {item.type === 'behavioral' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <Brain className="w-5 h-5 text-violet-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.type === 'behavioral' ? (item.incident_type || 'Incident') : (item.reason || 'Session')}
                </p>
                <p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
              </div>
              {item.severity && <span className={`text-xs font-medium capitalize ${severityColor[item.severity] || 'text-gray-500'}`}>{item.severity}</span>}
              <Eye className="w-4 h-4 text-gray-400" />
            </motion.div>
          ))}
          {recentCases.length === 0 && <p className="text-center text-gray-400 py-8">No recent activity</p>}
        </div>
      </GlassCard>
    </div>
  );
}
