import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { Users, ChevronRight, ChevronLeft, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const PROMOTION_TYPES = [
  { value: 'promoted', label: 'Promoted' },
  { value: 'retained', label: 'Retained' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'manual', label: 'Manual' },
]

const stepVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
}

const studentVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 10) * 0.03, duration: 0.25 },
  }),
}

const gradeGroupVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.3 },
  }),
}

export default function PromotionModal({ isOpen, onClose, schoolYear }) {
  const [step, setStep] = useState(1)
  const [schoolYears, setSchoolYears] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [toYearId, setToYearId] = useState('')
  const [promotionType, setPromotionType] = useState('promoted')
  const [reason, setReason] = useState('')
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selected, setSelected] = useState({})
  const [gradeTargets, setGradeTargets] = useState({})
  const [sectionTargets, setSectionTargets] = useState({})
  const [sections, setSections] = useState([])
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    if (!isOpen) { setStep(1); setSelected({}); setGradeTargets({}); setSectionTargets({}); setStudents([]); setToYearId(''); setPromotionType('promoted'); setReason(''); return }
    fetchInitialData()
  }, [isOpen])

  const fetchInitialData = async () => {
    const [syRes, glRes] = await Promise.all([
      supabase.from('school_years').select('*').in('status', ['planned', 'active']).order('start_date', { ascending: false }),
      supabase.from('grade_levels').select('*').order('level_order'),
    ])
    setSchoolYears(syRes.data || [])
    setGradeLevels(glRes.data || [])
  }

  const fetchStudents = async () => {
    if (!schoolYear?.id) return
    setLoadingStudents(true)
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, student_id, grade_level_id, section_id, students(id, first_name, last_name, lrn), grade_levels(id, name, level_order), sections(id, name)')
      .eq('school_year_id', schoolYear.id)
      .eq('status', 'enrolled')
    if (error) { toast.error('Failed to load students'); setLoadingStudents(false); return }
    setStudents(data || [])

    // auto-set grade targets (next grade level)
    const targets = {}
    ;(data || []).forEach(e => {
      if (e.grade_levels && !targets[e.grade_level_id]) {
        const nextGrade = (gradeLevels || []).find(g => g.level_order === e.grade_levels.level_order + 1)
        targets[e.grade_level_id] = nextGrade ? nextGrade.id : e.grade_level_id
      }
    })
    setGradeTargets(targets)
    setLoadingStudents(false)
  }

  const fetchSections = async (yearId) => {
    if (!yearId) { setSections([]); return }
    const { data } = await supabase.from('sections').select('*').eq('school_year_id', yearId)
    setSections(data || [])
  }

  useEffect(() => { if (toYearId) fetchSections(toYearId) }, [toYearId])

  const groupedByGrade = students.reduce((acc, e) => {
    const gid = e.grade_level_id
    if (!acc[gid]) acc[gid] = { grade: e.grade_levels, students: [] }
    acc[gid].students.push(e)
    return acc
  }, {})

  const toggleStudent = (sid) => {
    setSelected(prev => ({ ...prev, [sid]: !prev[sid] }))
  }

  const toggleGradeAll = (gradeId, studentsList) => {
    const allSelected = studentsList.every(s => selected[s.student_id])
    const updates = {}
    studentsList.forEach(s => { updates[s.student_id] = !allSelected })
    setSelected(prev => ({ ...prev, ...updates }))
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  const goToStep2 = () => {
    if (!toYearId) { toast.error('Select a target school year'); return }
    fetchStudents()
    setStep(2)
  }

  const goToStep3 = () => {
    if (selectedCount === 0) { toast.error('Select at least one student'); return }
    setStep(3)
  }

  const getPromotionSummary = () => {
    const summary = {}
    Object.entries(groupedByGrade).forEach(([gradeId, group]) => {
      const gradeStudents = group.students.filter(s => selected[s.student_id])
      if (gradeStudents.length > 0) {
        const targetGradeId = gradeTargets[gradeId] || gradeId
        const targetGrade = gradeLevels.find(g => g.id === targetGradeId)
        summary[gradeId] = {
          fromGrade: group.grade?.name || 'Unknown',
          toGrade: targetGrade?.name || 'Same',
          count: gradeStudents.length,
          targetGradeId,
          targetSectionId: sectionTargets[gradeId] || null,
          studentIds: gradeStudents.map(s => s.student_id),
        }
      }
    })
    return summary
  }

  const handlePromote = async () => {
    setPromoting(true)
    const summary = getPromotionSummary()
    let totalPromoted = 0
    let hasError = false

    for (const [gradeId, info] of Object.entries(summary)) {
      const { error } = await supabase.rpc('promote_students', {
        p_from_sy_id: schoolYear.id,
        p_to_sy_id: toYearId,
        p_student_ids: info.studentIds,
        p_to_grade_level_id: info.targetGradeId,
        p_to_section_id: info.targetSectionId,
        p_promotion_type: promotionType,
        p_reason: reason || null,
      })
      if (error) {
        toast.error('Error promoting ' + info.fromGrade + ' students: ' + error.message)
        hasError = true
      } else {
        totalPromoted += info.count
      }
    }

    setPromoting(false)
    if (!hasError) {
      toast.success(totalPromoted + ' students promoted successfully!')
      onClose()
    } else if (totalPromoted > 0) {
      toast.success(totalPromoted + ' students promoted (some groups had errors)')
    }
  }

  if (!isOpen) return null

  const toYear = schoolYears.find(y => y.id === toYearId)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Promote Students" size="xl">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <motion.div
              animate={{
                scale: step === s ? 1.1 : 1,
                backgroundColor: step >= s ? 'rgb(147, 51, 234)' : 'rgb(229, 231, 235)',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ' +
                (step >= s ? 'text-white' : 'text-gray-500')}
            >
              {s}
            </motion.div>
            <span className={'text-sm ' + (step >= s ? 'text-purple-600 font-medium' : 'text-gray-400')}>
              {s === 1 ? 'Configure' : s === 2 ? 'Select Students' : 'Review'}
            </span>
            {s < 3 && <ChevronRight className="w-4 h-4 text-gray-300" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Configuration */}
        {step === 1 && (
          <motion.div
            key="step1"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From School Year</label>
              <input className="input-field bg-gray-50" value={schoolYear?.year_name || ''} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To School Year <span className="text-red-500">*</span></label>
              <select className="input-field" value={toYearId} onChange={e => setToYearId(e.target.value)}>
                <option value="">Select target year...</option>
                {schoolYears.filter(y => y.id !== schoolYear?.id).map(y => (
                  <option key={y.id} value={y.id}>{y.year_name} ({y.status})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Type</label>
              <select className="input-field" value={promotionType} onChange={e => setPromotionType(e.target.value)}>
                {PROMOTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
              <textarea className="input-field" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for promotion..." />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose} className="btn-secondary">Cancel</motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={goToStep2} className="btn-primary flex items-center gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Select Students */}
        {step === 2 && (
          <motion.div
            key="step2"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            {loadingStudents ? (
              <div className="flex items-center justify-center py-12">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Loader2 className="w-6 h-6 text-purple-600" />
                </motion.div>
                <span className="ml-2 text-gray-500">Loading students...</span>
              </div>
            ) : students.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-12 text-gray-500"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                </motion.div>
                <p>No enrolled students found for this school year</p>
              </motion.div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(groupedByGrade).map(([gradeId, group], groupIdx) => {
                  const allSelected = group.students.every(s => selected[s.student_id])
                  const someSelected = group.students.some(s => selected[s.student_id])
                  const targetGradeId = gradeTargets[gradeId] || gradeId
                  return (
                    <motion.div
                      key={gradeId}
                      custom={groupIdx}
                      variants={gradeGroupVariants}
                      initial="hidden"
                      animate="visible"
                      className="border rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                            onChange={() => toggleGradeAll(gradeId, group.students)}
                            className="rounded border-gray-300"
                          />
                          <span className="font-semibold text-gray-900">{group.grade?.name || 'Unknown Grade'}</span>
                          <span className="text-xs text-gray-500">({group.students.length} students)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Target Grade:</label>
                          <select
                            className="input-field text-sm py-1 px-2 w-auto"
                            value={targetGradeId}
                            onChange={e => setGradeTargets(prev => ({ ...prev, [gradeId]: e.target.value }))}
                          >
                            {gradeLevels.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          <label className="text-xs text-gray-500">Section:</label>
                          <select
                            className="input-field text-sm py-1 px-2 w-auto"
                            value={sectionTargets[gradeId] || ''}
                            onChange={e => setSectionTargets(prev => ({ ...prev, [gradeId]: e.target.value || null }))}
                          >
                            <option value="">None</option>
                            {sections.filter(s => s.grade_level_id === targetGradeId).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1 ml-7">
                        {group.students.map((s, idx) => (
                          <motion.label
                            key={s.student_id}
                            custom={idx}
                            variants={studentVariants}
                            initial="hidden"
                            animate="visible"
                            className="flex items-center gap-3 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={!!selected[s.student_id]}
                              onChange={() => toggleStudent(s.student_id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-900">
                              {s.students?.last_name}, {s.students?.first_name}
                            </span>
                            {s.students?.lrn && <span className="text-xs text-gray-400">LRN: {s.students.lrn}</span>}
                            {s.sections?.name && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{s.sections.name}</span>}
                          </motion.label>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <span className="text-sm text-gray-500">{selectedCount} student(s) selected</span>
              <div className="flex gap-3">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={goToStep3} className="btn-primary flex items-center gap-2" disabled={selectedCount === 0}>
                  Next <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && (
          <motion.div
            key="step3"
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="bg-purple-50 rounded-lg p-4 mb-4"
            >
              <h4 className="font-semibold text-purple-900 mb-2">Promotion Summary</h4>
              <p className="text-sm text-purple-700">
                {selectedCount} student(s) will be <strong>{promotionType}</strong> from <strong>{schoolYear?.year_name}</strong> to <strong>{toYear?.year_name || 'Unknown'}</strong>
              </p>
            </motion.div>

            <div className="space-y-2 mb-6">
              {Object.entries(getPromotionSummary()).map(([gradeId, info], idx) => (
                <motion.div
                  key={gradeId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + idx * 0.08, duration: 0.25 }}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{info.fromGrade}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-purple-700">{info.toGrade}</span>
                  </div>
                  <span className="text-sm text-gray-500">{info.count} student(s)</span>
                </motion.div>
              ))}
            </div>

            {reason && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-4 p-3 bg-gray-50 rounded-lg"
              >
                <p className="text-xs text-gray-500">Reason</p>
                <p className="text-sm text-gray-700">{reason}</p>
              </motion.div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep(2)} className="btn-secondary flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handlePromote} className="btn-primary flex items-center gap-2" disabled={promoting}>
                {promoting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Promoting...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Promote {selectedCount} Students</>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
