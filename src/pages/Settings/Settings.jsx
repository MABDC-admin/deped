import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import GlassCard from '../../components/ui/GlassCard';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import AnimatedTabs from '../../components/ui/AnimatedTabs';

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [schoolInfo, setSchoolInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, schoolRes] = await Promise.all([
        supabase.from('system_settings').select('*'),
        supabase.from('school_info').select('*').limit(1).single(),
      ]);
      const settingsMap = {};
      (settingsRes.data || []).forEach(s => { settingsMap[s.key] = s.value; });
      setSettings(settingsMap);
      setSchoolInfo(schoolRes.data || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'school', label: 'School Info', icon: '🏫' },
    { id: 'academic', label: 'Academic', icon: '📚' },
    { id: 'system', label: 'System', icon: '🔧' },
  ];

  if (loading) return <div className="space-y-6"><SkeletonLoader type="dashboard" /></div>;

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800/50 dark:to-blue-900/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-600 to-blue-600 flex items-center justify-center text-2xl text-white">⚙️</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Settings</h2>
            <p className="text-sm text-gray-500">Configure your school management system</p>
          </div>
        </div>
      </GlassCard>

      <AnimatedTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">General Settings</h3>
            <div className="space-y-4">
              {Object.entries(settings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{key}</p>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300 font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">{value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {activeTab === 'school' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">School Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(schoolInfo).filter(([key]) => !['id', 'created_at', 'updated_at'].includes(key)).map(([key, value]) => (
                <div key={key} className="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="text-xs text-gray-400 mb-1">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{value || '—'}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {activeTab === 'academic' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic Configuration</h3>
            <div className="space-y-4">
              {[
                { label: 'Grading System', value: 'DepEd MATATAG K-12', icon: '📊' },
                { label: 'Passing Grade', value: '75%', icon: '✅' },
                { label: 'Quarters', value: '4 Quarters per School Year', icon: '📅' },
                { label: 'Transmutation', value: '41-row DepEd Transmutation Table', icon: '🔄' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {activeTab === 'system' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Information</h3>
            <div className="space-y-3">
              {[
                { label: 'Application', value: 'DepEd SMS v2.0', icon: '🏫' },
                { label: 'Stack', value: 'React 18 + Vite + Supabase', icon: '⚛️' },
                { label: 'Database', value: 'PostgreSQL 15 (via Supabase)', icon: '🗄️' },
                { label: 'Server', value: 'Ubuntu + Nginx + Docker', icon: '🐧' },
                { label: 'AI Engine', value: 'Built-in Analytics (Risk Scoring, Anomaly Detection)', icon: '🧠' },
                { label: 'Theme', value: 'Glassmorphism + Dark Mode', icon: '🎨' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
};

export default Settings;
