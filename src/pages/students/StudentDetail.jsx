import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  ArrowLeft, Printer, User, MapPin, Users, Heart, Activity, Phone,
  FileText, History, CheckCircle, AlertCircle, CalendarCheck, BookOpen,
  TrendingUp, Clock, UserX, ShieldCheck, GraduationCap, Award
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Skeleton Loader ─────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
)

const SkeletonCard = () => (
  <div className="card space-y-4">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
  </div>
)

const ProfileSkeleton = () => (
  <div className="space-y-6">
    <div className="card flex items-center gap-6">
      <Skeleton className="w-24 h-24 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
)

// ─── Animated Tab Content Wrapper ────────────────────────────
const TabContent = ({ children, tabKey }) => (
  <motion.div
    key={tabKey}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
)

// ─── Animated Progress Bar ───────────────────────────────────
const AnimatedProgress = ({ value, max = 100, color = 'bg-primary-600', label, sublabel }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">{sublabel || `${pct}%`}</span>
        </div>
      )}
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
  <motion.div
    whileHover={{ y: -2, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)' }}
    transition={{ duration: 0.2 }}
    className="card flex items-center gap-4 cursor-default"
  >
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
    </div>
  </motion.div>
)

// ─── Status Badge ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-green-100 text-green-700 ring-green-600/20',
    enrolled: 'bg-green-100 text-green-700 ring-green-600/20',
    pending: 'bg-yellow-100 text-yellow-700 ring-yellow-600/20',
    dropped: 'bg-red-100 text-red-700 ring-red-600/20',
    transferred_out: 'bg-purple-100 text-purple-700 ring-purple-600/20',
    completed: 'bg-blue-100 text-blue-700 ring-blue-600/20',
    promoted: 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
    archived: 'bg-gray-100 text-gray-700 ring-gray-600/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${styles[status] || styles.active}`}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : 'Active'}
    </span>
  )
}

// ─── Info Row ────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="py-3 grid grid-cols-3 gap-4 border-b border-gray-50 last:border-0">
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="text-sm text-gray-900 col-span-2">{value || <span className="text-gray-300">N/A</span>}</dd>
  </div>
)

const Badge = ({ value }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
    {value ? 'Yes' : 'No'}
  </span>
)

// ─── Grade Color Helper ──────────────────────────────────────
const gradeColor = (grade) => {
  if (!grade && grade !== 0) return 'text-gray-400'
  if (grade >= 90) return 'text-emerald-600 font-bold'
  if (grade >= 85) return 'text-green-600 font-semibold'
  if (grade >= 80) return 'text-blue-600 font-medium'
  if (grade >= 75) return 'text-yellow-600 font-medium'
  return 'text-red-600 font-bold'
}

const gradeBg = (grade) => {
  if (!grade && grade !== 0) return ''
  if (grade >= 90) return 'bg-emerald-50'
  if (grade >= 85) return 'bg-green-50'
  if (grade >= 80) return 'bg-blue-50'
  if (grade >= 75) return 'bg-yellow-50'
  return 'bg-red-50'
}

const CHART_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6']
const ATTENDANCE_COLORS = { present: '#22c55e', absent: '#ef4444', late: '#f59e0b', excused: '#3b82f6' }

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function StudentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [student, setStudent] = useState(null)
  const [guardians, setGuardians] = useState([])
  const [emergencyContacts, setEmergencyContacts] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [documents, setDocuments] = useState([])
  const [attendance, setAttendance] = useState([])
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('personal')
  const [selectedSchoolYear, setSelectedSchoolYear] = useState(null)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch student
      const { data: s, error } = await supabase.from('students').select('*').eq('id', id).single()
      if (error) throw error
      setStudent(s)

      // Fetch all related data in parallel
      const [sgRes, ecRes, enrRes, attRes, gradesRes] = await Promise.all([
        supabase.from('student_guardians').select('*, guardians(*)').eq('student_id', id),
        supabase.from('emergency_contacts').select('*').eq('student_id', id),
        supabase.from('enrollments').select('*, school_years(id, year_name), grade_levels(name), sections(name)').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('attendance_records').select('*').eq('student_id', id).order('date', { ascending: true }),
        supabase.from('quarterly_grades').select('*, subjects(name, short_name, subject_group), quarters(quarter_number, name)').eq('student_id', id),
      ])

      if (sgRes.data) setGuardians(sgRes.data.map(sg => sg.guardians))
      if (ecRes.data) setEmergencyContacts(ecRes.data)
      if (enrRes.data) {
        setEnrollments(enrRes.data)
        // Set default school year to the most recent enrollment
        if (enrRes.data.length > 0 && enrRes.data[0].school_years) {
          setSelectedSchoolYear(enrRes.data[0].school_years.id)
        }
        // Fetch docs for latest enrollment
        if (enrRes.data.length > 0) {
          const { data: docs } = await supabase.from('enrollment_documents').select('*').eq('enrollment_id', enrRes.data[0].id)
          if (docs) setDocuments(docs)
        }
      }
      if (attRes.data) setAttendance(attRes.data)
      if (gradesRes.data) setGrades(gradesRes.data)
    } catch (err) {
      toast.error('Failed to load student data')
      console.error(err)
    }
    setLoading(false)
  }

  // ─── Computed: Attendance Stats ────────────────────────────
  const attendanceStats = useMemo(() => {
    const filtered = selectedSchoolYear
      ? attendance.filter(a => a.school_year_id === selectedSchoolYear)
      : attendance
    const total = filtered.length
    const present = filtered.filter(a => a.status === 'present').length
    const absent = filtered.filter(a => a.status === 'absent').length
    const late = filtered.filter(a => a.status === 'late').length
    const excused = filtered.filter(a => a.status === 'excused').length
    const rate = total > 0 ? ((present + late) / total * 100) : 0

    // Monthly trend
    const monthly = {}
    filtered.forEach(a => {
      const m = a.date.substring(0, 7) // YYYY-MM
      if (!monthly[m]) monthly[m] = { month: m, present: 0, absent: 0, late: 0, excused: 0, total: 0 }
      monthly[m][a.status]++
      monthly[m].total++
    })
    const trend = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      label: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      rate: m.total > 0 ? Math.round((m.present + m.late) / m.total * 100) : 0,
    }))

    // Pie data
    const pieData = [
      { name: 'Present', value: present, color: ATTENDANCE_COLORS.present },
      { name: 'Absent', value: absent, color: ATTENDANCE_COLORS.absent },
      { name: 'Late', value: late, color: ATTENDANCE_COLORS.late },
      { name: 'Excused', value: excused, color: ATTENDANCE_COLORS.excused },
    ].filter(d => d.value > 0)

    return { total, present, absent, late, excused, rate, trend, pieData }
  }, [attendance, selectedSchoolYear])

  // ─── Computed: Grades Stats ────────────────────────────────
  const gradesStats = useMemo(() => {
    const filtered = selectedSchoolYear
      ? grades.filter(g => g.school_year_id === selectedSchoolYear)
      : grades

    // Group by subject
    const bySubject = {}
    filtered.forEach(g => {
      const subName = g.subjects?.name || 'Unknown'
      if (!bySubject[subName]) bySubject[subName] = { name: subName, group: g.subjects?.subject_group, quarters: {} }
      const qNum = g.quarters?.quarter_number || g.quarter_number
      bySubject[subName].quarters[qNum] = g
    })

    // Calculate averages per subject
    const subjectData = Object.values(bySubject).map(sub => {
      const qGrades = Object.values(sub.quarters).map(q => q.transmuted_grade).filter(g => g != null)
      const avg = qGrades.length > 0 ? Math.round(qGrades.reduce((s, g) => s + g, 0) / qGrades.length) : null
      return { ...sub, average: avg }
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    // Overall GPA
    const allAvgs = subjectData.map(s => s.average).filter(a => a != null)
    const gpa = allAvgs.length > 0 ? (allAvgs.reduce((s, a) => s + a, 0) / allAvgs.length).toFixed(1) : null

    // Bar chart data for subjects
    const chartData = subjectData.filter(s => s.average != null).map(s => ({
      name: s.name.length > 12 ? s.name.substring(0, 12) + '…' : s.name,
      fullName: s.name,
      average: s.average,
    }))

    return { subjectData, gpa, chartData }
  }, [grades, selectedSchoolYear])

  // ─── School Years list ─────────────────────────────────────
  const schoolYears = useMemo(() => {
    const syMap = {}
    enrollments.forEach(e => {
      if (e.school_years) syMap[e.school_years.id] = e.school_years.year_name
    })
    return Object.entries(syMap).map(([id, name]) => ({ id, name }))
  }, [enrollments])

  // ─── Current enrollment info ───────────────────────────────
  const currentEnrollment = enrollments.length > 0 ? enrollments[0] : null

  // ─── Tabs ──────────────────────────────────────────────────
  const tabs = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'guardians', label: 'Guardians', icon: Users },
    { key: 'profile', label: 'Learner Profile', icon: Heart },
    { key: 'health', label: 'Health', icon: Activity },
    { key: 'emergency', label: 'Emergency', icon: Phone },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'history', label: 'History', icon: History },
    { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { key: 'grades', label: 'Grades', icon: BookOpen },
  ]

  if (loading) return <ProfileSkeleton />
  if (!student) return <div className="text-center py-20 text-gray-500">Student not found</div>

  const s = student

  return (
    <div className="space-y-6">
      {/* ─── Back & Actions ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/students')} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Students
        </button>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* ─── Profile Header Card ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar / Photo */}
          <div className="relative flex-shrink-0">
            {s.profile_photo_url ? (
              <img
                src={s.profile_photo_url}
                alt={`${s.first_name} ${s.last_name}`}
                className="w-24 h-24 rounded-full object-cover ring-4 ring-primary-100"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center ring-4 ring-primary-100">
                <span className="text-3xl font-bold text-white">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1">
              <StatusBadge status={s.status || 'active'} />
            </div>
          </div>

          {/* Name & Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {s.last_name}, {s.first_name} {s.middle_name || ''} {s.suffix || ''}
            </h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> LRN: <strong className="text-gray-700">{s.lrn || 'N/A'}</strong>
              </span>
              {currentEnrollment && (
                <>
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4" />
                    {currentEnrollment.grade_levels?.name || 'N/A'} — {currentEnrollment.sections?.name || 'N/A'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4" />
                    {currentEnrollment.school_years?.year_name || ''}
                  </span>
                </>
              )}
            </div>
            {/* Quick Stats Row */}
            <div className="flex flex-wrap gap-3 mt-3">
              {attendanceStats.total > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                  <CalendarCheck className="w-3.5 h-3.5" /> {attendanceStats.rate.toFixed(1)}% Attendance
                </span>
              )}
              {gradesStats.gpa && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                  <Award className="w-3.5 h-3.5" /> GPA: {gradesStats.gpa}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── School Year Selector ────────────────────────── */}
      {schoolYears.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <label className="text-sm font-medium text-gray-600">School Year:</label>
          <select
            value={selectedSchoolYear || ''}
            onChange={e => setSelectedSchoolYear(e.target.value)}
            className="input-field w-auto text-sm"
          >
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>{sy.name}</option>
            ))}
          </select>
        </motion.div>
      )}

      {/* ─── Tabs Navigation ─────────────────────────────── */}
      <div className="border-b border-gray-200 overflow-x-auto -mx-2 px-2">
        <div className="flex gap-1 min-w-max">
          {tabs.map(t => {
            const Icon = t.icon
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{t.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── Tab Content ─────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ═══ PERSONAL ═══ */}
        {activeTab === 'personal' && (
          <TabContent tabKey="personal">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" /> Personal Information
              </h3>
              <dl>
                <InfoRow label="LRN" value={s.lrn} />
                <InfoRow label="Full Name" value={`${s.last_name}, ${s.first_name} ${s.middle_name || ''} ${s.suffix || ''}`} />
                <InfoRow label="Gender" value={s.gender} />
                <InfoRow label="Date of Birth" value={s.birth_date} />
                <InfoRow label="Place of Birth" value={s.birth_place} />
                <InfoRow label="Nationality" value={s.nationality} />
                <InfoRow label="Religion" value={s.religion} />
                <InfoRow label="Mother Tongue" value={s.mother_tongue} />
                <InfoRow label="PSA Birth Cert No." value={s.psa_birth_cert_no} />
              </dl>
            </div>
          </TabContent>
        )}

        {/* ═══ ADDRESS ═══ */}
        {activeTab === 'address' && (
          <TabContent tabKey="address">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" /> Address & Contact
              </h3>
              <dl>
                <InfoRow label="House No." value={s.house_no} />
                <InfoRow label="Street" value={s.street} />
                <InfoRow label="Barangay" value={s.barangay} />
                <InfoRow label="City/Municipality" value={s.city_municipality} />
                <InfoRow label="Province" value={s.province} />
                <InfoRow label="Zip Code" value={s.zip_code} />
                <InfoRow label="Contact Number" value={s.contact_number} />
                <InfoRow label="Email" value={s.email} />
              </dl>
            </div>
          </TabContent>
        )}

        {/* ═══ GUARDIANS ═══ */}
        {activeTab === 'guardians' && (
          <TabContent tabKey="guardians">
            <div className="space-y-4">
              {guardians.length === 0 ? (
                <div className="card text-center py-10 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No guardians recorded.</p>
                </div>
              ) : guardians.map((g, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -1, boxShadow: '0 4px 15px -3px rgba(0,0,0,0.08)' }}
                  className="card"
                >
                  <h4 className="font-semibold text-gray-800 mb-3 capitalize flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-500" /> {g.relationship || 'Guardian'}
                  </h4>
                  <dl>
                    <InfoRow label="Name" value={`${g.first_name} ${g.middle_name || ''} ${g.last_name}`} />
                    <InfoRow label="Contact" value={g.contact_number} />
                    <InfoRow label="Email" value={g.email} />
                    <InfoRow label="Occupation" value={g.occupation} />
                  </dl>
                </motion.div>
              ))}
            </div>
          </TabContent>
        )}

        {/* ═══ LEARNER PROFILE ═══ */}
        {activeTab === 'profile' && (
          <TabContent tabKey="profile">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary-600" /> Learner Profile
              </h3>
              <dl>
                <div className="py-3 grid grid-cols-3 gap-4 border-b border-gray-50">
                  <dt className="text-sm font-medium text-gray-500">Person with Disability</dt>
                  <dd className="col-span-2"><Badge value={s.is_pwd} />{s.is_pwd && s.disability_type ? ` — ${s.disability_type}` : ''}</dd>
                </div>
                <div className="py-3 grid grid-cols-3 gap-4 border-b border-gray-50">
                  <dt className="text-sm font-medium text-gray-500">Indigenous People</dt>
                  <dd className="col-span-2"><Badge value={s.is_indigenous_people} />{s.is_indigenous_people && s.ip_group_name ? ` — ${s.ip_group_name}` : ''}</dd>
                </div>
                <div className="py-3 grid grid-cols-3 gap-4 border-b border-gray-50">
                  <dt className="text-sm font-medium text-gray-500">4Ps Beneficiary</dt>
                  <dd className="col-span-2"><Badge value={s.is_4ps_beneficiary} /></dd>
                </div>
                <div className="py-3 grid grid-cols-3 gap-4 border-b border-gray-50">
                  <dt className="text-sm font-medium text-gray-500">Solo Parent Child</dt>
                  <dd className="col-span-2"><Badge value={s.is_solo_parent_child} /></dd>
                </div>
                <InfoRow label="Learning Modality" value={s.learning_modality_preference} />
              </dl>
            </div>
          </TabContent>
        )}

        {/* ═══ HEALTH ═══ */}
        {activeTab === 'health' && (
          <TabContent tabKey="health">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-600" /> Health Information
              </h3>
              <dl>
                <InfoRow label="Medical Conditions" value={s.medical_conditions} />
                <InfoRow label="Allergies" value={s.allergies} />
                <InfoRow label="Immunization Status" value={s.immunization_status} />
              </dl>
            </div>
          </TabContent>
        )}

        {/* ═══ EMERGENCY ═══ */}
        {activeTab === 'emergency' && (
          <TabContent tabKey="emergency">
            <div className="space-y-4">
              {emergencyContacts.length === 0 ? (
                <div className="card text-center py-10 text-gray-500">
                  <Phone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No emergency contacts recorded.</p>
                </div>
              ) : emergencyContacts.map((ec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -1, boxShadow: '0 4px 15px -3px rgba(0,0,0,0.08)' }}
                  className="card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-semibold text-gray-800">{ec.full_name}</h4>
                    {ec.is_primary && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">Primary</span>
                    )}
                  </div>
                  <dl>
                    <InfoRow label="Relationship" value={ec.relationship} />
                    <InfoRow label="Contact" value={ec.contact_number} />
                    <InfoRow label="Alt Contact" value={ec.alt_contact_number} />
                    <InfoRow label="Address" value={ec.address} />
                  </dl>
                </motion.div>
              ))}
            </div>
          </TabContent>
        )}

        {/* ═══ DOCUMENTS ═══ */}
        {activeTab === 'documents' && (
          <TabContent tabKey="documents">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" /> Enrollment Documents
              </h3>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No documents tracked yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {doc.is_submitted ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${doc.is_submitted ? 'text-gray-800' : 'text-gray-400'}`}>
                          {doc.document_name}
                        </p>
                        {doc.submitted_date && (
                          <p className="text-xs text-gray-500">Submitted: {doc.submitted_date}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </TabContent>
        )}

        {/* ═══ ENROLLMENT HISTORY ═══ */}
        {activeTab === 'history' && (
          <TabContent tabKey="history">
            <div className="space-y-4">
              {enrollments.length === 0 ? (
                <div className="card text-center py-10 text-gray-500">
                  <History className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p>No enrollment history.</p>
                </div>
              ) : enrollments.map((en, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -2, boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}
                  className="card flex items-center justify-between cursor-pointer"
                  onClick={() => navigate('/enrollment/' + en.id)}
                >
                  <div>
                    <p className="font-semibold text-gray-800">
                      {en.grade_levels?.name || '-'} — {en.sections?.name || 'No Section'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {en.school_years?.year_name || '-'} &bull; {en.enrollment_type} &bull; {en.enrollment_date}
                    </p>
                  </div>
                  <StatusBadge status={en.status} />
                </motion.div>
              ))}
            </div>
          </TabContent>
        )}

        {/* ═══ ATTENDANCE ═══ */}
        {activeTab === 'attendance' && (
          <TabContent tabKey="attendance">
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={CalendarCheck} label="Total Days" value={attendanceStats.total} color="bg-gray-600" />
                <StatCard icon={CheckCircle} label="Present" value={attendanceStats.present} color="bg-green-500" />
                <StatCard icon={UserX} label="Absent" value={attendanceStats.absent} color="bg-red-500" />
                <StatCard icon={Clock} label="Late" value={attendanceStats.late} color="bg-yellow-500" />
                <StatCard icon={ShieldCheck} label="Excused" value={attendanceStats.excused} color="bg-blue-500" />
              </div>

              {/* Attendance Rate Progress */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Attendance Rate</h3>
                <AnimatedProgress
                  value={attendanceStats.rate}
                  max={100}
                  color={attendanceStats.rate >= 90 ? 'bg-green-500' : attendanceStats.rate >= 75 ? 'bg-yellow-500' : 'bg-red-500'}
                  label="Overall Attendance"
                  sublabel={`${attendanceStats.rate.toFixed(1)}%`}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Based on {attendanceStats.total} school days recorded
                </p>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <div className="card lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Attendance Trend</h3>
                  {attendanceStats.trend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={attendanceStats.trend}>
                        <defs>
                          <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <Area type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2.5} fill="url(#colorRate)" name="Attendance Rate" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-gray-400">No data available</div>
                  )}
                </div>

                {/* Pie Chart */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Breakdown</h3>
                  {attendanceStats.pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={attendanceStats.pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {attendanceStats.pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[250px] text-gray-400">No data available</div>
                  )}
                </div>
              </div>

              {/* Status Breakdown Bars */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Breakdown</h3>
                <div className="space-y-3">
                  <AnimatedProgress value={attendanceStats.present} max={attendanceStats.total} color="bg-green-500" label="Present" sublabel={`${attendanceStats.present} days`} />
                  <AnimatedProgress value={attendanceStats.absent} max={attendanceStats.total} color="bg-red-500" label="Absent" sublabel={`${attendanceStats.absent} days`} />
                  <AnimatedProgress value={attendanceStats.late} max={attendanceStats.total} color="bg-yellow-500" label="Late" sublabel={`${attendanceStats.late} days`} />
                  <AnimatedProgress value={attendanceStats.excused} max={attendanceStats.total} color="bg-blue-500" label="Excused" sublabel={`${attendanceStats.excused} days`} />
                </div>
              </div>
            </div>
          </TabContent>
        )}

        {/* ═══ GRADES ═══ */}
        {activeTab === 'grades' && (
          <TabContent tabKey="grades">
            <div className="space-y-6">
              {/* GPA Card */}
              {gradesStats.gpa && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="card bg-gradient-to-r from-primary-800 to-primary-600 text-white"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-primary-200 text-sm font-medium">Overall General Average</p>
                      <p className="text-4xl font-bold mt-1">{gradesStats.gpa}</p>
                      <p className="text-primary-200 text-sm mt-1">
                        {parseFloat(gradesStats.gpa) >= 90 ? 'Outstanding' :
                         parseFloat(gradesStats.gpa) >= 85 ? 'Very Satisfactory' :
                         parseFloat(gradesStats.gpa) >= 80 ? 'Satisfactory' :
                         parseFloat(gradesStats.gpa) >= 75 ? 'Fairly Satisfactory' : 'Did Not Meet Expectations'}
                      </p>
                    </div>
                    <Award className="w-16 h-16 text-primary-200 opacity-50" />
                  </div>
                </motion.div>
              )}

              {/* Subject Chart */}
              {gradesStats.chartData.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Subject Averages</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gradesStats.chartData} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.[0]) {
                            const d = payload[0].payload
                            return (
                              <div className="bg-white shadow-lg rounded-lg p-3 border text-sm">
                                <p className="font-semibold">{d.fullName}</p>
                                <p className={gradeColor(d.average)}>Average: {d.average}</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar dataKey="average" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {gradesStats.chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.average >= 90 ? '#22c55e' : entry.average >= 85 ? '#4ade80' : entry.average >= 80 ? '#3b82f6' : entry.average >= 75 ? '#f59e0b' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Grades Table */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quarterly Grades</h3>
                {gradesStats.subjectData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>No grades recorded for this school year.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left font-semibold text-gray-600">Subject</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Q1</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Q2</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Q3</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Q4</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Average</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-600">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {gradesStats.subjectData.map((sub, i) => (
                          <motion.tr
                            key={i}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3 font-medium text-gray-800">{sub.name}</td>
                            {[1, 2, 3, 4].map(q => {
                              const g = sub.quarters[q]?.transmuted_grade
                              return (
                                <td key={q} className={`px-4 py-3 text-center ${gradeColor(g)} ${gradeBg(g)}`}>
                                  {g ?? '—'}
                                </td>
                              )
                            })}
                            <td className={`px-4 py-3 text-center ${gradeColor(sub.average)} ${gradeBg(sub.average)} font-bold`}>
                              {sub.average ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {sub.average != null && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  sub.average >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {sub.average >= 75 ? 'Passed' : 'Failed'}
                                </span>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                      {/* GPA Footer */}
                      {gradesStats.gpa && (
                        <tfoot>
                          <tr className="bg-gray-50 border-t-2 border-gray-200">
                            <td className="px-4 py-3 font-bold text-gray-800" colSpan={5}>General Average</td>
                            <td className={`px-4 py-3 text-center font-bold text-lg ${gradeColor(parseFloat(gradesStats.gpa))}`}>
                              {gradesStats.gpa}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                parseFloat(gradesStats.gpa) >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                parseFloat(gradesStats.gpa) >= 85 ? 'bg-green-100 text-green-700' :
                                parseFloat(gradesStats.gpa) >= 80 ? 'bg-blue-100 text-blue-700' :
                                parseFloat(gradesStats.gpa) >= 75 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {parseFloat(gradesStats.gpa) >= 90 ? 'Outstanding' :
                                 parseFloat(gradesStats.gpa) >= 85 ? 'Very Satisfactory' :
                                 parseFloat(gradesStats.gpa) >= 80 ? 'Satisfactory' :
                                 parseFloat(gradesStats.gpa) >= 75 ? 'Fairly Satisfactory' :
                                 'Did Not Meet Expectations'}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            </div>
          </TabContent>
        )}
      </AnimatePresence>
    </div>
  )
}
