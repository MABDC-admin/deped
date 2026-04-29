import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import DataTable from '../../components/DataTable'
import PageHeader from '../../components/PageHeader'
import { ArrowRight, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_COLORS = {
  promoted: 'bg-green-100 text-green-700',
  retained: 'bg-amber-100 text-amber-700',
  graduated: 'bg-blue-100 text-blue-700',
  transferred: 'bg-purple-100 text-purple-700',
  manual: 'bg-gray-100 text-gray-600',
}

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function PromotionHistory() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [schoolYears, setSchoolYears] = useState([])
  const [filterYear, setFilterYear] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    supabase.from('school_years').select('id, year_name').order('start_date', { ascending: false })
      .then(({ data }) => setSchoolYears(data || []))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('student_promotions')
      .select('*, students(first_name, last_name, lrn), from_grade:grade_levels!from_grade_level_id(name), to_grade:grade_levels!to_grade_level_id(name), from_year:school_years!from_school_year_id(year_name), to_year:school_years!to_school_year_id(year_name), promoter:user_profiles!promoted_by(first_name, last_name)')
      .order('promoted_at', { ascending: false })

    if (filterYear) {
      query = query.or('from_school_year_id.eq.' + filterYear + ',to_school_year_id.eq.' + filterYear)
    }
    if (filterType) {
      query = query.eq('promotion_type', filterType)
    }

    const { data, error } = await query
    if (error) { toast.error('Failed to load promotion history'); console.error(error) }
    setData(data || [])
    setLoading(false)
  }, [filterYear, filterType])

  useEffect(() => { fetchData() }, [fetchData])

  const columns = [
    {
      header: 'Student',
      accessor: (row) => row.students ? row.students.last_name + ', ' + row.students.first_name : 'Unknown',
      cell: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.students ? row.students.last_name + ', ' + row.students.first_name : 'Unknown'}</p>
          {row.students?.lrn && <p className="text-xs text-gray-400">LRN: {row.students.lrn}</p>}
        </div>
      )
    },
    {
      header: 'Grade Transition',
      accessor: (row) => (row.from_grade?.name || '?') + ' → ' + (row.to_grade?.name || '?'),
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <span>{row.from_grade?.name || '?'}</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="font-medium text-purple-700">{row.to_grade?.name || '?'}</span>
        </div>
      )
    },
    {
      header: 'Year Transition',
      accessor: (row) => (row.from_year?.year_name || '?') + ' → ' + (row.to_year?.year_name || '?'),
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <span>{row.from_year?.year_name || '?'}</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="font-medium">{row.to_year?.year_name || '?'}</span>
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'promotion_type',
      cell: (row) => (
        <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + (TYPE_COLORS[row.promotion_type] || '')}>
          {row.promotion_type}
        </span>
      )
    },
    {
      header: 'Promoted By',
      accessor: (row) => row.promoter ? row.promoter.first_name + ' ' + row.promoter.last_name : '—'
    },
    {
      header: 'Date',
      accessor: (row) => formatDate(row.promoted_at)
    },
  ]

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={pageVariants}
    >
      <PageHeader title="Promotion History" subtitle="View student promotion and retention records" />

      {/* Filters */}
      <motion.div variants={cardVariants} whileHover={{ y: -1, boxShadow: '0 4px 15px rgba(0,0,0,0.06)' }} className="card p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <div>
            <select className="input-field text-sm py-1.5" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="">All School Years</option>
              {schoolYears.map(y => (
                <option key={y.id} value={y.id}>{y.year_name}</option>
              ))}
            </select>
          </div>
          <div>
            <select className="input-field text-sm py-1.5" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="promoted">Promoted</option>
              <option value="retained">Retained</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <AnimatePresence>
            {(filterYear || filterType) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setFilterYear(''); setFilterType('') }}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Clear filters
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div variants={cardVariants} className="card">
        <DataTable columns={columns} data={data} loading={loading} />
      </motion.div>
    </motion.div>
  )
}
