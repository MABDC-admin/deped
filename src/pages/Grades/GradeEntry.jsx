import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Save, BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
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

const DEFAULT_WEIGHTS = { written_work: 0.30, performance_task: 0.50, quarterly_assessment: 0.20 }
const SCIENCE_MATH_WEIGHTS = { written_work: 0.40, performance_task: 0.40, quarterly_assessment: 0.20 }
const MAPEH_WEIGHTS = { written_work: 0.20, performance_task: 0.60, quarterly_assessment: 0.20 }
const emptyComponentForm = {
  teacher_id: '',
  component_type: 'written_work',
  activity_name: '',
  activity_number: 1,
  total_score: 100,
}

function getWeights(subject) {
  if (subject?.subject_group === 'science_math') return SCIENCE_MATH_WEIGHTS
  if (subject?.subject_group === 'mapeh') return MAPEH_WEIGHTS
  return DEFAULT_WEIGHTS
}

function buildComponentTotals(components, scores, studentId, weights) {
  const totals = {
    written_work: { score: 0, hps: 0 },
    performance_task: { score: 0, hps: 0 },
    quarterly_assessment: { score: 0, hps: 0 },
  }

  components.forEach(component => {
    const type = component.component_type
    if (!totals[type]) return
    const key = `${component.id}_${studentId}`
    totals[type].score += Number(scores[key]?.score || 0)
    totals[type].hps += Number(component.total_score || 0)
  })

  const computed = {}
  Object.entries(totals).forEach(([type, total]) => {
    const percentage = total.hps > 0 ? (total.score / total.hps) * 100 : 0
    computed[type] = {
      ...total,
      percentage,
      weighted: percentage * (weights[type] || 0),
    }
  })

  return computed
}

export default function GradeEntry() {
  const [schoolYears, setSchoolYears] = useState([])
  const [sections, setSections] = useState([])
  const [subjects, setSubjects] = useState([])
  const [quarters, setQuarters] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [components, setComponents] = useState([])
  const [scores, setScores] = useState({})
  const [filters, setFilters] = useState({ school_year_id: '', section_id: '', subject_id: '', quarter_id: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [componentForm, setComponentForm] = useState(emptyComponentForm)
  const [componentEditId, setComponentEditId] = useState(null)
  const [componentModalOpen, setComponentModalOpen] = useState(false)
  const [componentSaving, setComponentSaving] = useState(false)
  const [deleteComponentId, setDeleteComponentId] = useState(null)
  const [componentDeleting, setComponentDeleting] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (filters.section_id) fetchStudents()
    else setStudents([])
  }, [filters.section_id])

  useEffect(() => {
    if (filters.section_id && filters.subject_id && filters.quarter_id) fetchComponents()
    else { setComponents([]); setScores({}) }
  }, [filters.section_id, filters.subject_id, filters.quarter_id])

  const fetchInitialData = async () => {
    const [sy, sec, sub, q, teacherRes] = await Promise.all([
      supabase.from('school_years').select('*').order('start_date', { ascending: false }),
      supabase.from('sections').select('*, grade_levels(name)').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('quarters').select('*').order('quarter_number'),
      supabase.from('user_profiles').select('id, first_name, last_name').eq('role', 'teacher').order('last_name'),
    ])
    setSchoolYears(sy.data || [])
    setSections(sec.data || [])
    setSubjects(sub.data || [])
    setQuarters(q.data || [])
    setTeachers(teacherRes.data || [])
    const active = (sy.data || []).find(s => s.status === 'active' || s.is_current)
    if (active) setFilters(prev => ({ ...prev, school_year_id: active.id }))
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

  const canManageComponents = filters.section_id && filters.subject_id && filters.quarter_id

  const openAddComponent = () => {
    if (!canManageComponents) {
      toast.error('Select section, subject, and quarter first')
      return
    }
    setComponentForm({
      ...emptyComponentForm,
      teacher_id: teachers[0]?.id || '',
      activity_number: components.length + 1,
    })
    setComponentEditId(null)
    setComponentModalOpen(true)
  }

  const openEditComponent = (component) => {
    setComponentForm({
      teacher_id: component.teacher_id || '',
      component_type: component.component_type || 'written_work',
      activity_name: component.activity_name || '',
      activity_number: component.activity_number || 1,
      total_score: component.total_score || 100,
    })
    setComponentEditId(component.id)
    setComponentModalOpen(true)
  }

  const handleComponentSave = async () => {
    if (!canManageComponents) {
      toast.error('Select section, subject, and quarter first')
      return
    }
    if (!componentForm.teacher_id || !componentForm.activity_name || !componentForm.total_score) {
      toast.error('Complete all component fields')
      return
    }

    setComponentSaving(true)
    const payload = {
      section_id: filters.section_id,
      subject_id: filters.subject_id,
      quarter_id: filters.quarter_id,
      teacher_id: componentForm.teacher_id,
      component_type: componentForm.component_type,
      activity_name: componentForm.activity_name,
      activity_number: Number(componentForm.activity_number),
      total_score: Number(componentForm.total_score),
    }
    const { error } = componentEditId
      ? await supabase.from('grade_components').update(payload).eq('id', componentEditId)
      : await supabase.from('grade_components').insert(payload)
    setComponentSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(componentEditId ? 'Grade component updated' : 'Grade component added')
    setComponentModalOpen(false)
    fetchComponents()
  }

  const handleComponentDelete = async () => {
    setComponentDeleting(true)
    let { error } = await supabase.from('student_scores').delete().eq('grade_component_id', deleteComponentId)
    if (!error) {
      ;({ error } = await supabase.from('grade_components').delete().eq('id', deleteComponentId))
    }
    setComponentDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Grade component deleted')
    setDeleteComponentId(null)
    fetchComponents()
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
      await syncQuarterlyGrades()
      toast.success('Scores saved successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to save scores')
    } finally {
      setSaving(false)
    }
  }

  const syncQuarterlyGrades = async () => {
    if (!filters.school_year_id || !filters.section_id || !filters.subject_id || !filters.quarter_id || components.length === 0) return

    const subject = subjects.find(s => s.id === filters.subject_id)
    const weights = getWeights(subject)

    for (const enrollment of students) {
      const studentId = enrollment.student_id
      const totals = buildComponentTotals(components, scores, studentId, weights)
      const initialGrade = Number((
        totals.written_work.weighted +
        totals.performance_task.weighted +
        totals.quarterly_assessment.weighted
      ).toFixed(2))

      const { data: transmutedGrade, error: transmutationError } = await supabase
        .rpc('get_transmuted_grade', { p_initial_grade: initialGrade })
      if (transmutationError) throw transmutationError

      const { data: descriptor, error: descriptorError } = await supabase
        .rpc('get_grade_descriptor', { p_transmuted_grade: transmutedGrade })
      if (descriptorError) throw descriptorError

      const { error } = await supabase.from('quarterly_grades').upsert({
        student_id: studentId,
        section_id: filters.section_id,
        subject_id: filters.subject_id,
        quarter_id: filters.quarter_id,
        school_year_id: filters.school_year_id,
        ww_total_score: totals.written_work.score,
        ww_hps: totals.written_work.hps,
        ww_percentage: Number(totals.written_work.percentage.toFixed(2)),
        ww_weighted: Number(totals.written_work.weighted.toFixed(2)),
        pt_total_score: totals.performance_task.score,
        pt_hps: totals.performance_task.hps,
        pt_percentage: Number(totals.performance_task.percentage.toFixed(2)),
        pt_weighted: Number(totals.performance_task.weighted.toFixed(2)),
        qa_total_score: totals.quarterly_assessment.score,
        qa_hps: totals.quarterly_assessment.hps,
        qa_percentage: Number(totals.quarterly_assessment.percentage.toFixed(2)),
        qa_weighted: Number(totals.quarterly_assessment.weighted.toFixed(2)),
        initial_grade: initialGrade,
        transmuted_grade: transmutedGrade,
        descriptor,
        status: 'draft',
      }, { onConflict: 'student_id,subject_id,quarter_id' })
      if (error) throw error
    }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      <PageHeader title="Grade Entry" subtitle="Enter student grades by component" />
      
      <motion.div className="card mb-6" variants={filterVariants} initial="initial" animate="animate">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'School Year', value: filters.school_year_id, key: 'school_year_id', options: schoolYears.map(sy => ({ id: sy.id, label: sy.year_name })) },
            { label: 'Section', value: filters.section_id, key: 'section_id', options: sections.filter(s => !filters.school_year_id || s.school_year_id === filters.school_year_id).map(s => ({ id: s.id, label: `${s.grade_levels?.name} - ${s.name}` })) },
            { label: 'Subject', value: filters.subject_id, key: 'subject_id', options: subjects.map(s => ({ id: s.id, label: s.name })) },
            { label: 'Quarter', value: filters.quarter_id, key: 'quarter_id', options: quarters.map(q => ({ id: q.id, label: q.name })) },
          ].map((filter, i) => (
            <motion.div key={filter.key} variants={dropdownVariants} custom={i} initial="initial" animate="animate">
              <label className="block text-sm font-medium text-gray-700 mb-1">{filter.label}</label>
              <select value={filter.value} onChange={e => setFilters(p => filter.key === 'school_year_id' ? {...p, school_year_id: e.target.value, section_id: ''} : {...p, [filter.key]: e.target.value})} className="input-field">
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
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={openAddComponent}
                  className="btn-secondary flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4" /> Add Component
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  disabled={saving || components.length === 0}
                  className="btn-primary flex items-center gap-2"
                  whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Scores'}
                </motion.button>
              </div>
            </div>
            {components.length === 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Add grade components first, then score inputs will appear for each student.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Student</th>
                    {components.map(c => (
                      <th key={c.id} className="px-3 py-2 text-center font-medium text-gray-500">
                        <div className="flex items-center justify-center gap-1">
                          <span>{c.component_type}</span>
                          <button onClick={() => openEditComponent(c)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit component">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => setDeleteComponentId(c.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete component">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs">{c.activity_name} #{c.activity_number} ({c.total_score})</div>
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

      <Modal isOpen={componentModalOpen} onClose={() => setComponentModalOpen(false)} title={componentEditId ? 'Edit Grade Component' : 'Add Grade Component'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teacher</label>
              <select className="input-field" value={componentForm.teacher_id} onChange={e => setComponentForm({ ...componentForm, teacher_id: e.target.value })}>
                <option value="">Select...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.last_name}, {t.first_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Component Type</label>
              <select className="input-field" value={componentForm.component_type} onChange={e => setComponentForm({ ...componentForm, component_type: e.target.value })}>
                <option value="written_work">Written Work</option>
                <option value="performance_task">Performance Task</option>
                <option value="quarterly_assessment">Quarterly Assessment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Name</label>
              <input className="input-field" value={componentForm.activity_name} onChange={e => setComponentForm({ ...componentForm, activity_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Number</label>
              <input type="number" min="1" className="input-field" value={componentForm.activity_number} onChange={e => setComponentForm({ ...componentForm, activity_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Highest Possible Score</label>
              <input type="number" min="1" step="0.5" className="input-field" value={componentForm.total_score} onChange={e => setComponentForm({ ...componentForm, total_score: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button className="btn-secondary" onClick={() => setComponentModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleComponentSave} disabled={componentSaving}>{componentSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteComponentId}
        onClose={() => setDeleteComponentId(null)}
        onConfirm={handleComponentDelete}
        loading={componentDeleting}
        title="Delete Grade Component"
        message="Delete this grade component and its student scores? This cannot be undone."
      />
    </motion.div>
  )
}
