import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { Save, School } from 'lucide-react'
import toast from 'react-hot-toast'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
}

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
}

export default function SchoolInfo() {
  const [info, setInfo] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInfo()
  }, [])

  const fetchInfo = async () => {
    const { data, error } = await supabase.from('school_info').select('*').limit(1).single()
    if (data) setInfo(data)
    setLoading(false)
  }

  const handleChange = (e) => {
    setInfo(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (info.id) {
        const { error } = await supabase.from('school_info').update(info).eq('id', info.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('school_info').insert(info)
        if (error) throw error
      }
      toast.success('School info saved successfully')
      fetchInfo()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <PageHeader title="School Information" subtitle="Manage school details">
        <motion.button whileHover={{ scale: 1.03, boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }} whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
        </motion.button>
      </PageHeader>
      <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
            <input name="school_name" value={info.school_name || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">School ID</label>
            <input name="school_id" value={info.school_id || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
            <input name="division" value={info.division || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <input name="district" value={info.district || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <input name="region" value={info.region || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
            <input name="contact_number" value={info.contact_number || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" value={info.email || ''} onChange={handleChange} className="input-field" type="email" />
          </motion.div>
          <motion.div variants={fieldVariants}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Principal</label>
            <input name="principal_name" value={info.principal_name || ''} onChange={handleChange} className="input-field" />
          </motion.div>
          <motion.div variants={fieldVariants} className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea name="address" value={info.address || ''} onChange={handleChange} className="input-field" rows="3" />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
