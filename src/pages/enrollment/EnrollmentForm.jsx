import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { ArrowLeft, ArrowRight, Save, User, School, MapPin, Users, Heart, Activity, Phone, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const stepContentVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, x: -30, transition: { duration: 0.2 } },
}

const fieldGroupVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
}

const fieldVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

const STEPS = [
  { label: 'Personal Info', icon: User },
  { label: 'School Info', icon: School },
  { label: 'Address', icon: MapPin },
  { label: 'Guardians', icon: Users },
  { label: 'Learner Profile', icon: Heart },
  { label: 'Health', icon: Activity },
  { label: 'Emergency', icon: Phone },
  { label: 'Documents', icon: FileText },
  { label: 'Review', icon: CheckCircle },
]

const DOCUMENT_TYPES = [
  { value: 'birth_certificate', label: 'Birth Certificate (PSA/NSO)' },
  { value: 'report_card', label: 'Report Card (Form 138)' },
  { value: 'good_moral', label: 'Good Moral Certificate' },
  { value: 'form_137', label: 'Form 137 (Transcript)' },
  { value: 'psa', label: 'PSA Certificate' },
  { value: 'medical_certificate', label: 'Medical Certificate' },
  { value: 'id_photo', label: 'ID Photo (2x2)' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'transfer_certificate', label: 'Transfer Certificate' },
]

const emptyGuardian = { first_name: '', middle_name: '', last_name: '', relationship: 'father', contact_number: '', email: '', occupation: '', office_address: '', office_contact: '', is_emergency_contact: false }
const emptyEmergency = { full_name: '', relationship: '', contact_number: '', alt_contact_number: '', address: '', is_primary: false }

const initialForm = {
  student: {
    lrn: '', first_name: '', middle_name: '', last_name: '', suffix: '',
    gender: '', birth_date: '', birth_place: '', nationality: 'Filipino',
    religion: '', mother_tongue: '', ethnic_group: '',
    house_no: '', street: '', barangay: '', city_municipality: '', province: '', zip_code: '',
    contact_number: '', email: '', psa_birth_cert_no: '',
    is_4ps_beneficiary: false, is_indigenous_people: false, is_pwd: false, disability_type: '',
    is_solo_parent_child: false, ip_group_name: '',
    learning_modality_preference: 'face_to_face',
    medical_conditions: '', allergies: '', immunization_status: 'unknown',
    status: 'active',
  },
  enrollment: {
    school_year_id: '', grade_level_id: '', section_id: '',
    enrollment_type: 'new', enrollment_date: new Date().toISOString().split('T')[0],
    previous_school: '', previous_school_id: '', previous_grade_level: '',
    learning_modality: 'face_to_face', status: 'pending', remarks: '',
  },
  guardians: [{ ...emptyGuardian }],
  emergencyContacts: [{ ...emptyEmergency, is_primary: true }],
  documents: DOCUMENT_TYPES.map(d => ({ document_type: d.value, document_name: d.label, is_submitted: false, submitted_date: '', notes: '' })),
}

export default function EnrollmentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(initialForm)))
  const [gradeLevels, setGradeLevels] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [existingStudentId, setExistingStudentId] = useState(null)

  useEffect(() => {
    fetchLookups()
    if (isEdit) fetchEnrollment()
  }, [id])

  const fetchLookups = async () => {
    const [glRes, syRes] = await Promise.all([
      supabase.from('grade_levels').select('*').eq('is_active', true).order('level_order'),
      supabase.from('school_years').select('*').order('start_date', { ascending: false }),
    ])
    if (glRes.data) setGradeLevels(glRes.data)
    if (syRes.data) setSchoolYears(syRes.data)
  }

  useEffect(() => {
    if (formData.enrollment.grade_level_id && formData.enrollment.school_year_id) {
      supabase.from('sections').select('*')
        .eq('grade_level_id', formData.enrollment.grade_level_id)
        .eq('school_year_id', formData.enrollment.school_year_id)
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => { if (data) setSections(data) })
    }
  }, [formData.enrollment.grade_level_id, formData.enrollment.school_year_id])

  const fetchEnrollment = async () => {
    setLoading(true)
    try {
      const { data: enr, error } = await supabase.from('enrollments').select('*, students(*)').eq('id', id).single()
      if (error) throw error
      if (enr) {
        setExistingStudentId(enr.student_id)
        const s = enr.students || {}
        setFormData(prev => ({
          ...prev,
          student: {
            lrn: s.lrn || '', first_name: s.first_name || '', middle_name: s.middle_name || '',
            last_name: s.last_name || '', suffix: s.suffix || '', gender: s.gender || '',
            birth_date: s.birth_date || '', birth_place: s.birth_place || '',
            nationality: s.nationality || 'Filipino', religion: s.religion || '',
            mother_tongue: s.mother_tongue || '', ethnic_group: s.ethnic_group || '',
            house_no: s.house_no || '', street: s.street || '', barangay: s.barangay || '',
            city_municipality: s.city_municipality || '', province: s.province || '',
            zip_code: s.zip_code || '', contact_number: s.contact_number || '',
            email: s.email || '', psa_birth_cert_no: s.psa_birth_cert_no || '',
            is_4ps_beneficiary: s.is_4ps_beneficiary || false,
            is_indigenous_people: s.is_indigenous_people || false,
            is_pwd: s.is_pwd || false, disability_type: s.disability_type || '',
            is_solo_parent_child: s.is_solo_parent_child || false,
            ip_group_name: s.ip_group_name || '',
            learning_modality_preference: s.learning_modality_preference || 'face_to_face',
            medical_conditions: s.medical_conditions || '', allergies: s.allergies || '',
            immunization_status: s.immunization_status || 'unknown', status: s.status || 'active',
          },
          enrollment: {
            school_year_id: enr.school_year_id || '', grade_level_id: enr.grade_level_id || '',
            section_id: enr.section_id || '', enrollment_type: enr.enrollment_type || 'new',
            enrollment_date: enr.enrollment_date || '', previous_school: enr.previous_school || '',
            previous_school_id: enr.previous_school_id || '',
            previous_grade_level: enr.previous_grade_level || '',
            learning_modality: enr.learning_modality || 'face_to_face',
            status: enr.status || 'pending', remarks: enr.remarks || '',
          },
        }))
        // Fetch guardians
        const { data: sgData } = await supabase.from('student_guardians').select('*, guardians(*)').eq('student_id', enr.student_id)
        if (sgData && sgData.length > 0) {
          setFormData(prev => ({
            ...prev,
            guardians: sgData.map(sg => ({
              id: sg.guardians.id,
              first_name: sg.guardians.first_name || '',
              middle_name: sg.guardians.middle_name || '',
              last_name: sg.guardians.last_name || '',
              relationship: sg.guardians.relationship || '',
              contact_number: sg.guardians.contact_number || '',
              email: sg.guardians.email || '',
              occupation: sg.guardians.occupation || '',
              office_address: sg.guardians.office_address || '',
              office_contact: sg.guardians.office_contact || '',
              is_emergency_contact: sg.guardians.is_emergency_contact || false,
            }))
          }))
        }
        // Fetch emergency contacts
        const { data: ecData } = await supabase.from('emergency_contacts').select('*').eq('student_id', enr.student_id)
        if (ecData && ecData.length > 0) {
          setFormData(prev => ({
            ...prev,
            emergencyContacts: ecData.map(ec => ({
              id: ec.id, full_name: ec.full_name || '', relationship: ec.relationship || '',
              contact_number: ec.contact_number || '', alt_contact_number: ec.alt_contact_number || '',
              address: ec.address || '', is_primary: ec.is_primary || false,
            }))
          }))
        }
        // Fetch documents
        const { data: docData } = await supabase.from('enrollment_documents').select('*').eq('enrollment_id', id)
        if (docData && docData.length > 0) {
          setFormData(prev => ({
            ...prev,
            documents: DOCUMENT_TYPES.map(dt => {
              const existing = docData.find(d => d.document_type === dt.value)
              return existing ? {
                id: existing.id, document_type: existing.document_type,
                document_name: existing.document_name, is_submitted: existing.is_submitted || false,
                submitted_date: existing.submitted_date || '', notes: existing.notes || '',
              } : { document_type: dt.value, document_name: dt.label, is_submitted: false, submitted_date: '', notes: '' }
            })
          }))
        }
      }
    } catch (err) {
      toast.error('Failed to load enrollment')
      console.error(err)
    }
    setLoading(false)
  }

  const updateStudent = (field, value) => {
    setFormData(prev => ({ ...prev, student: { ...prev.student, [field]: value } }))
  }

  const updateEnrollment = (field, value) => {
    setFormData(prev => ({ ...prev, enrollment: { ...prev.enrollment, [field]: value } }))
  }

  const updateGuardian = (index, field, value) => {
    setFormData(prev => {
      const g = [...prev.guardians]
      g[index] = { ...g[index], [field]: value }
      return { ...prev, guardians: g }
    })
  }

  const addGuardian = () => {
    setFormData(prev => ({ ...prev, guardians: [...prev.guardians, { ...emptyGuardian }] }))
  }

  const removeGuardian = (index) => {
    if (formData.guardians.length <= 1) return
    setFormData(prev => ({ ...prev, guardians: prev.guardians.filter((_, i) => i !== index) }))
  }

  const updateEmergency = (index, field, value) => {
    setFormData(prev => {
      const e = [...prev.emergencyContacts]
      e[index] = { ...e[index], [field]: value }
      return { ...prev, emergencyContacts: e }
    })
  }

  const addEmergency = () => {
    setFormData(prev => ({ ...prev, emergencyContacts: [...prev.emergencyContacts, { ...emptyEmergency }] }))
  }

  const removeEmergency = (index) => {
    if (formData.emergencyContacts.length <= 1) return
    setFormData(prev => ({ ...prev, emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index) }))
  }

  const updateDocument = (index, field, value) => {
    setFormData(prev => {
      const d = [...prev.documents]
      d[index] = { ...d[index], [field]: value }
      return { ...prev, documents: d }
    })
  }

  const calcAge = useMemo(() => {
    if (!formData.student.birth_date) return ''
    const today = new Date()
    const bd = new Date(formData.student.birth_date)
    let age = today.getFullYear() - bd.getFullYear()
    const m = today.getMonth() - bd.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
    return age
  }, [formData.student.birth_date])

  const validateStep = (s) => {
    const st = formData.student
    const en = formData.enrollment
    switch(s) {
      case 0: return st.first_name && st.last_name && st.gender && st.birth_date
      case 1: return en.enrollment_type && en.grade_level_id && en.school_year_id
      case 2: return true
      case 3: return formData.guardians.every(g => g.first_name && g.last_name && g.relationship)
      case 4: return true
      case 5: return true
      case 6: return formData.emergencyContacts.every(e => e.full_name && e.relationship && e.contact_number)
      case 7: return true
      case 8: return true
      default: return true
    }
  }

  const nextStep = () => {
    if (!validateStep(step)) {
      toast.error('Please fill in all required fields')
      return
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const studentPayload = { ...formData.student }
      Object.keys(studentPayload).forEach(k => { if (studentPayload[k] === '') studentPayload[k] = null })

      let studentId = existingStudentId
      if (isEdit && studentId) {
        const { error } = await supabase.from('students').update(studentPayload).eq('id', studentId)
        if (error) throw error
      } else {
        const { data: newStudent, error } = await supabase.from('students').insert(studentPayload).select().single()
        if (error) throw error
        studentId = newStudent.id
      }

      const enrollPayload = { ...formData.enrollment, student_id: studentId }
      Object.keys(enrollPayload).forEach(k => { if (enrollPayload[k] === '') enrollPayload[k] = null })

      let enrollmentId = id
      if (isEdit) {
        const { error } = await supabase.from('enrollments').update(enrollPayload).eq('id', id)
        if (error) throw error
      } else {
        const { data: newEnroll, error } = await supabase.from('enrollments').insert(enrollPayload).select().single()
        if (error) throw error
        enrollmentId = newEnroll.id
      }

      // Guardians
      for (const g of formData.guardians) {
        if (!g.first_name || !g.last_name) continue
        const gPayload = { ...g }
        delete gPayload.id
        Object.keys(gPayload).forEach(k => { if (gPayload[k] === '') gPayload[k] = null })

        if (g.id) {
          await supabase.from('guardians').update(gPayload).eq('id', g.id)
        } else {
          const { data: newG, error: gErr } = await supabase.from('guardians').insert(gPayload).select().single()
          if (gErr) { console.error('Guardian error:', gErr); continue }
          await supabase.from('student_guardians').insert({ student_id: studentId, guardian_id: newG.id, is_primary: formData.guardians.indexOf(g) === 0 })
        }
      }

      // Emergency Contacts
      if (!isEdit) {
        for (const ec of formData.emergencyContacts) {
          if (!ec.full_name || !ec.contact_number) continue
          const ecPayload = { ...ec, student_id: studentId }
          delete ecPayload.id
          Object.keys(ecPayload).forEach(k => { if (ecPayload[k] === '') ecPayload[k] = null })
          await supabase.from('emergency_contacts').insert(ecPayload)
        }
      } else {
        await supabase.from('emergency_contacts').delete().eq('student_id', studentId)
        for (const ec of formData.emergencyContacts) {
          if (!ec.full_name || !ec.contact_number) continue
          const ecPayload = { ...ec, student_id: studentId }
          delete ecPayload.id
          Object.keys(ecPayload).forEach(k => { if (ecPayload[k] === '') ecPayload[k] = null })
          await supabase.from('emergency_contacts').insert(ecPayload)
        }
      }

      // Documents
      for (const doc of formData.documents) {
        const docPayload = {
          enrollment_id: enrollmentId, student_id: studentId,
          document_type: doc.document_type, document_name: doc.document_name,
          is_submitted: doc.is_submitted,
          submitted_date: doc.submitted_date || null,
          notes: doc.notes || null,
        }
        if (doc.id) {
          await supabase.from('enrollment_documents').update(docPayload).eq('id', doc.id)
        } else {
          await supabase.from('enrollment_documents').insert(docPayload)
        }
      }

      toast.success(isEdit ? 'Enrollment updated successfully!' : 'Enrollment created successfully!')
      navigate('/enrollment')
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Failed to save: ' + (err.message || 'Unknown error'))
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  const SectionHeader = ({ icon: Icon, title }) => (
    <motion.div
      className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Icon className="w-5 h-5 text-blue-600" />
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
    </motion.div>
  )

  const renderStep0 = () => (
    <div>
      <SectionHeader icon={User} title="Personal Information" />
      <motion.div className="grid grid-cols-1 md:grid-cols-4 gap-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
          <input type="text" className="input-field" value={formData.student.last_name} onChange={e => updateStudent('last_name', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
          <input type="text" className="input-field" value={formData.student.first_name} onChange={e => updateStudent('first_name', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
          <input type="text" className="input-field" value={formData.student.middle_name} onChange={e => updateStudent('middle_name', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
          <input type="text" className="input-field" placeholder="Jr., III, etc." value={formData.student.suffix} onChange={e => updateStudent('suffix', e.target.value)} />
        </motion.div>
      </motion.div>
      <motion.div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
          <input type="date" className="input-field" value={formData.student.birth_date} onChange={e => updateStudent('birth_date', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input type="text" className="input-field bg-gray-50" value={calcAge !== '' ? calcAge + ' years old' : ''} readOnly />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
          <select className="input-field" value={formData.student.gender} onChange={e => updateStudent('gender', e.target.value)}>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Place of Birth</label>
          <input type="text" className="input-field" value={formData.student.birth_place} onChange={e => updateStudent('birth_place', e.target.value)} />
        </motion.div>
      </motion.div>
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
          <input type="text" className="input-field" value={formData.student.nationality} onChange={e => updateStudent('nationality', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Religion</label>
          <input type="text" className="input-field" value={formData.student.religion} onChange={e => updateStudent('religion', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mother Tongue</label>
          <input type="text" className="input-field" value={formData.student.mother_tongue} onChange={e => updateStudent('mother_tongue', e.target.value)} />
        </motion.div>
      </motion.div>
    </div>
  )

  const renderStep1 = () => (
    <div>
      <SectionHeader icon={School} title="Learner Reference & School Info" />
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">LRN (Learner Reference Number)</label>
          <input type="text" className="input-field" maxLength={12} placeholder="12-digit LRN" value={formData.student.lrn} onChange={e => updateStudent('lrn', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">PSA Birth Certificate No.</label>
          <input type="text" className="input-field" value={formData.student.psa_birth_cert_no} onChange={e => updateStudent('psa_birth_cert_no', e.target.value)} />
        </motion.div>
      </motion.div>
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Type <span className="text-red-500">*</span></label>
          <select className="input-field" value={formData.enrollment.enrollment_type} onChange={e => updateEnrollment('enrollment_type', e.target.value)}>
            <option value="new">New</option>
            <option value="old">Old / Continuing</option>
            <option value="transferee">Transferee</option>
            <option value="returnee">Returnee</option>
            <option value="cross_enrollee">Cross Enrollee</option>
          </select>
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level <span className="text-red-500">*</span></label>
          <select className="input-field" value={formData.enrollment.grade_level_id} onChange={e => updateEnrollment('grade_level_id', e.target.value)}>
            <option value="">Select Grade Level</option>
            {gradeLevels.map(gl => (
              <option key={gl.id} value={gl.id}>{gl.name}</option>
            ))}
          </select>
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">School Year <span className="text-red-500">*</span></label>
          <select className="input-field" value={formData.enrollment.school_year_id} onChange={e => updateEnrollment('school_year_id', e.target.value)}>
            <option value="">Select School Year</option>
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>{sy.year_name}</option>
            ))}
          </select>
        </motion.div>
      </motion.div>
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Date</label>
          <input type="date" className="input-field" value={formData.enrollment.enrollment_date} onChange={e => updateEnrollment('enrollment_date', e.target.value)} />
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {(formData.enrollment.enrollment_type === 'transferee' || formData.enrollment.enrollment_type === 'returnee') && (
          <motion.div
            className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h4 className="text-sm font-semibold text-blue-800 mb-3">Previous School Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Grade Completed</label>
                <input type="text" className="input-field" value={formData.enrollment.previous_grade_level} onChange={e => updateEnrollment('previous_grade_level', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last School Attended</label>
                <input type="text" className="input-field" value={formData.enrollment.previous_school} onChange={e => updateEnrollment('previous_school', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previous School ID</label>
                <input type="text" className="input-field" value={formData.enrollment.previous_school_id} onChange={e => updateEnrollment('previous_school_id', e.target.value)} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const renderStep2 = () => (
    <div>
      <SectionHeader icon={MapPin} title="Address & Contact Information" />
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">House No.</label>
          <input type="text" className="input-field" value={formData.student.house_no} onChange={e => updateStudent('house_no', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Street</label>
          <input type="text" className="input-field" value={formData.student.street} onChange={e => updateStudent('street', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Barangay</label>
          <input type="text" className="input-field" value={formData.student.barangay} onChange={e => updateStudent('barangay', e.target.value)} />
        </motion.div>
      </motion.div>
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">City / Municipality</label>
          <input type="text" className="input-field" value={formData.student.city_municipality} onChange={e => updateStudent('city_municipality', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
          <input type="text" className="input-field" value={formData.student.province} onChange={e => updateStudent('province', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
          <input type="text" className="input-field" value={formData.student.zip_code} onChange={e => updateStudent('zip_code', e.target.value)} />
        </motion.div>
      </motion.div>
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
          <input type="text" className="input-field" placeholder="09XX-XXX-XXXX" value={formData.student.contact_number} onChange={e => updateStudent('contact_number', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input type="email" className="input-field" value={formData.student.email} onChange={e => updateStudent('email', e.target.value)} />
        </motion.div>
      </motion.div>
    </div>
  )

  const renderStep3 = () => (
    <div>
      <SectionHeader icon={Users} title="Parent / Guardian Information" />
      {formData.guardians.map((g, idx) => (
        <motion.div
          key={idx}
          className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Guardian #{idx + 1}</h4>
            {formData.guardians.length > 1 && (
              <button type="button" onClick={() => removeGuardian(idx)} className="text-red-500 text-sm hover:text-red-700">Remove</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
              <input type="text" className="input-field" value={g.first_name} onChange={e => updateGuardian(idx, 'first_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input type="text" className="input-field" value={g.middle_name} onChange={e => updateGuardian(idx, 'middle_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input type="text" className="input-field" value={g.last_name} onChange={e => updateGuardian(idx, 'last_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship <span className="text-red-500">*</span></label>
              <select className="input-field" value={g.relationship} onChange={e => updateGuardian(idx, 'relationship', e.target.value)}>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="grandparent">Grandparent</option>
                <option value="sibling">Sibling</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
              <input type="text" className="input-field" value={g.occupation} onChange={e => updateGuardian(idx, 'occupation', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
              <input type="text" className="input-field" value={g.contact_number} onChange={e => updateGuardian(idx, 'contact_number', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input-field" value={g.email} onChange={e => updateGuardian(idx, 'email', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office Address</label>
              <input type="text" className="input-field" value={g.office_address} onChange={e => updateGuardian(idx, 'office_address', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Office Contact</label>
              <input type="text" className="input-field" value={g.office_contact} onChange={e => updateGuardian(idx, 'office_contact', e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600" checked={g.is_emergency_contact} onChange={e => updateGuardian(idx, 'is_emergency_contact', e.target.checked)} />
              <span className="text-gray-700">Is Emergency Contact</span>
            </label>
          </div>
        </motion.div>
      ))}
      <motion.button type="button" onClick={addGuardian} className="btn-secondary text-sm" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>+ Add Another Guardian</motion.button>
    </div>
  )

  const renderStep4 = () => (
    <div>
      <SectionHeader icon={Heart} title="Special Needs / Learner Profile" />
      <motion.div className="space-y-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div className="p-4 bg-gray-50 rounded-lg border border-gray-200" variants={fieldVariants}>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 w-5 h-5" checked={formData.student.is_pwd} onChange={e => updateStudent('is_pwd', e.target.checked)} />
            <div>
              <span className="text-sm font-medium text-gray-700">Person with Disability (PWD)</span>
              <p className="text-xs text-gray-500">Check if the learner has any disability</p>
            </div>
          </label>
          <AnimatePresence>
            {formData.student.is_pwd && (
              <motion.div className="mt-3 ml-8" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disability Type</label>
                <input type="text" className="input-field" placeholder="e.g. Visual Impairment, Hearing Impairment" value={formData.student.disability_type} onChange={e => updateStudent('disability_type', e.target.value)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div className="p-4 bg-gray-50 rounded-lg border border-gray-200" variants={fieldVariants}>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 w-5 h-5" checked={formData.student.is_indigenous_people} onChange={e => updateStudent('is_indigenous_people', e.target.checked)} />
            <div>
              <span className="text-sm font-medium text-gray-700">Indigenous Peoples (IP) Member</span>
              <p className="text-xs text-gray-500">Check if the learner belongs to an IP group</p>
            </div>
          </label>
          <AnimatePresence>
            {formData.student.is_indigenous_people && (
              <motion.div className="mt-3 ml-8" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Group Name</label>
                <input type="text" className="input-field" placeholder="e.g. Aeta, Igorot, Lumad" value={formData.student.ip_group_name} onChange={e => updateStudent('ip_group_name', e.target.value)} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div className="p-4 bg-gray-50 rounded-lg border border-gray-200" variants={fieldVariants}>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 w-5 h-5" checked={formData.student.is_4ps_beneficiary} onChange={e => updateStudent('is_4ps_beneficiary', e.target.checked)} />
            <div>
              <span className="text-sm font-medium text-gray-700">4Ps / Pantawid Pamilyang Pilipino Program Beneficiary</span>
              <p className="text-xs text-gray-500">Check if the learner is a 4Ps beneficiary</p>
            </div>
          </label>
        </motion.div>
        <motion.div className="p-4 bg-gray-50 rounded-lg border border-gray-200" variants={fieldVariants}>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 w-5 h-5" checked={formData.student.is_solo_parent_child} onChange={e => updateStudent('is_solo_parent_child', e.target.checked)} />
            <div>
              <span className="text-sm font-medium text-gray-700">Child of Solo Parent</span>
              <p className="text-xs text-gray-500">As defined under RA 8972</p>
            </div>
          </label>
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Learning Modality</label>
          <select className="input-field max-w-md" value={formData.student.learning_modality_preference} onChange={e => updateStudent('learning_modality_preference', e.target.value)}>
            <option value="face_to_face">Face to Face</option>
            <option value="modular">Modular (Print)</option>
            <option value="online">Online / Digital</option>
            <option value="blended">Blended Learning</option>
            <option value="homeschool">Homeschool</option>
          </select>
        </motion.div>
      </motion.div>
    </div>
  )

  const renderStep5 = () => (
    <div>
      <SectionHeader icon={Activity} title="Health Information" />
      <motion.div className="space-y-4" variants={fieldGroupVariants} initial="initial" animate="animate">
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Medical Conditions</label>
          <textarea className="input-field" rows={3} placeholder="List any known medical conditions..." value={formData.student.medical_conditions} onChange={e => updateStudent('medical_conditions', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
          <textarea className="input-field" rows={3} placeholder="List any known allergies (food, medicine, etc.)..." value={formData.student.allergies} onChange={e => updateStudent('allergies', e.target.value)} />
        </motion.div>
        <motion.div variants={fieldVariants}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Immunization Status</label>
          <select className="input-field max-w-md" value={formData.student.immunization_status} onChange={e => updateStudent('immunization_status', e.target.value)}>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
            <option value="unknown">Unknown</option>
            <option value="exempt">Exempt</option>
          </select>
        </motion.div>
      </motion.div>
    </div>
  )

  const renderStep6 = () => (
    <div>
      <SectionHeader icon={Phone} title="Emergency Contacts" />
      {formData.emergencyContacts.map((ec, idx) => (
        <motion.div
          key={idx}
          className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Emergency Contact #{idx + 1}</h4>
            {formData.emergencyContacts.length > 1 && (
              <button type="button" onClick={() => removeEmergency(idx)} className="text-red-500 text-sm hover:text-red-700">Remove</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input type="text" className="input-field" value={ec.full_name} onChange={e => updateEmergency(idx, 'full_name', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Relationship <span className="text-red-500">*</span></label>
              <input type="text" className="input-field" placeholder="e.g. Mother, Father, Aunt" value={ec.relationship} onChange={e => updateEmergency(idx, 'relationship', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number <span className="text-red-500">*</span></label>
              <input type="text" className="input-field" value={ec.contact_number} onChange={e => updateEmergency(idx, 'contact_number', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alt. Contact Number</label>
              <input type="text" className="input-field" value={ec.alt_contact_number} onChange={e => updateEmergency(idx, 'alt_contact_number', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" className="input-field" value={ec.address} onChange={e => updateEmergency(idx, 'address', e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600" checked={ec.is_primary} onChange={e => updateEmergency(idx, 'is_primary', e.target.checked)} />
              <span className="text-gray-700">Primary Emergency Contact</span>
            </label>
          </div>
        </motion.div>
      ))}
      <motion.button type="button" onClick={addEmergency} className="btn-secondary text-sm" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>+ Add Another Emergency Contact</motion.button>
    </div>
  )

  const renderStep7 = () => (
    <div>
      <SectionHeader icon={FileText} title="Document Checklist" />
      <p className="text-sm text-gray-500 mb-4">Track which documents have been submitted for this enrollment.</p>
      <div className="space-y-3">
        {formData.documents.map((doc, idx) => (
          <motion.div
            key={idx}
            className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(idx, 10) * 0.05 }}
          >
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 mt-1 w-5 h-5" checked={doc.is_submitted} onChange={e => {
              updateDocument(idx, 'is_submitted', e.target.checked)
              if (e.target.checked && !doc.submitted_date) updateDocument(idx, 'submitted_date', new Date().toISOString().split('T')[0])
            }} />
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="text-sm font-medium text-gray-700">{doc.document_name}</span>
              </div>
              <div>
                <input type="date" className="input-field text-sm" placeholder="Date Submitted" value={doc.submitted_date} onChange={e => updateDocument(idx, 'submitted_date', e.target.value)} />
              </div>
              <div>
                <input type="text" className="input-field text-sm" placeholder="Notes" value={doc.notes} onChange={e => updateDocument(idx, 'notes', e.target.value)} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )

  const renderStep8 = () => {
    const s = formData.student
    const en = formData.enrollment
    const glName = gradeLevels.find(g => g.id === en.grade_level_id)
    const syName = schoolYears.find(y => y.id === en.school_year_id)

    return (
      <div>
        <SectionHeader icon={CheckCircle} title="Review & Submit" />

        <motion.div className="space-y-6" variants={fieldGroupVariants} initial="initial" animate="animate">
          <motion.div className="bg-blue-50 border border-blue-200 rounded-lg p-4" variants={fieldVariants}>
            <h4 className="font-semibold text-blue-800 mb-2">Personal Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{s.last_name}, {s.first_name} {s.middle_name} {s.suffix}</span></div>
              <div><span className="text-gray-500">Gender:</span> <span className="font-medium">{s.gender}</span></div>
              <div><span className="text-gray-500">Birth Date:</span> <span className="font-medium">{s.birth_date}</span></div>
              <div><span className="text-gray-500">Age:</span> <span className="font-medium">{calcAge}</span></div>
              <div><span className="text-gray-500">Nationality:</span> <span className="font-medium">{s.nationality}</span></div>
              <div><span className="text-gray-500">Religion:</span> <span className="font-medium">{s.religion || 'N/A'}</span></div>
              <div><span className="text-gray-500">Mother Tongue:</span> <span className="font-medium">{s.mother_tongue || 'N/A'}</span></div>
            </div>
          </motion.div>

          <motion.div className="bg-green-50 border border-green-200 rounded-lg p-4" variants={fieldVariants}>
            <h4 className="font-semibold text-green-800 mb-2">School Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div><span className="text-gray-500">LRN:</span> <span className="font-medium">{s.lrn || 'N/A'}</span></div>
              <div><span className="text-gray-500">Grade Level:</span> <span className="font-medium">{glName ? glName.name : 'N/A'}</span></div>
              <div><span className="text-gray-500">School Year:</span> <span className="font-medium">{syName ? syName.year_name : 'N/A'}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{en.enrollment_type}</span></div>
              <div><span className="text-gray-500">Date:</span> <span className="font-medium">{en.enrollment_date}</span></div>
            </div>
          </motion.div>

          <motion.div className="bg-gray-50 border border-gray-200 rounded-lg p-4" variants={fieldVariants}>
            <h4 className="font-semibold text-gray-800 mb-2">Address</h4>
            <p className="text-sm">{[s.house_no, s.street, s.barangay, s.city_municipality, s.province, s.zip_code].filter(Boolean).join(', ') || 'N/A'}</p>
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{s.contact_number || 'N/A'}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-medium">{s.email || 'N/A'}</span></div>
            </div>
          </motion.div>

          <motion.div className="bg-purple-50 border border-purple-200 rounded-lg p-4" variants={fieldVariants}>
            <h4 className="font-semibold text-purple-800 mb-2">Guardians ({formData.guardians.length})</h4>
            {formData.guardians.map((g, i) => (
              <div key={i} className="text-sm mb-1">
                <span className="font-medium capitalize">{g.relationship}:</span> {g.first_name} {g.middle_name} {g.last_name} {g.contact_number ? '- ' + g.contact_number : ''}
              </div>
            ))}
          </motion.div>

          <motion.div className="bg-orange-50 border border-orange-200 rounded-lg p-4" variants={fieldVariants}>
            <h4 className="font-semibold text-orange-800 mb-2">Documents Submitted</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
              {formData.documents.map((d, i) => (
                <div key={i} className="flex items-center gap-1">
                  {d.is_submitted ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-gray-300" />}
                  <span className={d.is_submitted ? 'text-gray-700' : 'text-gray-400'}>{d.document_name}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="border border-gray-200 rounded-lg p-4" variants={fieldVariants}>
            <h4 className="font-semibold text-gray-800 mb-3">Final Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section Assignment</label>
                <select className="input-field" value={en.section_id} onChange={e => updateEnrollment('section_id', e.target.value)}>
                  <option value="">No Section Yet</option>
                  {sections.map(sec => (
                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Status</label>
                <select className="input-field" value={en.status} onChange={e => updateEnrollment('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="enrolled">Enrolled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Learning Modality</label>
                <select className="input-field" value={en.learning_modality} onChange={e => updateEnrollment('learning_modality', e.target.value)}>
                  <option value="face_to_face">Face to Face</option>
                  <option value="modular">Modular</option>
                  <option value="online">Online</option>
                  <option value="blended">Blended</option>
                  <option value="homeschool">Homeschool</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea className="input-field" rows={3} placeholder="Any additional notes..." value={en.remarks} onChange={e => updateEnrollment('remarks', e.target.value)} />
            </div>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8]

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      <PageHeader title={isEdit ? 'Edit Enrollment' : 'New Enrollment'} subtitle="Complete all steps to enroll a student">
        <motion.button whileHover={{ scale: 1.02, x: -3 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/enrollment')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </motion.button>
      </PageHeader>

      {/* Step Indicator */}
      <motion.div
        className="mb-8 overflow-x-auto"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <div className="flex items-center min-w-max px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isComplete = i < step
            return (
              <div key={i} className="flex items-center">
                <motion.button
                  onClick={() => { if (i < step || validateStep(step)) setStep(i) }}
                  className={'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ' + (isActive ? 'bg-blue-50' : isComplete ? 'bg-green-50' : 'hover:bg-gray-50')}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ' + (isActive ? 'bg-blue-600 text-white' : isComplete ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500')}
                    animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </motion.div>
                  <span className={'text-xs font-medium ' + (isActive ? 'text-blue-700' : isComplete ? 'text-green-700' : 'text-gray-500')}>{s.label}</span>
                </motion.button>
                {i < STEPS.length - 1 && (
                  <motion.div
                    className="w-8 h-0.5"
                    initial={{ backgroundColor: '#e5e7eb' }}
                    animate={{ backgroundColor: i < step ? '#4ade80' : '#e5e7eb' }}
                    transition={{ duration: 0.3 }}
                    style={{ backgroundColor: i < step ? '#4ade80' : '#e5e7eb' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
          variants={stepContentVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {stepRenderers[step]()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.button
          onClick={prevStep}
          disabled={step === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={step > 0 ? { scale: 1.02, x: -3 } : {}}
          whileTap={step > 0 ? { scale: 0.98 } : {}}
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </motion.button>
        <span className="text-sm text-gray-500">Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1 ? (
          <motion.button
            onClick={nextStep}
            className="btn-primary flex items-center gap-2"
            whileHover={{ scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' }}
            whileTap={{ scale: 0.98 }}
          >
            Next <ArrowRight className="w-4 h-4" />
          </motion.button>
        ) : (
          <motion.button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
            whileHover={!saving ? { scale: 1.02, boxShadow: '0 4px 15px rgba(59,130,246,0.3)' } : {}}
            whileTap={!saving ? { scale: 0.98 } : {}}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : (isEdit ? 'Update Enrollment' : 'Submit Enrollment')}
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  )
}
