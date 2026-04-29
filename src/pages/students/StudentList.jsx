import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  Plus, Pencil, Trash2, Eye, Users, Search, Filter, X,
  UserCheck, UserX, GraduationCap, ArrowRightLeft,
  ChevronLeft, ChevronRight, ArrowUpDown, LayoutGrid, List
} from 'lucide-react'
import toast from 'react-hot-toast'

const defaultForm = { lrn: '', first_name: '', middle_name: '', last_name: '', suffix: '', gender: '', birth_date: '', contact_number: '', email: '', status: 'active' }

const STATUS_CONFIG = {
  active: { color: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500', icon: UserCheck, label: 'Active' },
  inactive: { color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400', icon: UserX, label: 'Inactive' },
  graduated: { color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500', icon: GraduationCap, label: 'Graduated' },
  transferred: { color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500', icon: ArrowRightLeft, label: 'Transferred' },
}

const AVATAR_COLORS = [
  'from-blue-400 to-indigo-500',
  'from-green-400 to-emerald-500',
  'from-purple-400 to-violet-500',
  'from-pink-400 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-teal-500',
  'from-red-400 to-pink-500',
  'from-indigo-400 to-purple-500',
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ firstName, lastName, size = 'sm' }) {
  const initials = ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase()
  const color = getAvatarColor(firstName + lastName)
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  )
}

function AnimatedCounter({ value }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = value || 0
    const step = Math.max(1, Math.ceil(end / 30))
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setDisplay(end); clearInterval(timer) }
      else setDisplay(start)
    }, 20)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}</span>
}

const formFieldVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 } }),
}

const tableRowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.04, duration: 0.25 } }),
}

export default function StudentList() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('table') // table | grid
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const pageSize = 15

  useEffect(() => {
    const loadAll = async () => {
      const [studRes, glRes, secRes] = await Promise.all([
        supabase.from('students').select('*, enrollments(status, grade_levels(id, name), sections(id, name))').order('last_name'),
        supabase.from('grade_levels').select('id, name, level_order').order('level_order'),
        supabase.from('sections').select('id, name, grade_level_id').order('name'),
      ])
      if (studRes.error) toast.error('Failed to load students')
      setData(studRes.data || [])
      setGradeLevels(glRes.data || [])
      setSections(secRes.data || [])
      setLoading(false)
    }
    loadAll()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('students')
      .select('*, enrollments(status, grade_levels(id, name), sections(id, name))')
      .order('last_name')
    if (error) toast.error('Failed to load data')
    else setData(rows || [])
    setLoading(false)
  }

  const getLatestEnrollment = (row) => {
    if (!row.enrollments || row.enrollments.length === 0) return null
    return row.enrollments[0]
  }

  // Filtered + sorted data
  const filteredData = useMemo(() => {
    let result = [...data]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r => {
        const name = `${r.last_name} ${r.first_name} ${r.middle_name || ''}`.toLowerCase()
        return name.includes(q) || (r.lrn || '').toLowerCase().includes(q)
      })
    }
    if (filterStatus) result = result.filter(r => r.status === filterStatus)
    if (filterGender) result = result.filter(r => r.gender === filterGender)
    if (filterGrade) {
      result = result.filter(r => {
        const enr = getLatestEnrollment(r)
        return enr?.grade_levels?.id === filterGrade
      })
    }
    if (filterSection) {
      result = result.filter(r => {
        const enr = getLatestEnrollment(r)
        return enr?.sections?.id === filterSection
      })
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') cmp = (a.last_name || '').localeCompare(b.last_name || '')
      else if (sortCol === 'lrn') cmp = (a.lrn || '').localeCompare(b.lrn || '')
      else if (sortCol === 'grade') {
        const ea = getLatestEnrollment(a)?.grade_levels?.name || ''
        const eb = getLatestEnrollment(b)?.grade_levels?.name || ''
        cmp = ea.localeCompare(eb, undefined, { numeric: true })
      }
      else if (sortCol === 'status') cmp = (a.status || '').localeCompare(b.status || '')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [data, search, filterStatus, filterGender, filterGrade, filterSection, sortCol, sortDir])

  const totalPages = Math.ceil(filteredData.length / pageSize)
  const pagedData = filteredData.slice((page - 1) * pageSize, page * pageSize)

  // Stats
  const stats = useMemo(() => ({
    total: data.length,
    active: data.filter(s => s.status === 'active').length,
    inactive: data.filter(s => s.status === 'inactive').length,
    graduated: data.filter(s => s.status === 'graduated').length,
    transferred: data.filter(s => s.status === 'transferred').length,
  }), [data])

  const filteredSections = useMemo(() => {
    if (!filterGrade) return sections
    return sections.filter(s => s.grade_level_id === filterGrade)
  }, [sections, filterGrade])

  const hasFilters = filterGrade || filterSection || filterStatus || filterGender

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const submitData = { ...formData }
      Object.keys(submitData).forEach(k => { if (submitData[k] === '') submitData[k] = null })
      if (editing) {
        const { error } = await supabase.from('students').update(submitData).eq('id', editing.id)
        if (error) throw error
        toast.success('Student updated!')
      } else {
        const { error } = await supabase.from('students').insert(submitData)
        if (error) throw error
        toast.success('Student added!')
      }
      setModalOpen(false)
      setEditing(null)
      setFormData(defaultForm)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  const handleEdit = (row) => {
    setEditing(row)
    setFormData({
      lrn: row.lrn || '', first_name: row.first_name || '', middle_name: row.middle_name || '',
      last_name: row.last_name || '', suffix: row.suffix || '', gender: row.gender || '',
      birth_date: row.birth_date || '', contact_number: row.contact_number || '',
      email: row.email || '', status: row.status || 'active',
    })
    setModalOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const { error } = await supabase.from('students').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Student deleted')
      fetchData()
    } catch (err) { toast.error('Failed to delete') }
    setDeleteOpen(false)
    setDeleteId(null)
  }

  const formFields = [
    { label: 'LRN', name: 'lrn', type: 'input', maxLength: 12 },
    { label: 'First Name', name: 'first_name', type: 'input', required: true },
    { label: 'Middle Name', name: 'middle_name', type: 'input' },
    { label: 'Last Name', name: 'last_name', type: 'input', required: true },
    { label: 'Suffix', name: 'suffix', type: 'input', placeholder: 'Jr., III' },
    { label: 'Gender', name: 'gender', type: 'select', required: true, options: [{ value: '', label: 'Select' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }] },
    { label: 'Date of Birth', name: 'birth_date', type: 'date' },
    { label: 'Contact Number', name: 'contact_number', type: 'input' },
    { label: 'Email', name: 'email', type: 'email' },
    { label: 'Status', name: 'status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'graduated', label: 'Graduated' }, { value: 'transferred', label: 'Transferred' }] },
  ]

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-20">
        <LoadingSpinner />
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <PageHeader title="Students" subtitle={`${data.length} total students enrolled`}>
        <motion.button
          onClick={() => { setEditing(null); setFormData(defaultForm); setModalOpen(true) }}
          className="btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" /> Add Student
        </motion.button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'Active', value: stats.active, icon: UserCheck, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Inactive', value: stats.inactive, icon: UserX, color: 'text-gray-500', bg: 'bg-gray-50' },
          { label: 'Graduated', value: stats.graduated, icon: GraduationCap, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Transferred', value: stats.transferred, icon: ArrowRightLeft, color: 'text-purple-700', bg: 'bg-purple-50' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className={`${s.bg} rounded-xl border p-3 cursor-pointer transition-all ${filterStatus === s.label.toLowerCase() && s.label !== 'Total' ? 'ring-2 ring-blue-400' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2, shadow: 'lg' }}
            onClick={() => {
              if (s.label === 'Total') setFilterStatus('')
              else setFilterStatus(f => f === s.label.toLowerCase() ? '' : s.label.toLowerCase())
              setPage(1)
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}><AnimatedCounter value={s.value} /></p>
              </div>
              <s.icon className={`w-5 h-5 ${s.color} opacity-40`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search + Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or LRN..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input-field pl-10 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showFilters || hasFilters ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
          </motion.button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <motion.button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
              whileTap={{ scale: 0.95 }}
            >
              <List className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
              whileTap={{ scale: 0.95 }}
            >
              <LayoutGrid className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="bg-white rounded-xl border shadow-sm p-4 mb-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Grade Level</label>
                <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setFilterSection(''); setPage(1) }} className="input-field text-sm">
                  <option value="">All Grades</option>
                  {gradeLevels.map(gl => <option key={gl.id} value={gl.id}>{gl.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Section</label>
                <select value={filterSection} onChange={e => { setFilterSection(e.target.value); setPage(1) }} className="input-field text-sm">
                  <option value="">All Sections</option>
                  {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="input-field text-sm">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="transferred">Transferred</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Gender</label>
                <select value={filterGender} onChange={e => { setFilterGender(e.target.value); setPage(1) }} className="input-field text-sm">
                  <option value="">All</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setFilterGrade(''); setFilterSection(''); setFilterStatus(''); setFilterGender(''); setPage(1) }}
                className="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <p className="text-sm text-gray-500 mb-3">{filteredData.length} student{filteredData.length !== 1 ? 's' : ''} found</p>

      <AnimatePresence mode="wait">
        {viewMode === 'table' ? (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-xl border shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
                    {[
                      { key: 'name', label: 'Student Name' },
                      { key: 'lrn', label: 'LRN' },
                      { key: 'grade', label: 'Grade & Section' },
                      { key: null, label: 'Gender' },
                      { key: 'status', label: 'Status' },
                      { key: null, label: 'Actions' },
                    ].map((col) => (
                      <th
                        key={col.label}
                        onClick={() => col.key && toggleSort(col.key)}
                        className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {col.key && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {pagedData.map((row, ri) => {
                      const enr = getLatestEnrollment(row)
                      const sc = STATUS_CONFIG[row.status] || STATUS_CONFIG.active
                      return (
                        <motion.tr
                          key={row.id}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          custom={ri}
                          className="cursor-pointer hover:bg-blue-50/50 active:bg-blue-100/50 transition-colors"
                          onClick={(e) => {
                            if (e.target.closest('.action-cell')) return
                            navigate('/students/' + row.id)
                          }}
                        >
                          <td className="px-4 py-2.5">
                            <Avatar firstName={row.first_name} lastName={row.last_name} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {row.last_name}, {row.first_name} {row.middle_name ? row.middle_name.charAt(0) + '.' : ''}
                                {row.suffix ? ' ' + row.suffix : ''}
                              </p>
                              <p className="text-xs text-gray-400">{row.email || ''}</p>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{row.lrn || '-'}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-600">
                            {enr?.grade_levels?.name || '-'}
                            {enr?.sections?.name ? <span className="text-gray-400"> · {enr.sections.name}</span> : ''}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-600">{row.gender || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 action-cell">
                            <div className="flex items-center gap-1">
                              <motion.button onClick={() => navigate('/students/' + row.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Eye className="w-3.5 h-3.5" /></motion.button>
                              <motion.button onClick={(e) => { e.stopPropagation(); handleEdit(row) }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Pencil className="w-3.5 h-3.5" /></motion.button>
                              <motion.button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); setDeleteOpen(true) }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Trash2 className="w-3.5 h-3.5" /></motion.button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50">
                <p className="text-sm text-gray-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredData.length)} of {filteredData.length}</p>
                <div className="flex items-center gap-2">
                  <motion.button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-40" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><ChevronLeft className="w-4 h-4" /></motion.button>
                  <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
                  <motion.button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border hover:bg-white disabled:opacity-40" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><ChevronRight className="w-4 h-4" /></motion.button>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* Grid View */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {pagedData.map((row, ri) => {
              const enr = getLatestEnrollment(row)
              const sc = STATUS_CONFIG[row.status] || STATUS_CONFIG.active
              return (
                <motion.div
                  key={row.id}
                  className="bg-white rounded-xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(ri, 12) * 0.04 }}
                  whileHover={{ y: -3 }}
                  onClick={() => navigate('/students/' + row.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Avatar firstName={row.first_name} lastName={row.last_name} size="md" />
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {row.last_name}, {row.first_name}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{row.lrn || 'No LRN'}</p>
                  <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-gray-500">
                    <span>{enr?.grade_levels?.name || '-'}</span>
                    <span>{enr?.sections?.name || '-'}</span>
                  </div>
                  <div className="mt-2 flex justify-end gap-1">
                    <motion.button onClick={(e) => { e.stopPropagation(); handleEdit(row) }} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Pencil className="w-3.5 h-3.5" /></motion.button>
                    <motion.button onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); setDeleteOpen(true) }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}><Trash2 className="w-3.5 h-3.5" /></motion.button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid pagination */}
      {viewMode === 'grid' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <motion.button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border hover:bg-white disabled:opacity-40" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><ChevronLeft className="w-4 h-4" /></motion.button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <motion.button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border hover:bg-white disabled:opacity-40" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><ChevronRight className="w-4 h-4" /></motion.button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} title={editing ? 'Edit Student' : 'Add Student'} size="lg">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formFields.map((field, i) => (
              <motion.div key={field.name} custom={i} variants={formFieldVariants} initial="hidden" animate="visible">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select name={field.name} className="input-field" required={field.required} value={formData[field.name]} onChange={handleChange}>
                    {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input name={field.name} type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'} className="input-field" required={field.required} maxLength={field.maxLength} placeholder={field.placeholder} value={formData[field.name]} onChange={handleChange} />
                )}
              </motion.div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <motion.button type="button" onClick={() => { setModalOpen(false); setEditing(null) }} className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Cancel</motion.button>
            <motion.button type="submit" disabled={saving} className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Student'}</motion.button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} title="Delete Student" message="Are you sure? This action cannot be undone." />
    </motion.div>
  )
}
