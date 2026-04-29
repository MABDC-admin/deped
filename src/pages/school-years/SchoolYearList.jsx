import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import PromotionModal from './PromotionModal'
import { Plus, Pencil, Trash2, Play, CheckCircle, Archive, Users, Calendar, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  planned: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-amber-100 text-amber-700',
  archived: 'bg-gray-100 text-gray-500',
}

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const emptyForm = {
  year_name: '', description: '', start_date: '', end_date: '',
  enrollment_start: '', enrollment_end: '', status: 'planned', is_current: false,
}

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function SchoolYearList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [promotionYear, setPromotionYear] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: years, error } = await supabase
      .from('school_years')
      .select('*')
      .order('start_date', { ascending: false })
    if (error) { toast.error('Failed to load school years'); setLoading(false); return }

    const { data: counts } = await supabase
      .from('enrollments')
      .select('school_year_id')
    const countMap = {}
    ;(counts || []).forEach(e => { countMap[e.school_year_id] = (countMap[e.school_year_id] || 0) + 1 })
    setData((years || []).map(y => ({ ...y, enrollment_count: countMap[y.id] || 0 })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const activeYear = data.find(y => y.is_current)
  const today = new Date().toISOString().split('T')[0]
  const enrollmentActive = activeYear && activeYear.enrollment_start && activeYear.enrollment_end
    ? today >= activeYear.enrollment_start && today <= activeYear.enrollment_end : false

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModalOpen(true) }
  const openEdit = (row) => {
    setForm({
      year_name: row.year_name || '', description: row.description || '',
      start_date: row.start_date || '', end_date: row.end_date || '',
      enrollment_start: row.enrollment_start || '', enrollment_end: row.enrollment_end || '',
      status: row.status || 'planned', is_current: row.is_current || false,
    })
    setEditId(row.id)
    setModalOpen(true)
  }

  const setActiveSchoolYear = async (schoolYearId) => {
    const { error: deactivateError } = await supabase
      .from('school_years')
      .update({ is_current: false, status: 'completed' })
      .neq('id', schoolYearId)
      .or('is_current.eq.true,status.eq.active')

    if (deactivateError) return deactivateError

    const { error: activateError } = await supabase
      .from('school_years')
      .update({ is_current: true, status: 'active' })
      .eq('id', schoolYearId)

    return activateError
  }

  const handleSave = async () => {
    if (!form.year_name || !form.start_date || !form.end_date) { toast.error('Fill in required fields'); return }
    setSaving(true)
    const payload = { ...form, enrollment_start: form.enrollment_start || null, enrollment_end: form.enrollment_end || null, description: form.description || null }
    const shouldSetCurrent = payload.is_current
    const savePayload = shouldSetCurrent ? { ...payload, is_current: false } : payload
    let error
    let saved
    if (editId) {
      ;({ data: saved, error } = await supabase.from('school_years').update(savePayload).eq('id', editId).select('id').single())
    } else {
      ;({ data: saved, error } = await supabase.from('school_years').insert(savePayload).select('id').single())
    }
    if (!error && shouldSetCurrent && saved?.id) {
      error = await setActiveSchoolYear(saved.id)
    }
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'School year updated' : 'School year created')
    setModalOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('school_years').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('School year deleted')
    setDeleteId(null)
    fetchData()
  }

  const handleSetActive = (row) => {
    setConfirmAction({
      title: 'Set Active School Year',
      message: 'This will deactivate the current active school year and set "' + row.year_name + '" as active. Continue?',
      fn: async () => {
        setActionLoading(true)
        const error = await setActiveSchoolYear(row.id)
        setActionLoading(false)
        if (error) { toast.error(error.message); return }
        toast.success(row.year_name + ' is now the active school year')
        setConfirmAction(null)
        fetchData()
      }
    })
  }

  const handleComplete = (row) => {
    setConfirmAction({
      title: 'Complete School Year',
      message: 'Mark "' + row.year_name + '" as completed? You can still reactivate later.',
      fn: async () => {
        if (row.is_current) {
          toast.error('Activate another school year before completing the current one')
          setConfirmAction(null)
          return
        }
        setActionLoading(true)
        const { error } = await supabase.from('school_years').update({ status: 'completed', is_current: false }).eq('id', row.id)
        setActionLoading(false)
        if (error) { toast.error(error.message); return }
        toast.success(row.year_name + ' marked as completed')
        setConfirmAction(null)
        fetchData()
      }
    })
  }

  const handleArchive = (row) => {
    setConfirmAction({
      title: 'Archive School Year',
      message: 'Archived years become read-only. This cannot be undone.',
      fn: async () => {
        setActionLoading(true)
        const { error } = await supabase.rpc('archive_school_year', { p_school_year_id: row.id })
        setActionLoading(false)
        if (error) { toast.error(error.message); return }
        toast.success(row.year_name + ' archived')
        setConfirmAction(null)
        fetchData()
      }
    })
  }

  const columns = [
    {
      header: 'Year Name', accessor: 'year_name',
      cell: (row) => <span className="font-semibold text-gray-900">{row.year_name}</span>
    },
    {
      header: 'Period',
      accessor: (row) => formatDate(row.start_date) + ' — ' + formatDate(row.end_date)
    },
    {
      header: 'Enrollment Window',
      accessor: (row) => row.enrollment_start ? formatDate(row.enrollment_start) + ' — ' + formatDate(row.enrollment_end) : '—'
    },
    {
      header: 'Status', accessor: 'status',
      cell: (row) => (
        <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + (STATUS_COLORS[row.status] || '')}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Current', accessor: 'is_current',
      cell: (row) => row.is_current
        ? <span className="text-green-600 font-bold">✓</span>
        : <span className="text-gray-300">—</span>
    },
    { header: 'Enrollments', accessor: 'enrollment_count' },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => openEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
            <Pencil className="w-4 h-4" />
          </motion.button>
          {row.status !== 'archived' && !row.is_current && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleSetActive(row)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Set Active">
              <Play className="w-4 h-4" />
            </motion.button>
          )}
          {row.status === 'active' && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleComplete(row)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Complete">
              <CheckCircle className="w-4 h-4" />
            </motion.button>
          )}
          {row.status === 'completed' && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleArchive(row)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Archive">
              <Archive className="w-4 h-4" />
            </motion.button>
          )}
          {(row.status === 'completed' || row.status === 'active') && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setPromotionYear(row)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg" title="Promote Students">
              <Users className="w-4 h-4" />
            </motion.button>
          )}
          {row.enrollment_count === 0 && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setDeleteId(row.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
              <Trash2 className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      )
    },
  ]

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageVariants}
    >
      <PageHeader title="School Years" subtitle="Manage academic years, enrollment periods, and student promotions">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add School Year
        </motion.button>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="card p-4 flex items-center gap-3"
        >
          <div className="p-2 bg-blue-100 rounded-lg"><Calendar className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Total School Years</p>
            <p className="text-xl font-bold text-gray-900">{data.length}</p>
          </div>
        </motion.div>
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="card p-4 flex items-center gap-3"
        >
          <div className="p-2 bg-green-100 rounded-lg"><GraduationCap className="w-5 h-5 text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Active Year</p>
            <p className="text-xl font-bold text-green-700">{activeYear ? activeYear.year_name : 'None'}</p>
          </div>
        </motion.div>
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
          transition={{ type: 'spring', stiffness: 300 }}
          className="card p-4 flex items-center gap-3"
        >
          <div className={'p-2 rounded-lg ' + (enrollmentActive ? 'bg-green-100' : 'bg-gray-100')}>
            <Users className={'w-5 h-5 ' + (enrollmentActive ? 'text-green-600' : 'text-gray-400')} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Enrollment Period</p>
            <p className={'text-xl font-bold ' + (enrollmentActive ? 'text-green-700' : 'text-gray-400')}>
              {enrollmentActive ? 'Open' : 'Closed'}
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div variants={cardVariants} className="card">
        <DataTable columns={columns} data={data} loading={loading} />
      </motion.div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit School Year' : 'Add School Year'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year Name <span className="text-red-500">*</span></label>
            <input className="input-field" placeholder="2026-2027" value={form.year_name} onChange={e => setForm({ ...form, year_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
              <input type="date" className="input-field" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-red-500">*</span></label>
              <input type="date" className="input-field" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Start</label>
              <input type="date" className="input-field" value={form.enrollment_start} onChange={e => setForm({ ...form, enrollment_start: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment End</label>
              <input type="date" className="input-field" value={form.enrollment_end} onChange={e => setForm({ ...form, enrollment_end: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_current" checked={form.is_current} onChange={e => setForm({ ...form, is_current: e.target.checked })} className="rounded border-gray-300" />
            <label htmlFor="is_current" className="text-sm text-gray-700">Set as current school year</label>
          </div>
          {form.is_current && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">⚠ Only one school year can be current. Setting this will deactivate any other current year.</p>}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</motion.button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete School Year" message="Are you sure you want to delete this school year? This action cannot be undone." />

      {/* Action Confirms (Set Active, Complete, Archive) */}
      <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} title={confirmAction?.title || 'Confirm'} size="sm">
        <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
        <div className="flex justify-end gap-3">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setConfirmAction(null)} className="btn-secondary" disabled={actionLoading}>Cancel</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => confirmAction?.fn()} className="btn-primary" disabled={actionLoading}>{actionLoading ? 'Processing...' : 'Confirm'}</motion.button>
        </div>
      </Modal>

      {/* Promotion Modal */}
      <PromotionModal isOpen={!!promotionYear} onClose={() => { setPromotionYear(null); fetchData() }} schoolYear={promotionYear} />
    </motion.div>
  )
}
