import { useState } from 'react';
import { motion } from 'framer-motion';
import GlassCard from '../../components/ui/GlassCard';

const REPORTS = [
  { id: 'sf9', name: 'School Form 9 (SF9)', desc: 'Report Card / Learner Progress Report Card', icon: '📋', category: 'DepEd Forms', status: 'coming_soon' },
  { id: 'sf10', name: 'School Form 10 (SF10)', desc: "Learner's Permanent Academic Record", icon: '📜', category: 'DepEd Forms', status: 'coming_soon' },
  { id: 'sf2', name: 'School Form 2 (SF2)', desc: 'Daily Attendance Report of Learners', icon: '📅', category: 'DepEd Forms', status: 'coming_soon' },
  { id: 'sf5', name: 'School Form 5 (SF5)', desc: 'Report on Promotion and Level of Proficiency', icon: '📊', category: 'DepEd Forms', status: 'coming_soon' },
  { id: 'enrollment', name: 'Enrollment Summary', desc: 'Student enrollment statistics by grade level', icon: '👨‍🎓', category: 'Analytics', status: 'available' },
  { id: 'attendance', name: 'Attendance Report', desc: 'Daily/weekly/monthly attendance analytics', icon: '📊', category: 'Analytics', status: 'available' },
  { id: 'grades', name: 'Grade Summary', desc: 'Class performance and grade distribution', icon: '📈', category: 'Analytics', status: 'available' },
  { id: 'financial', name: 'Financial Report', desc: 'Collection summary and outstanding balances', icon: '💰', category: 'Finance', status: 'available' },
  { id: 'behavioral', name: 'Behavioral Report', desc: 'Incident summary and trend analysis', icon: '📝', category: 'Student Services', status: 'available' },
  { id: 'at_risk', name: 'At-Risk Students', desc: 'AI-powered student risk assessment report', icon: '🧠', category: 'AI Reports', status: 'available' },
];

const Reports = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const categories = ['all', ...new Set(REPORTS.map(r => r.category))];

  const filtered = selectedCategory === 'all' ? REPORTS : REPORTS.filter(r => r.category === selectedCategory);

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/10 dark:to-cyan-900/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-2xl text-white">📊</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Reports Center</h2>
            <p className="text-sm text-gray-500">Generate DepEd forms, analytics, and AI-powered reports</p>
          </div>
        </div>
      </GlassCard>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}>
            {cat === 'all' ? '📋 All Reports' : cat}
          </button>
        ))}
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((report, i) => (
          <motion.div key={report.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <GlassCard hover className="p-5 h-full flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{report.icon}</span>
                {report.status === 'coming_soon' ? (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Coming Soon</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Available</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{report.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-1">{report.desc}</p>
              <div className="mt-4">
                <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">{report.category}</span>
              </div>
              {report.status === 'available' && (
                <button className="mt-3 w-full px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:shadow-lg transition-all hover:scale-[1.02]">
                  Generate Report
                </button>
              )}
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Reports;
