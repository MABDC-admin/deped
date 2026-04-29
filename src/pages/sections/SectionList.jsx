import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const defaultForm = { name: '', school_year_id: '', grade_level_id: '', strand_id: '', room: '', max_capacity: '', adviser_id: '', is_active: true }

export default function SectionList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  // Dropdown data
  const [gradeLevels, setGradeLevels] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [teachers, setTeachers] = useState([])
  const [strands, setStrands] = useState([])

  // Filters
  const [filterGradeLevel, setFilterGradeLevel] = useState('all')
  const [filterStrand, setFilterStrand] = useState('all')

  useEffect(() => {
    fetchData()
    supabase.from('grade_levels').select('id, name, level_order, category').eq('is_active', true).order('level_order').then(({ data }) => setGradeLevels(data || []))
    supabase.from('school_years').select('id, year_name, is_current').order('is_current', { ascending: false }).then(({ data }) => setSchoolYears(data || []))
    supabase.from('user_profiles').select('id, first_name, last_name, role').eq('role', 'teacher').order('last_name').then(({ data }) => setTeachers(data || []))
    supabase.from('strands').select('id, name, short_name, track').eq('is_active', true).order('track').then(({ data }) => setStrands(data || []))
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('sections')
      .select('*, school_years(year_name), grade_levels(name, category), adviser:user_profiles!adviser_id(id, first_name, last_name), section_students(id), strands(short_name, name, track)')
      .order('name', { ascending: true })
    if (error) { toast.error('Failed to load data'); console.error(error) }
    else setData(rows || [])
    setLoading(false)
  }

  // Check if selected grade level is SHS
  const selectedGradeLevel = useMemo(() => gradeLevels.find(gl => gl.id === formData.grade_level_id), [gradeLevels, formData.grade_level_id])
  const isSHS = selectedGradeLevel?.category === 'senior_high'

  // Filter strands by track for display
  const strandsByTrack = useMemo(() => {
    const grouped = {}
    strands.forEach(s => {
      const track = s.track.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
      if (!grouped[track]) grouped[track] = []
      grouped[track].push(s)
    })
    return grouped
  }, [strands])

  // Check if any filtered grade level is SHS (for strand filter visibility)
  const filterGradeLevelObj = useMemo(() => gradeLevels.find(gl => gl.id === filterGradeLevel), [gradeLevels, filterGradeLevel])
  const showStrandFilter = filterGradeLevel === 'all' || filterGradeLevelObj?.category === 'senior_high'

  const filteredData = useMemo(() => {
    let result = data
    if (filterGradeLevel !== 'all') {
      result = result.filter(row => row.grade_level_id === filterGradeLevel)
    }
    if (filterStrand !== 'all') {
      result = result.filter(row => row.strand_id === filterStrand)
    }
    return result
  }, [data, filterGradeLevel, filterStrand])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      const next = { ...prev, [name]: value }
      // Clear strand when switching away from SHS
      if (name === 'grade_level_id') {
        const gl = gradeLevels.find(g => g.id === value)
        if (gl?.category !== 'senior_high') {
          next.strand_id = ''
        }
      }
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const submitData = { ...formData }
      // Clean empty strings to null for optional fields
      Object.keys(submitData).forEach(k => { if (submitData[k] === '') submitData[k] = null })

      if (editing) {
        const { error } = await supabase.from('sections').update(submitData).eq('id', editing.id)
        if (error) throw error
        toast.success('Section updated successfully')
      } else {
        const { error } = await supabase.from('sections').insert(submitData)
        if (error) throw error
        toast.success('Section created successfully')
      }
      setModalOpen(false)
      setEditing(null)
      setFormData(defaultForm)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (row) => {
    setEditing(row)
    const fd = {}
    Object.keys(defaultForm).forEach(k => fd[k] = row[k] ?? '')
    setFormData(fd)
    setModalOpen(true)
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('sections').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Deleted successfully')
      setDeleteOpen(false)
      setDeleteId(null)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const openNew = () => {
    setEditing(null)
    setFormData(defaultForm)
    setModalOpen(true)
  }

  const trackLabel = (track) => {
    const labels = { academic: 'Academic', tvl: 'TVL', sports: 'Sports', arts_and_design: 'Arts & Design' }
    return labels[track] || track
  }

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'School Year', accessor: row => row.school_years?.year_name || '-' },
    { header: 'Grade Level', accessor: row => row.grade_levels?.name || '-' },
    {
      header: 'Strand',
      accessor: row => row.strands
        ? <span className="inline-flex items-center gap-1">
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
              row.strands.track === 'academic' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
              row.strands.track === 'tvl' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
              row.strands.track === 'sports' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
              'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            }`}>{trackLabel(row.strands.track)}</span>
            <span className="font-medium">{row.strands.short_name}</span>
          </span>
        : row.grade_levels?.category === 'senior_high'
          ? <span className="text-xs text-gray-400 italic">Not set</span>
          : '-'
    },
    { header: 'Room', accessor: 'room' },
    { header: 'Capacity', accessor: 'max_capacity' },
    { header: 'Students', accessor: row => row.section_students?.length || 0 },
    { header: 'Adviser', accessor: row => row.adviser ? `${row.adviser.first_name} ${row.adviser.last_name}` : '-' },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"><Pencil className="w-4 h-4" /></motion.button>
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => { setDeleteId(row.id); setDeleteOpen(true) }} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4" /></motion.button>
        </div>
      )
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Sections" subtitle="Manage class sections">
        <motion.button
          onClick={openNew}
          className="btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.03, boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" /> Add Section
        </motion.button>
      </PageHeader>

      {/* Filters */}
      <motion.div
        className="mb-4 flex flex-wrap gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <select
          value={filterGradeLevel}
          onChange={e => { setFilterGradeLevel(e.target.value); setFilterStrand('all') }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Grade Levels</option>
          {gradeLevels.map(gl => (
            <option key={gl.id} value={gl.id}>{gl.name}</option>
          ))}
        </select>
        {showStrandFilter && strands.length > 0 && (
          <select
            value={filterStrand}
            onChange={e => setFilterStrand(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Strands</option>
            {Object.entries(strandsByTrack).map(([track, trackStrands]) => (
              <optgroup key={track} label={track}>
                {trackStrands.map(s => (
                  <option key={s.id} value={s.id}>{s.short_name} — {s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </motion.div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable columns={columns} data={filteredData} loading={loading} />
      </motion.div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Section' : 'Add Section'} size="lg">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section Name</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Year</label>
            <select name="school_year_id" value={formData.school_year_id || ''} onChange={handleChange} className="input-field" required>
              <option value="">Select School Year...</option>
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.year_name}{sy.is_current ? ' (Current)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grade Level</label>
            <select name="grade_level_id" value={formData.grade_level_id || ''} onChange={handleChange} className="input-field" required>
              <option value="">Select Grade Level...</option>
              {['kindergarten', 'elementary', 'junior_high', 'senior_high'].map(cat => {
                const items = gradeLevels.filter(gl => gl.category === cat)
                if (!items.length) return null
                const label = cat === 'kindergarten' ? 'Kindergarten' : cat === 'elementary' ? 'Elementary' : cat === 'junior_high' ? 'Junior High' : 'Senior High'
                return (
                  <optgroup key={cat} label={label}>
                    {items.map(gl => <option key={gl.id} value={gl.id}>{gl.name}</option>)}
                  </optgroup>
                )
              })}
            </select>
          </div>
          {isSHS && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Strand / Track <span className="text-red-500">*</span>
              </label>
              <select name="strand_id" value={formData.strand_id || ''} onChange={handleChange} className="input-field" required>
                <option value="">Select Strand...</option>
                {Object.entries(strandsByTrack).map(([track, trackStrands]) => (
                  <optgroup key={track} label={track}>
                    {trackStrands.map(s => (
                      <option key={s.id} value={s.id}>{s.short_name} — {s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {formData.strand_id && (
                <p className="text-xs text-gray-500 mt-1">
                  {strands.find(s => s.id === formData.strand_id)?.name}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Room</label>
            <input type="text" name="room" value={formData.room || ''} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Capacity</label>
            <input type="number" name="max_capacity" value={formData.max_capacity || ''} onChange={handleChange} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adviser</label>
            <select name="adviser_id" value={formData.adviser_id || ''} onChange={handleChange} className="input-field">
              <option value="">Select Adviser (optional)...</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="is_active" checked={!!formData.is_active} onChange={e => setFormData(p => ({ ...p, 'is_active': e.target.checked }))} className="rounded" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <div className="col-span-2 flex justify-end gap-3 mt-4">
            <motion.button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>Cancel</motion.button>
            <motion.button type="submit" disabled={saving} className="btn-primary" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </motion.button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} loading={saving} />
    </motion.div>
  )
}
