import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import { Save, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const filterVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } },
}

const dropdownVariants = {
  initial: { opacity: 0, y: 10 },
  animate: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.15 + i * 0.08 } }),
}

const tableContainerVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.2 } },
}

const rowVariants = {
  initial: { opacity: 0, x: -10 },
  animate: (i) => ({ opacity: 1, x: 0, transition: { duration: 0.3, delay: Math.min(i, 10) * 0.05 } }),
}

export default function GradeEntry() {
  const [schoolYears, setSchoolYears] = useState([])
  const [sections, setSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [quarters, setQuarters] = useState([])
  const [students, setStudents] = useState([])
  const [components, setComponents] = useState([])
  const [scores, setScores] = useState({})
  const [filters, setFilters] = useState({ school_year_id: '', section_id: '', subject_id: '', quarter_id: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (filters.section_id) fetchStudents()
  }, [filters.section_id])

  useEffect(() => {
    if (filters.section_id && filters.subject_id && filters.quarter_id) fetchComponents()
  }, [filters.section_id, filters.subject_id, filters.quarter_id])

  const fetchInitialData = async () => {
    const [sy, sec, sub, q] = await Promise.all([
      supabase.from('school_years').select('*').order('start_date', { ascending: false }),
      supabase.from('sections').select('*, grade_levels(name)').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('quarters').select('*').order('quarter_number'),
    ])
    setSchoolYears(sy.data || [])
    setSections(sec.data || [])
    setSubjects(sub.data || [])
    setQuarters(q.data || [])
  }

  const fetchStudents = async () => {
    const { data } = await supabase.from('section_students').select('*, students(id, first_name, last_name, lrn)')
      .eq('section_id', filters.section_id).order('roll_number')
    setStudents(data || [])
  }

  const fetchComponents = async () => {
    setLoading(true)
    const { data: comps } = await supabase.from('grade_components').select('*')
      .eq('section_id', filters.section_id).eq('subject_id', filters.subject_id).eq('quarter_id', filters.quarter_id)
      .order('component_type').order('activity_number')
    setComponents(comps || [])
    
    if (comps?.length > 0) {
      const compIds = comps.map(c => c.id)
      const { data: sc } = await supabase.from('student_scores').select('*').in('grade_component_id', compIds)
      const scoreMap = {}
      ;(sc || []).forEach(s => { scoreMap[`${s.grade_component_id}_${s.student_id}`] = s })
      setScores(scoreMap)
    }
    setLoading(false)
  }

  const handleScoreChange = (componentId, studentId, value) => {
    const key = `${componentId}_${studentId}`
    setScores(prev => ({ ...prev, [key]: { ...prev[key], grade_component_id: componentId, student_id: studentId, score: parseFloat(value) || 0 } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const upserts = Object.values(scores).filter(s => s.grade_component_id && s.student_id)
      for (const s of upserts) {
        const { error } = await supabase.from('student_scores').upsert({
          grade_component_id: s.grade_component_id,
          student_id: s.student_id,
          score: s.score
        }, { onConflict: 'grade_component_id,student_id' })
        if (error) throw error
      }
      toast.success('Scores saved successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to save scores')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      <PageHeader title="Grade Entry" subtitle="Enter student grades by component" />
      
      <motion.div className="card mb-6" variants={filterVariants} initial="initial" animate="animate">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'School Year', value: filters.school_year_id, key: 'school_year_id', options: schoolYears.map(sy => ({ id: sy.id, label: sy.year_name })) },
            { label: 'Section', value: filters.section_id, key: 'section_id', options: sections.map(s => ({ id: s.id, label: `${s.grade_levels?.name} - ${s.name}` })) },
            { label: 'Subject', value: filters.subject_id, key: 'subject_id', options: subjects.map(s => ({ id: s.id, label: s.name })) },
            { label: 'Quarter', value: filters.quarter_id, key: 'quarter_id', options: quarters.map(q => ({ id: q.id, label: q.name })) },
          ].map((filter, i) => (
            <motion.div key={filter.key} variants={dropdownVariants} custom={i} initial="initial" animate="animate">
              <label className="block text-sm font-medium text-gray-700 mb-1">{filter.label}</label>
              <select value={filter.value} onChange={e => setFilters(p => ({...p, [filter.key]: e.target.value}))} className="input-field">
                <option value="">Select...</option>
                {filter.options.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-12">
            <LoadingSpinner />
          </motion.div>
        ) : students.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
            <EmptyState title="Select filters above" description="Choose school year, section, subject, and quarter to begin grading." icon={BookOpen} />
          </motion.div>
        ) : (
          <motion.div key="table" className="card" variants={tableContainerVariants} initial="initial" animate="animate">
            <div className="flex justify-between items-center mb-4">
              <motion.h3 className="font-semibold" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                {students.length} Students &bull; {components.length} Components
              </motion.h3>
              <motion.button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
                whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
                whileTap={{ scale: 0.98 }}
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Scores'}
              </motion.button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                    {components.map(c => (
                      <th key={c.id} className="px-3 py-2 text-center font-medium text-gray-500">
                        <div>{c.component_type}</div>
                        <div className="text-xs">#{c.activity_number} ({c.total_score})</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((ss, idx) => (
                    <motion.tr
                      key={ss.id}
                      className="hover:bg-gray-50"
                      variants={rowVariants}
                      custom={idx}
                      initial="initial"
                      animate="animate"
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{ss.students?.last_name}, {ss.students?.first_name}</td>
                      {components.map(c => {
                        const key = `${c.id}_${ss.students?.id}`
                        return (
                          <td key={c.id} className="px-3 py-2 text-center">
                            <motion.input
                              type="number" min="0" max={c.total_score} step="0.5"
                              value={scores[key]?.score ?? ''}
                              onChange={e => handleScoreChange(c.id, ss.students?.id, e.target.value)}
                              className="w-16 text-center border border-gray-300 rounded px-1 py-1 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                              whileFocus={{ scale: 1.05 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            />
                          </td>
                        )
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
