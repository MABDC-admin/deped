import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import { ArrowLeft, Pencil, Printer, User, School, MapPin, Users, Heart, Activity, Phone, FileText, CheckCircle, AlertCircle, XCircle, Clock, Download } from 'lucide-react'
import { LEARNER_DOCUMENT_BUCKET, formatFileSize, getDocumentStoragePath } from '../../lib/learnerDocuments'
import toast from 'react-hot-toast'

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

const sectionVariants = {
  initial: { opacity: 0, y: 15 },
  animate: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.1 + i * 0.08 } }),
}

const infoRowVariants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25 } },
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  enrolled: 'bg-green-100 text-green-800 border-green-300',
  dropped: 'bg-red-100 text-red-800 border-red-300',
  transferred_out: 'bg-purple-100 text-purple-800 border-purple-300',
  completed: 'bg-blue-100 text-blue-800 border-blue-300',
}

export default function EnrollmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [enrollment, setEnrollment] = useState(null)
  const [student, setStudent] = useState(null)
  const [guardians, setGuardians] = useState([])
  const [emergencyContacts, setEmergencyContacts] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('personal')

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: enr, error } = await supabase.from('enrollments').select('*, students(*), school_years(year_name), grade_levels(name), sections(name)').eq('id', id).single()
      if (error) throw error
      setEnrollment(enr)
      setStudent(enr.students)

      const [sgRes, ecRes, docRes] = await Promise.all([
        supabase.from('student_guardians').select('*, guardians(*)').eq('student_id', enr.student_id),
        supabase.from('emergency_contacts').select('*').eq('student_id', enr.student_id),
        supabase.from('enrollment_documents').select('*').eq('enrollment_id', id),
      ])
      if (sgRes.data) setGuardians(sgRes.data.map(sg => sg.guardians))
      if (ecRes.data) setEmergencyContacts(ecRes.data)
      if (docRes.data) setDocuments(docRes.data)
    } catch (err) {
      toast.error('Failed to load enrollment details')
      console.error(err)
    }
    setLoading(false)
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const updates = { status: newStatus }
      if (newStatus === 'enrolled') {
        updates.approved_at = new Date().toISOString()
      }
      if (newStatus === 'dropped') {
        updates.date_dropped = new Date().toISOString().split('T')[0]
      }
      const { error } = await supabase.from('enrollments').update(updates).eq('id', id)
      if (error) throw error
      toast.success('Status updated to ' + newStatus)
      fetchData()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const handleOpenDocument = async (document) => {
    const filePath = getDocumentStoragePath(document)
    if (!filePath) {
      toast.error('No uploaded file is attached to this document')
      return
    }

    try {
      const bucket = document.storage_bucket || LEARNER_DOCUMENT_BUCKET
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 300)

      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error('Document file could not be opened')
      console.error(err)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  if (!enrollment || !student) return <div className="text-center py-20 text-gray-500">Enrollment not found</div>

  const s = student
  const en = enrollment

  const tabs = [
    { key: 'personal', label: 'Personal Info', icon: User },
    { key: 'school', label: 'School Info', icon: School },
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'guardians', label: 'Guardians', icon: Users },
    { key: 'profile', label: 'Learner Profile', icon: Heart },
    { key: 'health', label: 'Health', icon: Activity },
    { key: 'emergency', label: 'Emergency', icon: Phone },
    { key: 'documents', label: 'Documents', icon: FileText },
  ]

  const InfoRow = ({ label, value }) => (
    <motion.div className="py-2 grid grid-cols-3 gap-4" variants={infoRowVariants} initial="initial" animate="animate">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 col-span-2">{value || 'N/A'}</dd>
    </motion.div>
  )

  const Badge = ({ value }) => {
    const color = value === true ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
    return <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + color}>{value === true ? 'Yes' : 'No'}</span>
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate">
      <PageHeader title="Enrollment Details" subtitle={'Student: ' + s.last_name + ', ' + s.first_name + ' ' + (s.middle_name || '')}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print
        </motion.button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/enrollment/' + id + '/edit')} className="btn-secondary flex items-center gap-2">
          <Pencil className="w-4 h-4" /> Edit
        </motion.button>
        <motion.button whileHover={{ scale: 1.02, x: -3 }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/enrollment')} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </motion.button>
      </PageHeader>

      {/* Status Banner */}
      <motion.div
        className={'rounded-xl border p-4 mb-6 flex items-center justify-between ' + (statusColors[en.status] || 'bg-gray-100 text-gray-800')}
        variants={sectionVariants}
        custom={0}
        initial="initial"
        animate="animate"
      >
        <div className="flex items-center gap-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}>
            {en.status === 'enrolled' && <CheckCircle className="w-6 h-6" />}
            {en.status === 'pending' && <Clock className="w-6 h-6" />}
            {en.status === 'dropped' && <XCircle className="w-6 h-6" />}
          </motion.div>
          <div>
            <p className="text-lg font-bold capitalize">{en.status}</p>
            <p className="text-sm opacity-80">
              {en.grade_levels ? en.grade_levels.name : ''} &bull; {en.school_years ? en.school_years.year_name : ''} &bull; {en.sections ? en.sections.name : 'No Section'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {en.status === 'pending' && (
            <>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleStatusChange('enrolled')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Approve</motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleStatusChange('dropped')} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</motion.button>
            </>
          )}
          {en.status === 'enrolled' && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleStatusChange('dropped')} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Drop</motion.button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        className="border-b border-gray-200 mb-6 overflow-x-auto"
        variants={sectionVariants}
        custom={1}
        initial="initial"
        animate="animate"
      >
        <div className="flex gap-1 min-w-max">
          {tabs.map((t, tIdx) => {
            const Icon = t.icon
            return (
              <motion.button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ' + (activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === 'personal' && (
            <dl className="divide-y divide-gray-100">
              <InfoRow label="LRN" value={s.lrn} />
              <InfoRow label="Full Name" value={s.last_name + ', ' + s.first_name + ' ' + (s.middle_name || '') + ' ' + (s.suffix || '')} />
              <InfoRow label="Gender" value={s.gender} />
              <InfoRow label="Date of Birth" value={s.birth_date} />
              <InfoRow label="Place of Birth" value={s.birth_place} />
              <InfoRow label="Nationality" value={s.nationality} />
              <InfoRow label="Religion" value={s.religion} />
              <InfoRow label="Mother Tongue" value={s.mother_tongue} />
              <InfoRow label="PSA Birth Cert No." value={s.psa_birth_cert_no} />
            </dl>
          )}

          {activeTab === 'school' && (
            <dl className="divide-y divide-gray-100">
              <InfoRow label="Enrollment Type" value={en.enrollment_type} />
              <InfoRow label="Grade Level" value={en.grade_levels ? en.grade_levels.name : ''} />
              <InfoRow label="School Year" value={en.school_years ? en.school_years.year_name : ''} />
              <InfoRow label="Section" value={en.sections ? en.sections.name : 'Not assigned'} />
              <InfoRow label="Enrollment Date" value={en.enrollment_date} />
              <InfoRow label="Learning Modality" value={en.learning_modality} />
              <InfoRow label="Status" value={en.status} />
              {en.previous_school && <InfoRow label="Previous School" value={en.previous_school} />}
              {en.previous_grade_level && <InfoRow label="Previous Grade" value={en.previous_grade_level} />}
              {en.remarks && <InfoRow label="Remarks" value={en.remarks} />}
            </dl>
          )}

          {activeTab === 'address' && (
            <dl className="divide-y divide-gray-100">
              <InfoRow label="House No." value={s.house_no} />
              <InfoRow label="Street" value={s.street} />
              <InfoRow label="Barangay" value={s.barangay} />
              <InfoRow label="City/Municipality" value={s.city_municipality} />
              <InfoRow label="Province" value={s.province} />
              <InfoRow label="Zip Code" value={s.zip_code} />
              <InfoRow label="Contact Number" value={s.contact_number} />
              <InfoRow label="Email" value={s.email} />
            </dl>
          )}

          {activeTab === 'guardians' && (
            <div className="space-y-4">
              {guardians.length === 0 ? (
                <p className="text-gray-500 text-sm">No guardians recorded.</p>
              ) : guardians.map((g, i) => (
                <motion.div
                  key={i}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <h4 className="font-semibold text-gray-800 mb-2 capitalize">{g.relationship || 'Guardian'}</h4>
                  <dl className="divide-y divide-gray-100">
                    <InfoRow label="Name" value={g.first_name + ' ' + (g.middle_name || '') + ' ' + g.last_name} />
                    <InfoRow label="Contact" value={g.contact_number} />
                    <InfoRow label="Email" value={g.email} />
                    <InfoRow label="Occupation" value={g.occupation} />
                    <InfoRow label="Office Address" value={g.office_address} />
                    <InfoRow label="Office Contact" value={g.office_contact} />
                  </dl>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'profile' && (
            <dl className="divide-y divide-gray-100">
              <div className="py-2 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">Person with Disability</dt>
                <dd className="col-span-2"><Badge value={s.is_pwd} />{s.is_pwd && s.disability_type ? ' - ' + s.disability_type : ''}</dd>
              </div>
              <div className="py-2 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">Indigenous People</dt>
                <dd className="col-span-2"><Badge value={s.is_indigenous_people} />{s.is_indigenous_people && s.ip_group_name ? ' - ' + s.ip_group_name : ''}</dd>
              </div>
              <div className="py-2 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">4Ps Beneficiary</dt>
                <dd className="col-span-2"><Badge value={s.is_4ps_beneficiary} /></dd>
              </div>
              <div className="py-2 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500">Solo Parent Child</dt>
                <dd className="col-span-2"><Badge value={s.is_solo_parent_child} /></dd>
              </div>
              <InfoRow label="Learning Modality" value={s.learning_modality_preference} />
            </dl>
          )}

          {activeTab === 'health' && (
            <dl className="divide-y divide-gray-100">
              <InfoRow label="Medical Conditions" value={s.medical_conditions} />
              <InfoRow label="Allergies" value={s.allergies} />
              <InfoRow label="Immunization Status" value={s.immunization_status} />
            </dl>
          )}

          {activeTab === 'emergency' && (
            <div className="space-y-4">
              {emergencyContacts.length === 0 ? (
                <p className="text-gray-500 text-sm">No emergency contacts recorded.</p>
              ) : emergencyContacts.map((ec, i) => (
                <motion.div
                  key={i}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-800">{ec.full_name}</h4>
                    {ec.is_primary && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Primary</motion.span>}
                  </div>
                  <dl className="divide-y divide-gray-100">
                    <InfoRow label="Relationship" value={ec.relationship} />
                    <InfoRow label="Contact" value={ec.contact_number} />
                    <InfoRow label="Alt Contact" value={ec.alt_contact_number} />
                    <InfoRow label="Address" value={ec.address} />
                  </dl>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-3">
              {documents.length === 0 ? (
                <p className="text-gray-500 text-sm">No documents tracked.</p>
              ) : documents.map((doc, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.05 }}
                >
                  {doc.is_submitted ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className={'text-sm font-medium ' + (doc.is_submitted ? 'text-gray-800' : 'text-gray-400')}>{doc.document_name}</p>
                    {doc.submitted_date && <p className="text-xs text-gray-500">Submitted: {doc.submitted_date}</p>}
                    {getDocumentStoragePath(doc) && (
                      <p className="text-xs text-gray-500">
                        {doc.file_name || 'Uploaded file'}{doc.file_size ? ` - ${formatFileSize(doc.file_size)}` : ''}
                      </p>
                    )}
                    {doc.notes && <p className="text-xs text-gray-500">Notes: {doc.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDocument(doc)}
                    disabled={!getDocumentStoragePath(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Open
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
