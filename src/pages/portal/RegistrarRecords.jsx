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
  Mail, Phone, MapPin, Hash, User, ChevronLeft, Heart, Activity, History
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GlassCard, AnimatedCounter, AnimatedBadge } from '../../components/ui';
import toast from 'react-hot-toast';

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
  const [enrollments, setEnrollments] = useState([]);
  const [documentsByEnrollment, setDocumentsByEnrollment] = useState({});
  const [gradeLevels, setGradeLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [recordDetails, setRecordDetails] = useState({ guardians: [], emergencyContacts: [], history: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const itemsPerPage = 15;

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0, enrolledCount: 0, pendingCount: 0, droppedCount: 0,
    withSection: 0, withoutSection: 0, maleCount: 0, femaleCount: 0,
    documentSubmitted: 0, documentExpected: 0,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError('');
      const { data: yearData } = await supabase
        .from('school_years')
        .select('id, year_name')
        .eq('is_current', true)
        .maybeSingle();

      const yearId = yearData?.id;
      setActiveYear(yearData);

      let enrollQuery = supabase.from('enrollments')
        .select('id, school_year_id, status, enrollment_date, enrollment_type, learning_modality, remarks, grade_level_id, section_id, student_id, created_at, students(id, first_name, middle_name, last_name, suffix, lrn, gender, birth_date, birth_place, nationality, religion, mother_tongue, psa_birth_cert_no, is_4ps_beneficiary, is_indigenous_people, is_pwd, disability_type, is_solo_parent_child, medical_conditions, allergies, immunization_status, house_no, street, barangay, city_municipality, province, zip_code, contact_number, email, status), grade_levels(id, name, level_order), sections(id, name)')
        .order('enrollment_date', { ascending: false });
      let sectionsQuery = supabase.from('sections')
        .select('id, name, grade_level_id, grade_levels(name)')
        .eq('is_active', true);

      if (yearId) {
        enrollQuery = enrollQuery.eq('school_year_id', yearId);
        sectionsQuery = sectionsQuery.eq('school_year_id', yearId);
      } else {
        enrollQuery = enrollQuery.limit(0);
        sectionsQuery = sectionsQuery.limit(0);
      }

      const [enrollRes, glRes, secRes] = await Promise.all([
        enrollQuery,
        supabase.from('grade_levels')
          .select('id, name, level_order, category')
          .eq('is_active', true)
          .order('level_order'),
        sectionsQuery,
      ]);

      if (enrollRes.error) throw enrollRes.error;
      if (glRes.error) throw glRes.error;
      if (secRes.error) throw secRes.error;

      const enrollments = enrollRes.data || [];
      const enrollmentIds = enrollments.map(e => e.id);
      const { data: documentRows, error: docError } = enrollmentIds.length > 0
        ? await supabase
            .from('enrollment_documents')
            .select('*')
            .in('enrollment_id', enrollmentIds)
        : { data: [], error: null };
      if (docError) throw docError;

      const nextDocumentsByEnrollment = (documentRows || []).reduce((acc, doc) => {
        if (!acc[doc.enrollment_id]) acc[doc.enrollment_id] = [];
        acc[doc.enrollment_id].push(doc);
        return acc;
      }, {});

      setEnrollments(enrollments);
      setDocumentsByEnrollment(nextDocumentsByEnrollment);
      setGradeLevels(glRes.data || []);
      setSections(secRes.data || []);

      const enrolled = enrollments.filter(e => e.status === 'enrolled').length;
      const pending = enrollments.filter(e => e.status === 'pending').length;
      const dropped = enrollments.filter(e => e.status === 'dropped').length;
      const withSection = enrollments.filter(e => e.section_id).length;
      const withoutSection = enrollments.filter(e => !e.section_id).length;
      const maleCount = enrollments.filter(e => e.students?.gender === 'Male').length;
      const femaleCount = enrollments.filter(e => e.students?.gender === 'Female').length;
      const documentSubmitted = (documentRows || []).filter(d => d.is_submitted).length;
      const documentExpected = enrollments.length * DOCUMENT_TYPES.length;

      setStats({
        totalRecords: enrollments.length,
        enrolledCount: enrolled,
        pendingCount: pending,
        droppedCount: dropped,
        withSection,
        withoutSection,
        maleCount,
        femaleCount,
        documentSubmitted,
        documentExpected,
      });
    } catch (err) {
      console.error('Error fetching records:', err);
      setFetchError(err.message || 'Unable to load registrar records.');
      toast.error('Records Office data failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordDetails = useCallback(async (record) => {
    if (!record?.student_id) {
      setRecordDetails({ guardians: [], emergencyContacts: [], history: [] });
      return;
    }

    setDetailLoading(true);
    try {
      const [guardianRes, emergencyRes, historyRes] = await Promise.all([
        supabase
          .from('student_guardians')
          .select('is_primary, guardians(id, first_name, middle_name, last_name, relationship, contact_number, email, occupation, office_address, office_contact, is_emergency_contact)')
          .eq('student_id', record.student_id),
        supabase
          .from('emergency_contacts')
          .select('id, full_name, relationship, contact_number, alt_contact_number, address, is_primary')
          .eq('student_id', record.student_id)
          .order('is_primary', { ascending: false }),
        supabase
          .from('enrollments')
          .select('id, status, enrollment_date, enrollment_type, school_year_id, school_years(year_name, is_current), grade_levels(name), sections(name)')
          .eq('student_id', record.student_id)
          .order('enrollment_date', { ascending: false }),
      ]);

      if (guardianRes.error) throw guardianRes.error;
      if (emergencyRes.error) throw emergencyRes.error;
      if (historyRes.error) throw historyRes.error;

      setRecordDetails({
        guardians: (guardianRes.data || []).map(row => ({
          ...row.guardians,
          is_primary: row.is_primary,
        })).filter(Boolean),
        emergencyContacts: emergencyRes.data || [],
        history: historyRes.data || [],
      });
    } catch (err) {
      console.error('Error fetching selected record details:', err);
      toast.error('Selected student file failed to load');
      setRecordDetails({ guardians: [], emergencyContacts: [], history: [] });
    } finally {
      setDetailLoading(false);
    }
  }, []);

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
  useEffect(() => { fetchRecordDetails(selectedStudent); }, [selectedStudent, fetchRecordDetails]);

  const selectedDocuments = selectedStudent ? documentsByEnrollment[selectedStudent.id] || [] : [];
  const selectedSubmittedCount = selectedDocuments.filter(doc => doc.is_submitted).length;
  const selectedAddress = selectedStudent?.students
    ? [
        selectedStudent.students.house_no,
        selectedStudent.students.street,
        selectedStudent.students.barangay,
        selectedStudent.students.city_municipality,
        selectedStudent.students.province,
        selectedStudent.students.zip_code,
      ].filter(Boolean).join(', ')
    : '';
  const documentCompletionRate = stats.documentExpected > 0
    ? Math.round((stats.documentSubmitted / stats.documentExpected) * 100)
    : 0;

  const formatDate = (dateValue) => {
    if (!dateValue) return '—';
    return new Date(dateValue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const handleRecordSelect = (record) => {
    setSelectedStudent(current => current?.id === record.id ? null : record);
  };

  const handleDocumentToggle = async (docType, isSubmitted) => {
    if (!selectedStudent) return;

    const existing = selectedDocuments.find(doc => doc.document_type === docType.id);
    const payload = {
      enrollment_id: selectedStudent.id,
      student_id: selectedStudent.student_id,
      document_type: docType.id,
      document_name: docType.name,
      is_submitted: isSubmitted,
      submitted_date: isSubmitted ? new Date().toISOString().split('T')[0] : null,
      verified_by: isSubmitted ? user?.id : null,
      verified_at: isSubmitted ? new Date().toISOString() : null,
    };

    try {
      const { data, error } = existing
        ? await supabase
            .from('enrollment_documents')
            .update(payload)
            .eq('id', existing.id)
            .select()
            .single()
        : await supabase
            .from('enrollment_documents')
            .insert(payload)
            .select()
            .single();

      if (error) throw error;

      setDocumentsByEnrollment(prev => {
        const currentDocs = prev[selectedStudent.id] || [];
        const nextDocs = existing
          ? currentDocs.map(doc => doc.id === existing.id ? data : doc)
          : [...currentDocs, data];

        return { ...prev, [selectedStudent.id]: nextDocs };
      });

      setStats(prev => ({
        ...prev,
        documentSubmitted: prev.documentSubmitted + (isSubmitted && !existing?.is_submitted ? 1 : 0) - (!isSubmitted && existing?.is_submitted ? 1 : 0),
      }));

      toast.success(`${docType.name} ${isSubmitted ? 'marked submitted' : 'cleared'}`);
    } catch (err) {
      console.error('Error updating document:', err);
      toast.error('Document status was not saved');
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedStudent) return;

    try {
      const updates = { status: newStatus };
      if (newStatus === 'enrolled') updates.approved_at = new Date().toISOString();
      if (newStatus === 'dropped') updates.date_dropped = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('enrollments')
        .update(updates)
        .eq('id', selectedStudent.id)
        .select('id, status, enrollment_date, enrollment_type, learning_modality, remarks, grade_level_id, section_id, student_id, school_year_id, created_at, students(id, first_name, middle_name, last_name, suffix, lrn, gender, birth_date, birth_place, nationality, religion, mother_tongue, psa_birth_cert_no, is_4ps_beneficiary, is_indigenous_people, is_pwd, disability_type, is_solo_parent_child, medical_conditions, allergies, immunization_status, house_no, street, barangay, city_municipality, province, zip_code, contact_number, email, status), grade_levels(id, name, level_order), sections(id, name)')
        .single();

      if (error) throw error;

      setEnrollments(prev => prev.map(record => record.id === data.id ? data : record));
      setSelectedStudent(data);
      toast.success(`Enrollment status updated to ${newStatus}`);
      fetchData();
    } catch (err) {
      console.error('Error updating enrollment status:', err);
      toast.error('Enrollment status was not saved');
    }
  };

  const handlePrintDocument = (docType) => {
    if (!selectedStudent) return;

    const student = selectedStudent.students || {};
    const fullName = `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''} ${student.suffix || ''}`.replace(/\s+/g, ' ').trim();
    const printable = window.open('', '_blank', 'width=900,height=700');
    if (!printable) {
      toast.error('Allow popups to print the document');
      return;
    }

    printable.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(docType.name)} - ${escapeHtml(fullName)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 48px; color: #111827; }
            .sheet { max-width: 760px; margin: 0 auto; border: 1px solid #d1d5db; padding: 40px; min-height: 860px; }
            .center { text-align: center; }
            h1 { font-size: 22px; letter-spacing: 1px; margin: 28px 0 12px; text-transform: uppercase; }
            h2 { font-size: 16px; margin: 0; font-weight: 600; }
            p { font-size: 15px; line-height: 1.8; }
            .meta { margin-top: 28px; display: grid; gap: 8px; font-size: 14px; }
            .signature { margin-top: 96px; display: flex; justify-content: flex-end; }
            .line { min-width: 240px; border-top: 1px solid #111827; text-align: center; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="center">
              <h2>MABDC Student Management System</h2>
              <p>Records Office</p>
              <h1>${escapeHtml(docType.name)}</h1>
            </div>
            <p>This document certifies that <strong>${escapeHtml(fullName || 'the student')}</strong>, LRN <strong>${escapeHtml(student.lrn || 'N/A')}</strong>, is recorded in the school system for <strong>${escapeHtml(activeYear?.year_name || 'the current school year')}</strong>.</p>
            <div class="meta">
              <div><strong>Grade Level:</strong> ${escapeHtml(selectedStudent.grade_levels?.name || 'N/A')}</div>
              <div><strong>Section:</strong> ${escapeHtml(selectedStudent.sections?.name || 'Unassigned')}</div>
              <div><strong>Enrollment Status:</strong> ${escapeHtml(selectedStudent.status || 'N/A')}</div>
              <div><strong>Enrollment Date:</strong> ${escapeHtml(formatDate(selectedStudent.enrollment_date))}</div>
              <div><strong>Date Issued:</strong> ${escapeHtml(formatDate(new Date().toISOString()))}</div>
            </div>
            <div class="signature">
              <div class="line">Registrar / Records Officer</div>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    printable.document.close();
  };

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
                <div className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-lg text-sm font-medium flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  {documentCompletionRate}% Docs
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

      {fetchError && (
        <motion.div {...fadeUp}>
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{fetchError}</span>
          </div>
        </motion.div>
      )}

      {/* ── Quick Stats Row ── */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Records', value: stats.totalRecords, icon: Folder, gradient: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-500/20' },
          { label: 'Enrolled', value: stats.enrolledCount, icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-500/20' },
          { label: 'Pending', value: stats.pendingCount, icon: Clock, gradient: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/20' },
          { label: 'Dropped', value: stats.droppedCount, icon: AlertCircle, gradient: 'from-red-500 to-rose-500', glow: 'shadow-red-500/20' },
          { label: 'Docs Complete', value: documentCompletionRate, icon: FileCheck, gradient: 'from-violet-500 to-fuchsia-500', glow: 'shadow-violet-500/20', suffix: '%' },
        ].map((stat, i) => (
          <motion.div key={i} variants={fadeUp}>
            <GlassCard className={`p-4 hover:shadow-lg hover:${stat.glow} transition-all duration-300`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                    <AnimatedCounter value={stat.value} />
                    {stat.suffix || ''}
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

      {/* ── Records Office Actions ── */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
        <GlassCard className="overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <FileText className="w-4.5 h-4.5 text-white" />
              </div>
              <h3 className="font-semibold text-white">Records Office Actions</h3>
            </div>
            <span className="text-xs text-white/70">
              {selectedStudent ? `${selectedSubmittedCount}/${DOCUMENT_TYPES.length} requirements submitted` : `${stats.documentSubmitted}/${stats.documentExpected} requirements submitted`}
            </span>
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
                    onClick={() => selectedStudent && handlePrintDocument(doc)}
                    className={`group relative p-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 transition-all duration-200 text-left ${colorMap[doc.color]} ${!selectedStudent ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    disabled={!selectedStudent}
                    title={selectedStudent ? `Print ${doc.name}` : 'Select a student first'}
                  >
                    <div className={`p-2 rounded-lg ${iconBg[doc.color]} w-fit mb-2`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{doc.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{doc.desc}</p>
                    {selectedStudent && selectedDocuments.some(item => item.document_type === doc.id && item.is_submitted) && (
                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    )}
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
                Select a student row to activate record actions
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
                  {paginatedRecords.map((record) => {
                    const firstName = record.students?.first_name || '';
                    const lastName = record.students?.last_name || '';
                    const fullName = `${lastName}, ${firstName}`;
                    const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
                    const isSelected = selectedStudent?.id === record.id;

                    return (
                      <tr
                        key={record.id}
                        onClick={() => handleRecordSelect(record)}
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
                              onClick={(e) => { e.stopPropagation(); navigate(`/students/${record.student_id}`); }}
                              className="p-1.5 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 text-gray-400 hover:text-teal-600 transition-colors"
                              title="View Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/enrollment/${record.id}/edit`); }}
                              className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Enrollment"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── Registrar Work Panel ── */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            {...fadeUp}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard className="overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-teal-800 px-5 py-4 text-white">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getInitialColor(`${selectedStudent.students?.last_name} ${selectedStudent.students?.first_name}`)} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                      {getInitials(selectedStudent.students?.first_name, selectedStudent.students?.last_name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">
                        {selectedStudent.students?.last_name}, {selectedStudent.students?.first_name} {selectedStudent.students?.middle_name || ''}
                      </h3>
                      <p className="text-white/75 text-sm">
                        LRN {selectedStudent.students?.lrn || 'N/A'} • {selectedStudent.grade_levels?.name || 'No grade'} • {selectedStudent.sections?.name || 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate(`/students/${selectedStudent.student_id}`)}
                      className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Eye className="w-4 h-4" /> Student File
                    </button>
                    <button
                      onClick={() => navigate(`/enrollment/${selectedStudent.id}`)}
                      className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <FileSearch className="w-4 h-4" /> Enrollment
                    </button>
                    <button
                      onClick={() => navigate(`/enrollment/${selectedStudent.id}/edit`)}
                      className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Enrollment Status', value: selectedStudent.status || 'pending', icon: Shield },
                    { label: 'Enrollment Date', value: formatDate(selectedStudent.enrollment_date), icon: Calendar },
                    { label: 'Learning Modality', value: selectedStudent.learning_modality?.replace('_', ' ') || 'N/A', icon: BookOpen },
                    { label: 'Documents', value: `${selectedSubmittedCount}/${DOCUMENT_TYPES.length} submitted`, icon: FileCheck },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800/60">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                          <Icon className="w-3.5 h-3.5" />
                          {item.label}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white capitalize">{item.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                  <div className="xl:col-span-2 space-y-5">
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-teal-600" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Student Record</h4>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        {[
                          ['Birth Date', formatDate(selectedStudent.students?.birth_date)],
                          ['Birth Place', selectedStudent.students?.birth_place || 'N/A'],
                          ['Gender', selectedStudent.students?.gender || 'N/A'],
                          ['Contact', selectedStudent.students?.contact_number || 'N/A'],
                          ['Email', selectedStudent.students?.email || 'N/A'],
                          ['PSA No.', selectedStudent.students?.psa_birth_cert_no || 'N/A'],
                          ['Address', selectedAddress || 'N/A'],
                          ['Health Notes', [selectedStudent.students?.medical_conditions, selectedStudent.students?.allergies].filter(Boolean).join(' / ') || 'N/A'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                            <p className="font-medium text-gray-900 dark:text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-teal-600" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Family And Emergency Contacts</h4>
                        {detailLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Guardians</p>
                          {recordDetails.guardians.length === 0 ? (
                            <p className="text-sm text-gray-400">No guardian records</p>
                          ) : recordDetails.guardians.map(guardian => (
                            <div key={guardian.id} className="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {guardian.first_name} {guardian.middle_name || ''} {guardian.last_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {guardian.relationship || 'Guardian'}{guardian.is_primary ? ' • Primary' : ''} • {guardian.contact_number || 'No contact'}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Emergency Contacts</p>
                          {recordDetails.emergencyContacts.length === 0 ? (
                            <p className="text-sm text-gray-400">No emergency records</p>
                          ) : recordDetails.emergencyContacts.map(contact => (
                            <div key={contact.id} className="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {contact.full_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {contact.relationship || 'Contact'}{contact.is_primary ? ' • Primary' : ''} • {contact.contact_number || 'No contact'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <History className="w-4 h-4 text-teal-600" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Enrollment History</h4>
                      </div>
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                        {recordDetails.history.length === 0 ? (
                          <p className="p-3 text-sm text-gray-400">No enrollment history</p>
                        ) : recordDetails.history.map(item => (
                          <button
                            key={item.id}
                            onClick={() => navigate(`/enrollment/${item.id}`)}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.school_years?.year_name || 'School year'} • {item.grade_levels?.name || 'Grade'} • {item.sections?.name || 'No section'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(item.enrollment_date)} • {item.enrollment_type || 'enrollment'}</p>
                            </div>
                            <span className="text-xs capitalize text-gray-500 dark:text-gray-400">{item.status}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-5">
                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-teal-600" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Registrar Controls</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {['pending', 'enrolled', 'dropped'].map(status => (
                          <button
                            key={status}
                            onClick={() => handleStatusUpdate(status)}
                            disabled={selectedStudent.status === status}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                              selectedStudent.status === status
                                ? 'bg-teal-600 text-white cursor-default'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-teal-100 dark:hover:bg-teal-900/30'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-3">
                        <FileCheck className="w-4 h-4 text-teal-600" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">Document Checklist</h4>
                      </div>
                      <div className="space-y-2">
                        {DOCUMENT_TYPES.map(docType => {
                          const doc = selectedDocuments.find(item => item.document_type === docType.id);
                          const isSubmitted = !!doc?.is_submitted;
                          const Icon = docType.icon;
                          return (
                            <div key={docType.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${isSubmitted ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{docType.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{isSubmitted ? `Submitted ${formatDate(doc.submitted_date)}` : 'Not submitted'}</p>
                              </div>
                              <button
                                onClick={() => handleDocumentToggle(docType, !isSubmitted)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors ${isSubmitted ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                                title={isSubmitted ? 'Clear submission' : 'Mark submitted'}
                              >
                                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${isSubmitted ? 'translate-x-5' : 'translate-x-0'}`} />
                              </button>
                              <button
                                onClick={() => handlePrintDocument(docType)}
                                className="p-2 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
                                title={`Print ${docType.name}`}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

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
