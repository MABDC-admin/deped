import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, FileText, Download, ChevronRight, ChevronDown, ChevronUp,
  Users, GraduationCap, ClipboardList, CheckCircle2, Clock, AlertCircle,
  UserPlus, BookOpen, Calendar, Layers, Award, Shield, Printer,
  ArrowUpRight, ArrowRight, Eye, Edit3, Trash2, MoreHorizontal,
  TrendingUp, BarChart3, RefreshCw, X, Check, AlertTriangle,
  FileCheck, FilePlus, FileSearch, Folder, FolderOpen, Archive,
  Mail, Phone, MapPin, Hash, User, ChevronLeft
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GlassCard, AnimatedCounter, AnimatedBadge } from '../../components/ui';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const STATUS_CONFIG = {
  enrolled: { color: 'emerald', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  pending: { color: 'amber', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  dropped: { color: 'red', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
};

const DOCUMENT_TYPES = [
  { id: 'form137', name: 'Form 137', desc: 'Permanent Record / SF10', icon: FileText, color: 'blue' },
  { id: 'form138', name: 'Form 138', desc: 'Report Card / SF9', icon: FileCheck, color: 'emerald' },
  { id: 'goodmoral', name: 'Good Moral Certificate', desc: 'Character certificate', icon: Award, color: 'violet' },
  { id: 'enrollment', name: 'Enrollment Certificate', desc: 'Proof of enrollment', icon: ClipboardList, color: 'teal' },
  { id: 'transfer', name: 'Transfer Credentials', desc: 'For school transfers', icon: ArrowRight, color: 'orange' },
  { id: 'diploma', name: 'Diploma', desc: 'Completion certificate', icon: GraduationCap, color: 'pink' },
];

export default function RegistrarRecords() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Data states
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDocPanel, setShowDocPanel] = useState(false);
  const itemsPerPage = 15;

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0, enrolledCount: 0, pendingCount: 0, droppedCount: 0,
    withSection: 0, withoutSection: 0, maleCount: 0, femaleCount: 0,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: yearData } = await supabase
        .from('school_years')
        .select('id, year_name')
        .eq('is_current', true)
        .single();

      const yearId = yearData?.id;
      setActiveYear(yearData);

      const [enrollRes, glRes, secRes] = await Promise.all([
        supabase.from('enrollments')
          .select('id, status, enrollment_date, enrollment_type, grade_level_id, section_id, student_id, students(id, first_name, last_name, lrn, gender, birth_date, address, contact_number, email), grade_levels(id, name, level_order), sections(id, name)')
          .eq('school_year_id', yearId)
          .order('enrollment_date', { ascending: false }),
        supabase.from('grade_levels')
          .select('id, name, level_order, category')
          .eq('is_active', true)
          .order('level_order'),
        supabase.from('sections')
          .select('id, name, grade_level_id, grade_levels(name)')
          .eq('school_year_id', yearId)
          .eq('is_active', true),
      ]);

      const enrollments = enrollRes.data || [];
      setEnrollments(enrollments);
      setGradeLevels(glRes.data || []);
      setSections(secRes.data || []);

      const enrolled = enrollments.filter(e => e.status === 'enrolled').length;
      const pending = enrollments.filter(e => e.status === 'pending').length;
      const dropped = enrollments.filter(e => e.status === 'dropped').length;
      const withSection = enrollments.filter(e => e.section_id).length;
      const withoutSection = enrollments.filter(e => !e.section_id).length;
      const maleCount = enrollments.filter(e => e.students?.gender === 'Male').length;
      const femaleCount = enrollments.filter(e => e.students?.gender === 'Female').length;

      setStats({
        totalRecords: enrollments.length,
        enrolledCount: enrolled,
        pendingCount: pending,
        droppedCount: dropped,
        withSection,
        withoutSection,
        maleCount,
        femaleCount,
      });
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    let records = [...enrollments];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(e => {
        const name = `${e.students?.first_name || ''} ${e.students?.last_name || ''}`.toLowerCase();
        const lrn = (e.students?.lrn || '').toLowerCase();
        return name.includes(q) || lrn.includes(q);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      records = records.filter(e => e.status === statusFilter);
    }

    // Grade filter
    if (gradeFilter !== 'all') {
      records = records.filter(e => e.grade_level_id === gradeFilter);
    }

    // Section filter
    if (sectionFilter !== 'all') {
      records = records.filter(e => e.section_id === sectionFilter);
    }

    // Sort
    records.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = `${a.students?.last_name || ''} ${a.students?.first_name || ''}`.toLowerCase();
          valB = `${b.students?.last_name || ''} ${b.students?.first_name || ''}`.toLowerCase();
          break;
        case 'lrn':
          valA = a.students?.lrn || '';
          valB = b.students?.lrn || '';
          break;
        case 'grade':
          valA = a.grade_levels?.level_order || 0;
          valB = b.grade_levels?.level_order || 0;
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        case 'date':
          valA = a.enrollment_date || '';
          valB = b.enrollment_date || '';
          break;
        default:
          valA = '';
          valB = '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return records;
  }, [enrollments, searchQuery, statusFilter, gradeFilter, sectionFilter, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, gradeFilter, sectionFilter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-teal-500" />
      : <ChevronDown className="w-3.5 h-3.5 text-teal-500" />;
  };

  const getInitials = (first, last) => {
    return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
  };

  const getInitialColor = (name) => {
    const colors = [
      'from-blue-500 to-cyan-400', 'from-emerald-500 to-teal-400',
      'from-violet-500 to-purple-400', 'from-pink-500 to-rose-400',
      'from-amber-500 to-orange-400', 'from-indigo-500 to-blue-400',
    ];
    const idx = (name || '').split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    return colors[idx % colors.length];
  };

  // Skeleton loading
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="h-28 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ── Hero Banner ── */}
      <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 p-6 md:p-8 text-white shadow-xl">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-teal-300/20 blur-2xl" />
            <div className="absolute top-1/2 right-1/3 w-32 h-32 rounded-full bg-cyan-400/10 blur-xl" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Records Office</h1>
                    <p className="text-teal-100 text-sm mt-0.5">
                      {activeYear?.year_name || 'Current'} School Year • Student Records Management
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <AnimatedCounter value={stats.totalRecords} /> Records
                </div>
                <div className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <AnimatedCounter value={stats.enrolledCount} /> Enrolled
                </div>
                <div className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <AnimatedCounter value={stats.pendingCount} /> Pending
                </div>
                {stats.withoutSection > 0 && (
                  <div className="px-3 py-1.5 bg-amber-500/30 backdrop-blur-sm rounded-lg text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <AnimatedCounter value={stats.withoutSection} /> No Section
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Quick Stats Row ── */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: stats.totalRecords, icon: Folder, gradient: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-500/20' },
          { label: 'Enrolled', value: stats.enrolledCount, icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-500/20' },
          { label: 'Pending', value: stats.pendingCount, icon: Clock, gradient: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/20' },
          { label: 'Dropped', value: stats.droppedCount, icon: AlertCircle, gradient: 'from-red-500 to-rose-500', glow: 'shadow-red-500/20' },
        ].map((stat, i) => (
          <motion.div key={i} variants={fadeUp}>
            <GlassCard className={`p-4 hover:shadow-lg hover:${stat.glow} transition-all duration-300`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                    <AnimatedCounter value={stat.value} />
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Document Generation Tools ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
        <GlassCard className="overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FileText className="w-4.5 h-4.5 text-white" />
              </div>
              <h3 className="font-semibold text-white">Document Generation</h3>
            </div>
            <span className="text-xs text-white/70">Select a student below, then generate</span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {DOCUMENT_TYPES.map((doc) => {
                const Icon = doc.icon;
                const colorMap = {
                  blue: 'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                  emerald: 'hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                  violet: 'hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20',
                  teal: 'hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
                  orange: 'hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20',
                  pink: 'hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20',
                };
                const iconBg = {
                  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
                  emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
                  violet: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
                  teal: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
                  orange: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',
                  pink: 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-400',
                };
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      if (selectedStudent) {
                        setShowDocPanel(true);
                      }
                    }}
                    className={`group relative p-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 transition-all duration-200 text-left ${colorMap[doc.color]} ${!selectedStudent ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    disabled={!selectedStudent}
                  >
                    <div className={`p-2 rounded-lg ${iconBg[doc.color]} w-fit mb-2`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{doc.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{doc.desc}</p>
                  </button>
                );
              })}
            </div>
            {selectedStudent && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Selected: <span className="font-semibold text-gray-900 dark:text-white">{selectedStudent.students?.last_name}, {selectedStudent.students?.first_name}</span>
                  <span className="text-gray-400 mx-2">•</span>
                  <span className="text-gray-500">LRN: {selectedStudent.students?.lrn || 'N/A'}</span>
                  <span className="text-gray-400 mx-2">•</span>
                  <span className="text-gray-500">{selectedStudent.grade_levels?.name}</span>
                  <button onClick={() => setSelectedStudent(null)} className="ml-3 text-red-500 hover:text-red-700 text-xs font-medium">Clear</button>
                </p>
              </motion.div>
            )}
            {!selectedStudent && (
              <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 italic">
                💡 Click on a student row below to select them for document generation
              </p>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Search & Filters ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
        <GlassCard className="overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-3.5 flex items-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <FileSearch className="w-4.5 h-4.5 text-white" />
            </div>
            <h3 className="font-semibold text-white">Student Records</h3>
            <span className="ml-auto text-sm text-white/80 font-medium">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div className="p-4 space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student name or LRN..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Status</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="pending">Pending</option>
                  <option value="dropped">Dropped</option>
                </select>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Grades</option>
                  {gradeLevels.map(gl => (
                    <option key={gl.id} value={gl.id}>{gl.name}</option>
                  ))}
                </select>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Sections</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.grade_levels?.name} - {s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); setGradeFilter('all'); setSectionFilter('all'); }}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:text-teal-600 hover:border-teal-400 text-sm transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* Records Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    {[
                      { key: 'name', label: 'Student Name', width: 'min-w-[200px]' },
                      { key: 'lrn', label: 'LRN', width: 'min-w-[130px]' },
                      { key: 'grade', label: 'Grade Level', width: 'min-w-[120px]' },
                      { key: 'section', label: 'Section', width: 'min-w-[100px]' },
                      { key: 'status', label: 'Status', width: 'min-w-[100px]' },
                      { key: 'type', label: 'Type', width: 'min-w-[100px]' },
                      { key: 'date', label: 'Enrolled', width: 'min-w-[100px]' },
                      { key: 'actions', label: '', width: 'w-[80px]' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => col.key !== 'actions' && col.key !== 'section' && col.key !== 'type' && handleSort(col.key)}
                        className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${col.width} ${col.key !== 'actions' && col.key !== 'section' && col.key !== 'type' ? 'cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 select-none' : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.key !== 'actions' && col.key !== 'section' && col.key !== 'type' && <SortIcon field={col.key} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <AnimatePresence mode="popLayout">
                    {paginatedRecords.map((record, idx) => {
                      const firstName = record.students?.first_name || '';
                      const lastName = record.students?.last_name || '';
                      const fullName = `${lastName}, ${firstName}`;
                      const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                      const isSelected = selectedStudent?.id === record.id;

                      return (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => setSelectedStudent(isSelected ? null : record)}
                          className={`group cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-900/20 border-l-4 border-l-teal-500'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-4 border-l-transparent'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getInitialColor(fullName)} flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0`}>
                                {getInitials(firstName, lastName)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white leading-tight">{fullName}</p>
                                <p className="text-[11px] text-gray-400">{record.students?.gender || ''}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {record.students?.lrn || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{record.grade_levels?.name || '—'}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{record.sections?.name || <span className="text-amber-500 text-xs font-medium">Unassigned</span>}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                              {record.status?.charAt(0).toUpperCase() + record.status?.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {record.enrollment_type?.replace('_', ' ') || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {record.enrollment_date ? new Date(record.enrollment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/students`); }}
                                className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 text-gray-400 hover:text-teal-600 transition-colors"
                                title="View Profile"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/enrollment`); }}
                                className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit Enrollment"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                  {paginatedRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <FileSearch className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">No records found</p>
                        <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Try adjusting your search or filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                          currentPage === page
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Quick Navigation ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
        <GlassCard className="overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 flex items-center gap-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <h3 className="font-semibold text-white">Quick Navigation</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Enrollment', desc: 'Manage enrollments', icon: UserPlus, path: '/enrollment', color: 'blue' },
                { label: 'Sections', desc: 'View & manage sections', icon: Layers, path: '/sections', color: 'emerald' },
                { label: 'Students', desc: 'Student directory', icon: Users, path: '/students', color: 'violet' },
                { label: 'Grade Levels', desc: 'Configure levels', icon: GraduationCap, path: '/grade-levels', color: 'teal' },
              ].map((action) => {
                const Icon = action.icon;
                const hoverMap = {
                  blue: 'hover:border-blue-400 hover:shadow-blue-500/10',
                  emerald: 'hover:border-emerald-400 hover:shadow-emerald-500/10',
                  violet: 'hover:border-violet-400 hover:shadow-violet-500/10',
                  teal: 'hover:border-teal-400 hover:shadow-teal-500/10',
                };
                const bgMap = {
                  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
                  emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
                  violet: 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
                  teal: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
                };
                return (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 transition-all duration-200 text-left hover:shadow-lg ${hoverMap[action.color]}`}
                  >
                    <div className={`p-2 rounded-lg ${bgMap[action.color]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{action.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{action.desc}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
