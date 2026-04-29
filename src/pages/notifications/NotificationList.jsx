import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Trash2, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

export default function NotificationList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: rows } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  const handleDelete = async () => {
    setSaving(true)
    try { const { error } = await supabase.from('notifications').delete().eq('id', deleteId); if (error) throw error; toast.success('Deleted'); setDeleteOpen(false); fetchData() }
    catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  const columns = [
    { header: 'Title', accessor: 'title' },
    { header: 'Message', accessor: 'message' },
    { header: 'Type', accessor: 'type' },
    { header: 'Read', accessor: row => row.is_read ? 'Yes' : 'No' },
    { header: 'Date', accessor: row => row.created_at ? new Date(row.created_at).toLocaleDateString() : '-' },
    { header: 'Actions', cell: (row) => (
      <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => { setDeleteId(row.id); setDeleteOpen(true) }} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></motion.button>
    )},
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <PageHeader title="Notifications" subtitle="View system notifications" />
      <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}><DataTable columns={columns} data={data} loading={loading} /></motion.div>
      <ConfirmDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} loading={saving} />
    </motion.div>
  )
}
