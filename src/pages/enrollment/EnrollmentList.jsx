import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import StatsCard from '../../components/StatsCard'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, Eye, Pencil, Trash2, Users, Clock, CheckCircle, XCircle, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1 } },
}

const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
}

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  enrolled: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  dropped: { color: 'bg-red-100 text-red-800', icon: XCircle },
  transferred_out: { color: 'bg-purple-100 text-purple-800', icon: null },
  completed: { color: 'bg-blue-100 text-blue-800', icon: null },
}

export default function EnrollmentList() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterSY, setFilterSY] = useState('')
  const [gradeLevels, setGradeLevels] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, enrolled: 0, dropped: 0 })

  useEffect(() => {
    fetchData()
    fetchLookups()
  }, [filterStatus, filterGrade, filterSY])

  const fetchLookups = async () => {
    const [glRes, syRes] = await Promise.all([
      supabase.from('grade_levels').select('*').eq('is_active', true).order('level_order'),
      supabase.from('school_years').select('*').order('start_date', { ascending: false }),
    ])
    if (glRes.data) setGradeLevels(glRes.data)
    if (syRes.data) {
      setSchoolYears(syRes.data)
      const active = syRes.data.find(s => s.status === 'active' || s.is_current)
      if (active && !filterSY) setFilterSY(active.id)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    let query = supabase.from('enrollments').select('*, students(first_name, middle_name, last_name, lrn, gender), school_years(year_name), grade_levels(name), sections(name)').order('created_at', { ascending: false })

    if (filterStatus) query = query.eq('status', filterStatus)
    if (filterGrade) query = query.eq('grade_level_id', filterGrade)
    if (filterSY) query = query.eq('school_year_id', filterSY)

    const { data: rows, error } = await query
    if (error) { toast.error('Failed to load enrollments'); console.error(error) }
    else {
      setData(rows || [])
      const all = rows || []
      setStats({
        total: all.length,
        pending: all.filter(r => r.status === 'pending').length,
        enrolled: all.filter(r => r.status === 'enrolled').length,
        dropped: all.filter(r => r.status === 'dropped').length,
      })
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const { error } = await supabase.from('enrollments').delete().eq('id', deleteId)
      if (error) throw error
      toast.success('Enrollment deleted')
      fetchData()
    } catch (err) {
      toast.error('Failed to delete enrollment')
    }
    setDeleteOpen(false)
    setDeleteId(null)
  }

  const StatusBadge = ({ status }) => {
    const cfg = statusConfig[status] || { color: 'bg-gray-100 text-gray-700' }
    return (
      <motion.span
        className={'px-2.5 py-1 rounded-full text-xs font-semibold inline-block ' + cfg.color}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        {status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : 'Unknown'}
      </motion.span>
    )
  }

  const columns = [
    {
      header: 'LRN',
      accessor: (row) => row.students ? row.students.lrn || '-' : '-',
    },
    {
      header: 'Student Name',
      accessor: (row) => row.students ? row.students.last_name + ', ' + row.students.first_name + ' ' + (row.students.middle_name ? row.students.middle_name.charAt(0) + '.' : '') : '-',
    },
    {
      header: 'Grade Level',
      accessor: (row) => row.grade_levels ? row.grade_levels.name : '-',
    },
    {
      header: 'Section',
      accessor: (row) => row.sections ? row.sections.name : 'N/A',
    },
    {
      header: 'School Year',
      accessor: (row) => row.school_years ? row.school_years.year_name : '-',
    },
    {
      header: 'Type',
      accessor: 'enrollment_type',
      cell: (row) => (
        <span className="capitalize text-sm">{row.enrollment_type || '-'}</span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Date',
      accessor: 'enrollment_date',
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/enrollment/' + row.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
            <Eye className="w-4 h-4" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => navigate('/enrollment/' + row.id + '/edit')} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit">
            <Pencil className="w-4 h-4" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setDeleteId(row.id); setDeleteOpen(true) }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      ),
    },
  ]

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      <PageHeader title="Enrollment Management" subtitle="Manage student enrollments and registrations">
        <motion.button
          onClick={() => navigate('/enrollment/new')}
          className="btn-primary flex items-center gap-2"
          whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" /> New Enrollment
        </motion.button>
      </PageHeader>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={staggerItem}><StatsCard title="Total Enrollments" value={stats.total} icon={Users} color="blue" loading={loading} /></motion.div>
        <motion.div variants={staggerItem}><StatsCard title="Pending" value={stats.pending} icon={Clock} color="orange" loading={loading} /></motion.div>
        <motion.div variants={staggerItem}><StatsCard title="Enrolled" value={stats.enrolled} icon={CheckCircle} color="green" loading={loading} /></motion.div>
        <motion.div variants={staggerItem}><StatsCard title="Dropped" value={stats.dropped} icon={XCircle} color="red" loading={loading} /></motion.div>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="enrolled">Enrolled</option>
            <option value="dropped">Dropped</option>
            <option value="transferred_out">Transferred Out</option>
            <option value="completed">Completed</option>
          </select>
          <select className="input-field" value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
            <option value="">All Grade Levels</option>
            {gradeLevels.map(gl => (
              <option key={gl.id} value={gl.id}>{gl.name}</option>
            ))}
          </select>
          <select className="input-field" value={filterSY} onChange={e => setFilterSY(e.target.value)}>
            <option value="">All School Years</option>
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>{sy.year_name}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <DataTable columns={columns} data={data} loading={loading} />
      </motion.div>

      <ConfirmDialog isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        title="Delete Enrollment" message="Are you sure you want to delete this enrollment record? This action cannot be undone." />
    </motion.div>
  )
}
