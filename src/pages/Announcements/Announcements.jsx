import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const PRIORITY_CONFIG = {
  high: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '🔴' },
  medium: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: '🟡' },
  low: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '🔵' },
  normal: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: '⚪' },
};

const TYPE_ICONS = { general: '📢', academic: '📚', event: '🎉', emergency: '🚨', reminder: '⏰', announcement: '📣' };

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      setAnnouncements(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const types = [...new Set(announcements.map(a => a.type).filter(Boolean))];
  const filtered = useMemo(() => {
    return announcements.filter(a => {
      const matchSearch = (a.title || '').toLowerCase().includes(search.toLowerCase()) || (a.content || '').toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || a.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [announcements, search, typeFilter]);

  if (loading) return <div className="space-y-6"><SkeletonLoader type="card" count={3} /></div>;

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-2xl text-white">📢</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Announcements</h2>
            <p className="text-sm text-gray-500">{announcements.length} announcements • Keep everyone informed</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full sm:max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 outline-none text-sm">
            <option value="all">All Types</option>
            {types.map(t => <option key={t} value={t}>{TYPE_ICONS[t] || '📋'} {t}</option>)}
          </select>
        </div>
      </GlassCard>

      {filtered.length === 0 ? (
        <EmptyState title="No announcements" description="No announcements found matching your criteria" />
      ) : (
        <div className="space-y-4">
          {filtered.map((ann, i) => {
            const priority = PRIORITY_CONFIG[ann.priority] || PRIORITY_CONFIG.normal;
            const typeIcon = TYPE_ICONS[ann.type] || '📋';
            return (
              <motion.div key={ann.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.5) }}>
                <GlassCard hover className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeIcon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{ann.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {ann.type && <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500 capitalize">{ann.type}</span>}
                          {ann.priority && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color}`}>{priority.icon} {ann.priority}</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">{ann.content}</p>
                  {ann.target_audience && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-gray-400">Audience:</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 capitalize">{ann.target_audience}</span>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Announcements;
