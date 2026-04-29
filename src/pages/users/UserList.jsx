import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const defaultForm = {'employee_id': '', 'first_name': '', 'last_name': '', 'email': '', 'phone': '', 'is_active': ''}

export default function UserList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [formData, setFormData] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: rows, error } = await supabase.from('user_profiles').select('*').order('last_name', { ascending: true })
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
      // Clean empty strings to null for optional fields
      Object.keys(submitData).forEach(k => { if (submitData[k] === '') submitData[k] = null })
      
      if (editing) {
        const { error } = await supabase.from('user_profiles').update(submitData).eq('id', editing.id)
        if (error) throw error
        toast.success('User updated successfully')
      } else {
        const { error } = await supabase.from('user_profiles').insert(submitData)
        if (error) throw error
        toast.success('User created successfully')
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
      const { error } = await supabase.from('user_profiles').delete().eq('id', deleteId)
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

  const columns = [
    { header: 'Employee ID', accessor: 'employee_id' },
    { header: 'Last Name', accessor: 'last_name' },
    { header: 'First Name', accessor: 'first_name' },
    { header: 'Email', accessor: 'email' },
    { header: 'Phone', accessor: 'phone' },
    { header: 'Active', accessor: row => row.is_active ? 'Yes' : 'No' },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => handleEdit(row)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4" /></motion.button>
          <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => { setDeleteId(row.id); setDeleteOpen(true) }} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></motion.button>
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
      <PageHeader title="Users & Roles" subtitle="Manage user accounts">
        <motion.button
          onClick={openNew}
          className="btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.03, boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" /> Add User
        </motion.button>
      </PageHeader>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable columns={columns} data={data} loading={loading} />
      </motion.div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Add User'} size="lg">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <input type="text" name="employee_id" value={formData.employee_id || ''} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" name="first_name" value={formData.first_name || ''} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" name="last_name" value={formData.last_name || ''} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" name="phone" value={formData.phone || ''} onChange={handleChange} className="input-field"  />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" name="is_active" checked={!!formData.is_active} onChange={e => setFormData(p => ({...p, [is_active]: e.target.checked}))} className="rounded" />
              <label className="text-sm font-medium text-gray-700">Active</label>
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
