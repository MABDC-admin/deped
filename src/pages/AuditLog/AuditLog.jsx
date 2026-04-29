import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const ACTION_CONFIG = {
  create: { icon: '➕', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', ring: 'ring-emerald-400' },
  update: { icon: '✏️', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', ring: 'ring-blue-400' },
  delete: { icon: '🗑️', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', ring: 'ring-red-400' },
  login: { icon: '🔑', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', ring: 'ring-purple-400' },
  logout: { icon: '🚪', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', ring: 'ring-gray-400' },
  export: { icon: '📤', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', ring: 'ring-amber-400' },
  import: { icon: '📥', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', ring: 'ring-cyan-400' },
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('audit_logs').select('*, user_profiles(first_name, last_name, email)').order('created_at', { ascending: false }).limit(500);
      setLogs(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.table_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.description || '').toLowerCase().includes(search.toLowerCase()) ||
        `${l.user_profiles?.first_name || ''} ${l.user_profiles?.last_name || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === 'all' || l.action === actionFilter;
      const logDate = l.created_at?.split('T')[0];
      const matchFrom = !dateRange.from || logDate >= dateRange.from;
      const matchTo = !dateRange.to || logDate <= dateRange.to;
      return matchSearch && matchAction && matchFrom && matchTo;
    });
  }, [logs, search, actionFilter, dateRange]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(log => {
      const date = log.created_at ? new Date(log.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups);
  }, [filtered]);

  const actions = [...new Set(logs.map(l => l.action).filter(Boolean))];

  if (loading) return <div className="space-y-6"><SkeletonLoader type="dashboard" /><SkeletonLoader type="table" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-2xl">📜</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Audit Log</h2>
            <p className="text-sm text-gray-500">{logs.length} total events • Read-only system log</p>
          </div>
        </div>
      </GlassCard>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full lg:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
              <option value="all">All Actions</option>
              {actions.map(a => <option key={a} value={a}>{(ACTION_CONFIG[a]?.icon || '📋')} {a}</option>)}
            </select>
            <input type="date" value={dateRange.from} onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="From" />
            <input type="date" value={dateRange.to} onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm" placeholder="To" />
          </div>
        </div>
      </GlassCard>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <EmptyState title="No audit logs found" description="No events match your filters" />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, dayLogs], gi) => (
            <motion.div key={date} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.1 }}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{date}</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">{dayLogs.length} events</span>
              </div>

              <div className="relative ml-6">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                <div className="space-y-2">
                  {dayLogs.map((log, i) => {
                    const action = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="relative pl-8"
                      >
                        <div className={`absolute left-[-6px] top-3 w-3 h-3 rounded-full ${action.color} ring-2 ring-white dark:ring-gray-900`} />
                        <div className="p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${action.color}`}>{action.icon} {log.action}</span>
                              {log.table_name && <span className="text-xs text-gray-400 font-mono">{log.table_name}</span>}
                            </div>
                            <span className="text-xs text-gray-400">{log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}</span>
                          </div>
                          {log.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{log.description}</p>}
                          {log.user_profiles && (
                            <p className="text-xs text-gray-400 mt-1">by {log.user_profiles.first_name} {log.user_profiles.last_name}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLog;
