import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  Users, Calendar, CheckCircle, XCircle, Clock, AlertCircle,
  Filter, ChevronLeft, ChevronRight, Search, UserCheck, Download,
  BarChart3, List, Plus, Pencil, Trash2, X
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import toast from 'react-hot-toast'

const STATUS_CONFIG = {
  present: { color: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500', icon: CheckCircle, label: 'Present' },
  absent:  { color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500', icon: XCircle, label: 'Absent' },
  late:    { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500', icon: Clock, label: 'Late' },
  excused: { color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', icon: AlertCircle, label: 'Excused' },
}

const PIE_COLORS = ['#22c55e', '#ef4444', '#eab308', '#3b82f6']

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' } }),
}

const stagger = { visible: { transition: { staggerChildren: 0.06 } } }

function AnimatedCounter({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = typeof value === 'number' ? value : parseFloat(value) || 0
    const duration = 600
    const step = Math.max(1, Math.ceil(end / (duration / 16)))
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setDisplay(end); clearInterval(timer) }
      else setDisplay(start)
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}{suffix}</span>
}

function StatCard({ icon: Icon, label, value, suffix, color, delay }) {
  return (
    <motion.div
      className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow`}
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>
            <AnimatedCounter value={value} suffix={suffix} />
          </p>
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('800', '100').replace('700', '100')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </motion.div>
  )
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-3/4" /></td>
      ))}
    </tr>
  )
}

export default function AttendanceList() {
  // Data states
  const [records, setRecords] = useState([])
  const [students, setStudents] = useState([])
  const [sections, setSections] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [selectedSY, setSelectedSY] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // View states
  const [viewMode, setViewMode] = useState('list') // list | charts
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  // Form states
  const [formStudent, setFormStudent] = useState('')
  const [formSection, setFormSection] = useState('')
  const [formSY, setFormSY] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formStatus, setFormStatus] = useState('present')
  const [formTimeIn, setFormTimeIn] = useState('')
  const [formRemarks, setFormRemarks] = useState('')

  // Bulk states
  const [bulkSection, setBulkSection] = useState('')
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkSY, setBulkSY] = useState('')
  const [bulkStudents, setBulkStudents] = useState([])
  const [bulkLoading, setBulkLoading] = useState(false)

  // Load reference data
  useEffect(() => {
    const loadRefs = async () => {
      const [syRes, glRes, secRes] = await Promise.all([
        supabase.from('school_years').select('id, year_name, status, is_current').order('year_name', { ascending: false }),
        supabase.from('grade_levels').select('id, name, level_order').order('level_order'),
        supabase.from('sections').select('id, name, grade_level_id, school_year_id').order('name'),
      ])
      const syData = syRes.data || []
      setSchoolYears(syData)
      setGradeLevels(glRes.data || [])
      setSections(secRes.data || [])
      // Default to active school year
      const active = syData.find(s => s.status === 'active' || s.is_current)
      if (active) {
        setSelectedSY(active.id)
        setFormSY(active.id)
        setBulkSY(active.id)
      }
    }
    loadRefs()
  }, [])

  // Load attendance records when filters change
  useEffect(() => {
    if (selectedSY) fetchRecords()
  }, [selectedSY, selectedGrade, selectedSection, selectedStatus, dateFrom, dateTo])

  const fetchRecords = async () => {
    setLoading(true)
    let query = supabase
      .from('attendance_records')
      .select('*, students(id, first_name, last_name, middle_name, lrn), sections(id, name, grade_level_id)')
      .order('date', { ascending: false })

    if (selectedSY) query = query.eq('school_year_id', selectedSY)
    if (selectedSection) query = query.eq('section_id', selectedSection)
    if (selectedStatus) query = query.eq('status', selectedStatus)
    if (dateFrom) query = query.gte('date', dateFrom)
    if (dateTo) query = query.lte('date', dateTo)

    const { data, error } = await query.limit(2000)
    if (error) { toast.error('Failed to load attendance'); console.error(error) }
    else setRecords(data || [])
    setLoading(false)
  }

  // Filtered sections based on selected grade & SY
  const filteredSections = useMemo(() => {
    return sections.filter(s => {
      if (selectedSY && s.school_year_id !== selectedSY) return false
      if (selectedGrade && s.grade_level_id !== selectedGrade) return false
      return true
    })
  }, [sections, selectedGrade, selectedSY])

  // Search-filtered records
  const displayRecords = useMemo(() => {
    let result = [...records]
    if (selectedGrade && !selectedSection) {
      const sectionIds = filteredSections.map(s => s.id)
      result = result.filter(r => sectionIds.includes(r.section_id))
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r => {
        const name = r.students ? `${r.students.last_name} ${r.students.first_name}`.toLowerCase() : ''
        const lrn = r.students?.lrn?.toLowerCase() || ''
        return name.includes(q) || lrn.includes(q)
      })
    }
    return result
  }, [records, search, selectedGrade, filteredSections])

  // Stats
  const stats = useMemo(() => {
    const total = displayRecords.length
    const present = displayRecords.filter(r => r.status === 'present').length
    const absent = displayRecords.filter(r => r.status === 'absent').length
    const late = displayRecords.filter(r => r.status === 'late').length
    const excused = displayRecords.filter(r => r.status === 'excused').length
    const rate = total > 0 ? ((present + late) / total * 100).toFixed(1) : 0
    return { total, present, absent, late, excused, rate }
  }, [displayRecords])

  // Chart data — monthly trend
  const monthlyData = useMemo(() => {
    const months = {}
    displayRecords.forEach(r => {
      const m = r.date?.substring(0, 7) // YYYY-MM
      if (!m) return
      if (!months[m]) months[m] = { month: m, present: 0, absent: 0, late: 0, excused: 0 }
      months[m][r.status]++
    })
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    }))
  }, [displayRecords])

  // Chart data — pie
  const pieData = useMemo(() => [
    { name: 'Present', value: stats.present },
    { name: 'Absent', value: stats.absent },
    { name: 'Late', value: stats.late },
    { name: 'Excused', value: stats.excused },
  ].filter(d => d.value > 0), [stats])

  // Pagination
  const totalPages = Math.ceil(displayRecords.length / pageSize)
  const pagedRecords = displayRecords.slice((page - 1) * pageSize, page * pageSize)

  // Form handlers
  const openNewRecord = () => {
    setEditing(null)
    setFormStudent('')
    setFormSection('')
    setFormSY(selectedSY || '')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormStatus('present')
    setFormTimeIn('')
    setFormRemarks('')
    setModalOpen(true)
  }

  const openEditRecord = (row) => {
    setEditing(row)
    setFormStudent(row.student_id)
    setFormSection(row.section_id)
    setFormSY(row.school_year_id)
    setFormDate(row.date)
    setFormStatus(row.status)
    setFormTimeIn(row.time_in || '')
    setFormRemarks(row.remarks || '')
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formStudent || !formSection || !formSY || !formDate || !formStatus) {
      toast.error('Please fill all required fields')
      return
    }
    setSaving(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      const submitData = {
        student_id: formStudent,
        section_id: formSection,
        school_year_id: formSY,
        date: formDate,
        status: formStatus,
        time_in: formTimeIn || null,
        remarks: formRemarks || null,
        recorded_by: user.id,
      }
      if (editing) {
        const { error } = await supabase.from('attendance_records').update(submitData).eq('id', editing.id)
        if (error) throw error
        toast.success('Record updated!')
      } else {
        const { error } = await supabase.from('attendance_records').insert(submitData)
        if (error) throw error
        toast.success('Record created!')
      }
      setModalOpen(false)
      fetchRecords()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this attendance record?')) return
    try {
      const { error } = await supabase.from('attendance_records').delete().eq('id', id)
      if (error) throw error
      toast.success('Record deleted')
      fetchRecords()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  // Bulk attendance
  const openBulkModal = () => {
    setBulkSection('')
    setBulkDate(new Date().toISOString().split('T')[0])
    setBulkSY(selectedSY || '')
    setBulkStudents([])
    setBulkModalOpen(true)
  }

  const loadBulkStudents = async (sectionId) => {
    if (!sectionId) { setBulkStudents([]); return }
    setBulkLoading(true)
    // Get students enrolled in this section
    const { data, error } = await supabase
      .from('enrollments')
      .select('student_id, students(id, first_name, last_name, middle_name, lrn)')
      .eq('section_id', sectionId)
      .eq('school_year_id', bulkSY)
      .eq('status', 'active')
      .order('students(last_name)')

    if (error) { toast.error('Failed to load students'); console.error(error) }
    else {
      setBulkStudents((data || []).map(e => ({
        student_id: e.student_id,
        name: e.students ? `${e.students.last_name}, ${e.students.first_name} ${e.students.middle_name ? e.students.middle_name.charAt(0) + '.' : ''}` : 'Unknown',
        lrn: e.students?.lrn || '',
        status: 'present',
        time_in: '',
        remarks: '',
      })))
    }
    setBulkLoading(false)
  }

  const updateBulkStudent = (idx, field, value) => {
    setBulkStudents(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const markAllAs = (status) => {
    setBulkStudents(prev => prev.map(s => ({ ...s, status })))
  }

  const handleBulkSave = async () => {
    if (!bulkSection || !bulkDate || !bulkSY || bulkStudents.length === 0) {
      toast.error('Please select section, date, and ensure students are loaded')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const inserts = bulkStudents.map(s => ({
        student_id: s.student_id,
        section_id: bulkSection,
        school_year_id: bulkSY,
        date: bulkDate,
        status: s.status,
        time_in: s.time_in || null,
        remarks: s.remarks || null,
        recorded_by: user.id,
      }))
      const { error } = await supabase.from('attendance_records').upsert(inserts, {
        onConflict: 'student_id,date',
      })
      if (error) throw error
      toast.success(`Saved attendance for ${bulkStudents.length} students!`)
      setBulkModalOpen(false)
      fetchRecords()
    } catch (err) {
      toast.error(err.message || 'Bulk save failed')
    }
    setSaving(false)
  }

  // Students for single-record form (load by section)
  const [formStudents, setFormStudents] = useState([])
  useEffect(() => {
    if (!formSection || !formSY) { setFormStudents([]); return }
    const load = async () => {
      const { data } = await supabase
        .from('enrollments')
        .select('student_id, students(id, first_name, last_name, lrn)')
        .eq('section_id', formSection)
        .eq('school_year_id', formSY)
        .eq('status', 'active')
      setFormStudents(data || [])
    }
    load()
  }, [formSection, formSY])

  // Form sections filtered by selected SY
  const formSections = useMemo(() => {
    return sections.filter(s => !formSY || s.school_year_id === formSY)
  }, [sections, formSY])

  const getStudentName = (r) => r.students ? `${r.students.last_name}, ${r.students.first_name}` : '-'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader title="Attendance Management" subtitle="Track and manage student attendance records">
        <div className="flex gap-2">
          <motion.button
            onClick={openBulkModal}
            className="btn-secondary flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <UserCheck className="w-4 h-4" /> Bulk Mark
          </motion.button>
          <motion.button
            onClick={openNewRecord}
            className="btn-primary flex items-center gap-2"
            whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" /> Add Record
          </motion.button>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={Calendar} label="Total Records" value={stats.total} color="text-gray-700" delay={0} />
        <StatCard icon={CheckCircle} label="Present" value={stats.present} color="text-green-700" delay={1} />
        <StatCard icon={XCircle} label="Absent" value={stats.absent} color="text-red-700" delay={2} />
        <StatCard icon={Clock} label="Late" value={stats.late} color="text-yellow-700" delay={3} />
        <StatCard icon={AlertCircle} label="Excused" value={stats.excused} color="text-blue-700" delay={4} />
        <StatCard icon={Users} label="Attendance Rate" value={parseFloat(stats.rate)} suffix="%" color="text-indigo-700" delay={5} />
      </div>

      {/* Filters */}
      <motion.div
        className="bg-white rounded-xl border shadow-sm mb-6 overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={() => setShowFilters(f => !f)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter className="w-4 h-4" /> Filters
            {(selectedGrade || selectedSection || selectedStatus || dateFrom || dateTo) && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Active</span>
            )}
          </span>
          <motion.span animate={{ rotate: showFilters ? 180 : 0 }} transition={{ duration: 0.2 }}>▾</motion.span>
        </button>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">School Year</label>
                  <select value={selectedSY} onChange={e => { setSelectedSY(e.target.value); setSelectedSection(''); setPage(1) }} className="input-field text-sm">
                    {schoolYears.map(sy => (
                      <option key={sy.id} value={sy.id}>{sy.year_name} {sy.status === 'active' ? '(Active)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Grade Level</label>
                  <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSection(''); setPage(1) }} className="input-field text-sm">
                    <option value="">All Grades</option>
                    {gradeLevels.map(gl => <option key={gl.id} value={gl.id}>{gl.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
                  <select value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setPage(1) }} className="input-field text-sm">
                    <option value="">All Sections</option>
                    {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value); setPage(1) }} className="input-field text-sm">
                    <option value="">All Status</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
                  <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
                  <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} className="input-field text-sm" />
                </div>
              </div>
              {(selectedGrade || selectedSection || selectedStatus || dateFrom || dateTo) && (
                <div className="px-5 pb-3">
                  <button
                    onClick={() => { setSelectedGrade(''); setSelectedSection(''); setSelectedStatus(''); setDateFrom(''); setDateTo(''); setPage(1) }}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear all filters
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* View Toggle & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student name or LRN..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input-field pl-10 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'list', icon: List, label: 'List' },
            { key: 'charts', icon: BarChart3, label: 'Charts' },
          ].map(v => (
            <motion.button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <v.icon className="w-4 h-4" /> {v.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {viewMode === 'charts' ? (
          <motion.div
            key="charts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
          >
            {/* Trend Chart */}
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Attendance Trend</h3>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Area type="monotone" dataKey="present" stroke="#22c55e" fill="url(#gPresent)" strokeWidth={2} />
                    <Area type="monotone" dataKey="absent" stroke="#ef4444" fill="url(#gAbsent)" strokeWidth={2} />
                    <Area type="monotone" dataKey="late" stroke="#eab308" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="excused" stroke="#3b82f6" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-10">No data to display</p>
              )}
            </div>

            {/* Pie Chart */}
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      paddingAngle={3}
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-10">No data to display</p>
              )}
            </div>

            {/* Daily Bar Chart */}
            <div className="bg-white rounded-xl border shadow-sm p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Breakdown (Last 30 Days)</h3>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                    <Legend />
                    <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" fill="#eab308" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="excused" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-10">No data to display</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Student', 'LRN', 'Section', 'Date', 'Status', 'Time In', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                    ) : pagedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No attendance records found</p>
                        </td>
                      </tr>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {pagedRecords.map((r, ri) => {
                          const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.present
                          return (
                            <motion.tr
                              key={r.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: Math.min(ri, 10) * 0.03, duration: 0.25 }}
                              className="hover:bg-gray-50/80 transition-colors"
                            >
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{getStudentName(r)}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 font-mono">{r.students?.lrn || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{r.sections?.name || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${sc.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {sc.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{r.time_in || '-'}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 action-cell">
                                  <motion.button
                                    onClick={() => openEditRecord(r)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </motion.button>
                                  <motion.button
                                    onClick={() => handleDelete(r.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50">
                  <p className="text-sm text-gray-500">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, displayRecords.length)} of {displayRecords.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-40"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </motion.button>
                    <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
                    <motion.button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-40"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single Record Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Attendance Record' : 'New Attendance Record'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Year *</label>
              <select value={formSY} onChange={e => { setFormSY(e.target.value); setFormSection(''); setFormStudent('') }} className="input-field" required>
                <option value="">Select School Year</option>
                {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.year_name}</option>)}
              </select>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
              <select value={formSection} onChange={e => { setFormSection(e.target.value); setFormStudent('') }} className="input-field" required>
                <option value="">Select Section</option>
                {formSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student *</label>
              <select value={formStudent} onChange={e => setFormStudent(e.target.value)} className="input-field" required>
                <option value="">Select Student</option>
                {formStudents.map(e => (
                  <option key={e.student_id} value={e.student_id}>
                    {e.students ? `${e.students.last_name}, ${e.students.first_name} (${e.students.lrn})` : e.student_id}
                  </option>
                ))}
              </select>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="input-field" required />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <motion.button
                    key={key}
                    type="button"
                    onClick={() => setFormStatus(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      formStatus === key
                        ? cfg.color + ' border-current shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <cfg.icon className="w-4 h-4" />
                    {cfg.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time In</label>
              <input type="time" value={formTimeIn} onChange={e => setFormTimeIn(e.target.value)} className="input-field" />
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea value={formRemarks} onChange={e => setFormRemarks(e.target.value)} className="input-field" rows={2} placeholder="Optional notes..." />
          </motion.div>
          <div className="flex justify-end gap-3 pt-2">
            <motion.button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Cancel</motion.button>
            <motion.button type="submit" disabled={saving} className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {saving ? 'Saving...' : editing ? 'Update Record' : 'Create Record'}
            </motion.button>
          </div>
        </form>
      </Modal>

      {/* Bulk Attendance Modal */}
      <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Attendance" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Year</label>
              <select value={bulkSY} onChange={e => { setBulkSY(e.target.value); setBulkSection(''); setBulkStudents([]) }} className="input-field">
                <option value="">Select</option>
                {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.year_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                value={bulkSection}
                onChange={e => { setBulkSection(e.target.value); loadBulkStudents(e.target.value) }}
                className="input-field"
              >
                <option value="">Select Section</option>
                {sections.filter(s => !bulkSY || s.school_year_id === bulkSY).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="input-field" />
            </div>
          </div>

          {bulkStudents.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{bulkStudents.length} students loaded</p>
                <div className="flex gap-2">
                  <button onClick={() => markAllAs('present')} className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition-colors">All Present</button>
                  <button onClick={() => markAllAs('absent')} className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors">All Absent</button>
                  <button onClick={() => markAllAs('late')} className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors">All Late</button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Student</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">LRN</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time In</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bulkStudents.map((s, i) => (
                      <motion.tr
                        key={s.student_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i, 15) * 0.03 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 font-mono">{s.lrn}</td>
                        <td className="px-4 py-2">
                          <select
                            value={s.status}
                            onChange={e => updateBulkStudent(i, 'status', e.target.value)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_CONFIG[s.status]?.color || 'bg-gray-100'}`}
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                            <option value="excused">Excused</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="time"
                            value={s.time_in}
                            onChange={e => updateBulkStudent(i, 'time_in', e.target.value)}
                            className="input-field text-xs py-1"
                          />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {bulkLoading && <div className="flex justify-center py-8"><LoadingSpinner /></div>}

          <div className="flex justify-end gap-3 pt-2">
            <motion.button onClick={() => setBulkModalOpen(false)} className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Cancel</motion.button>
            <motion.button
              onClick={handleBulkSave}
              disabled={saving || bulkStudents.length === 0}
              className="btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {saving ? 'Saving...' : `Save Attendance (${bulkStudents.length} students)`}
            </motion.button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
