import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

const defaultForm = { name: '', short_name: '', level_order: '', category: '', is_active: true }

export default function GradeLevelList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  // Subject assignment state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false)
  const [subjectGradeLevel, setSubjectGradeLevel] = useState(null)
  const [allSubjects, setAllSubjects] = useState([])
  const [assignedSubjectIds, setAssignedSubjectIds] = useState(new Set())
  const [originalAssignedIds, setOriginalAssignedIds] = useState(new Set())
  const [assignedMap, setAssignedMap] = useState({}) // subject_id -> grade_level_subjects row id
  const [savingSubjects, setSavingSubjects] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('grade_levels')
      .select('*, grade_level_subjects(id)')
      .order('level_order', { ascending: true })
    if (error) { toast.error('Failed to load data'); console.error(error) }
    else setData(rows || [])
    setLoading(false)
  }

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const submitData = { ...formData }
      Object.keys(submitData).forEach(k => { if (submitData[k] === '') submitData[k] = null })

      if (editing) {
        const { error } = await supabase.from('grade_levels').update(submitData).eq('id', editing.id)
        if (error) throw error
        toast.success('Grade Level updated successfully')
      } else {
        const { error } = await supabase.from('grade_levels').insert(submitData)
        if (error) throw error
        toast.success('Grade Level created successfully')
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
      const { error } = await supabase.from('grade_levels').delete().eq('id', deleteId)
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

  // --- Subject Assignment ---
  const openSubjectModal = async (row) => {
    setSubjectGradeLevel(row)
    setSubjectModalOpen(true)
    setSavingSubjects(false)

    // Fetch all subjects
    const { data: subjects } = await supabase.from('subjects').select('id, name, short_name').order('name')
    setAllSubjects(subjects || [])

    // Fetch currently assigned subjects for this grade level
    const { data: assigned } = await supabase
      .from('grade_level_subjects')
      .select('id, subject_id')
      .eq('grade_level_id', row.id)

    const ids = new Set((assigned || []).map(a => a.subject_id))
    const map = {}
    ;(assigned || []).forEach(a => { map[a.subject_id] = a.id })
    setAssignedSubjectIds(ids)
    setOriginalAssignedIds(new Set(ids))
    setAssignedMap(map)
  }

  const toggleSubject = (subjectId) => {
    setAssignedSubjectIds(prev => {
      const next = new Set(prev)
      if (next.has(subjectId)) next.delete(subjectId)
      else next.add(subjectId)
      return next
    })
  }

  const saveSubjectAssignments = async () => {
    if (!subjectGradeLevel) return
    setSavingSubjects(true)
    try {
      const toInsert = []
      const toDelete = []

      // Find newly added
      for (const sid of assignedSubjectIds) {
        if (!originalAssignedIds.has(sid)) {
          toInsert.push({ grade_level_id: subjectGradeLevel.id, subject_id: sid })
        }
      }

      // Find removed
      for (const sid of originalAssignedIds) {
        if (!assignedSubjectIds.has(sid)) {
          toDelete.push(assignedMap[sid])
        }
      }

      if (toDelete.length > 0) {
        const { error } = await supabase.from('grade_level_subjects').delete().in('id', toDelete)
        if (error) throw error
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('grade_level_subjects').insert(toInsert)
        if (error) throw error
      }

      toast.success('Subject assignments updated')
      setSubjectModalOpen(false)
      setSubjectGradeLevel(null)
      fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed to save subject assignments')
    } finally {
      setSavingSubjects(false)
    }
  }

  const columns = [
    { header: 'Name', accessor: 'name' },
    { header: 'Short Name', accessor: 'short_name' },
    { header: 'Order', accessor: 'level_order' },
    { header: 'Category', accessor: 'category' },
    { header: 'Subjects', accessor: row => row.grade_level_subjects?.length || 0 },
    { header: 'Active', accessor: row => row.is_active ? 'Yes' : 'No' },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => openSubjectModal(row)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded" title="Assign Subjects">
            <BookOpen className="w-4 h-4" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded">
            <Pencil className="w-4 h-4" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => { setDeleteId(row.id); setDeleteOpen(true) }} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      )
    },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <PageHeader title="Grade Levels" subtitle="Manage grade levels">
        <motion.button whileHover={{ scale: 1.03, boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }} whileTap={{ scale: 0.97 }} onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Grade Level
        </motion.button>
      </PageHeader>

      <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <DataTable columns={columns} data={data} loading={loading} />
      </motion.div>

      {/* CRUD Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Grade Level' : 'Add Grade Level'} size="lg">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grade Level Name</label>
            <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short Name</label>
            <input type="text" name="short_name" value={formData.short_name || ''} onChange={handleChange} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level Order</label>
            <input type="number" name="level_order" value={formData.level_order || ''} onChange={handleChange} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select name="category" value={formData.category || ''} onChange={handleChange} className="input-field" required>
              <option value="">Select...</option>
              <option value="kindergarten">Kindergarten</option>
              <option value="elementary">Elementary</option>
              <option value="junior_high">Junior High School</option>
              <option value="senior_high">Senior High School</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="is_active" checked={!!formData.is_active} onChange={e => setFormData(p => ({ ...p, 'is_active': e.target.checked }))} className="rounded" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <div className="col-span-2 flex justify-end gap-3 mt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <motion.button whileHover={{ scale: 1.03, boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }} whileTap={{ scale: 0.97 }} type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </motion.button>
          </div>
        </form>
      </Modal>

      {/* Subject Assignment Modal */}
      <Modal isOpen={subjectModalOpen} onClose={() => setSubjectModalOpen(false)} title={`Assign Subjects — ${subjectGradeLevel?.name || ''}`} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select the subjects to assign to this grade level. ({assignedSubjectIds.size} selected)
          </p>
          <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
            {allSubjects.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">No subjects found. Create subjects first.</p>
            ) : (
              allSubjects.map(subject => (
                <label key={subject.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={assignedSubjectIds.has(subject.id)}
                    onChange={() => toggleSubject(subject.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{subject.name}</span>
                  {subject.short_name && <span className="text-xs text-gray-400">({subject.short_name})</span>}
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setSubjectModalOpen(false)} className="btn-secondary">Cancel</button>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={saveSubjectAssignments}
              disabled={savingSubjects}
              className="btn-primary"
            >
              {savingSubjects ? 'Saving...' : 'Save Assignments'}
            </motion.button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} loading={saving} />
    </motion.div>
  )
}
