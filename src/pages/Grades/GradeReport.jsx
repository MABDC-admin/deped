import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/PageHeader'
import LoadingSpinner from '../../components/LoadingSpinner'
import EmptyState from '../../components/EmptyState'
import {
  FileText, Download, Trophy, TrendingUp, Award, BarChart3,
  Users, Filter, ChevronDown, Star, Medal
} from 'lucide-react'
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts'
import toast from 'react-hot-toast'

const GRADE_COLORS = {
  outstanding: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
  very_satisfactory: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  satisfactory: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800' },
  fairly_satisfactory: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800' },
  did_not_meet: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
}

function getGradeLevel(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return { key: 'did_not_meet', label: '-', icon: null }
  if (n >= 90) return { key: 'outstanding', label: 'Outstanding', icon: '🏆' }
  if (n >= 85) return { key: 'very_satisfactory', label: 'Very Satisfactory', icon: '⭐' }
  if (n >= 80) return { key: 'satisfactory', label: 'Satisfactory', icon: '👍' }
  if (n >= 75) return { key: 'fairly_satisfactory', label: 'Fairly Satisfactory', icon: '📝' }
  return { key: 'did_not_meet', label: 'Did Not Meet', icon: '⚠️' }
}

function gradeColor(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return ''
  if (n >= 90) return 'text-green-700 bg-green-50 font-bold'
  if (n >= 85) return 'text-blue-700 bg-blue-50 font-semibold'
  if (n >= 80) return 'text-yellow-700 bg-yellow-50 font-semibold'
  if (n >= 75) return 'text-orange-700 bg-orange-50 font-medium'
  return 'text-red-700 bg-red-50 font-medium'
}

function GradeBadge({ grade }) {
  const level = getGradeLevel(grade)
  const colors = GRADE_COLORS[level.key]
  return (
    <motion.span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    >
      {level.icon} {level.label}
    </motion.span>
  )
}

function AnimatedNumber({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = typeof value === 'number' ? value : parseFloat(value) || 0
    const duration = 800
    const step = Math.max(0.5, end / (duration / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setDisplay(end); clearInterval(timer) }
      else setDisplay(Math.round(start * 10) / 10)
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  return <span>{Math.round(display * 10) / 10}{suffix}</span>
}

const BAR_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#f43e5e', '#06b6d4', '#84cc16', '#a855f7', '#6366f1', '#d946ef', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#64748b']

export default function GradeReport() {
  const [schoolYears, setSchoolYears] = useState([])
  const [sections, setSections] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [quarters, setQuarters] = useState([])
  const [selectedSY, setSelectedSY] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedGrade, setSelectedGrade] = useState('')
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('cards') // cards | table | charts

  useEffect(() => {
    const fetch = async () => {
      const [sy, sec, gl, q] = await Promise.all([
        supabase.from('school_years').select('*').order('start_date', { ascending: false }),
        supabase.from('sections').select('*, grade_levels(name, level_order)').order('name'),
        supabase.from('grade_levels').select('*').order('level_order'),
        supabase.from('quarters').select('*').order('quarter_number'),
      ])
      const syData = sy.data || []
      setSchoolYears(syData)
      setSections(sec.data || [])
      setGradeLevels(gl.data || [])
      setQuarters(q.data || [])
      const active = syData.find(s => s.status === 'active' || s.is_current)
      if (active) setSelectedSY(active.id)
    }
    fetch()
  }, [])

  useEffect(() => {
    if (!selectedSY || !selectedSection) {
      setGrades([])
      setLoading(false)
      return
    }
    setGrades([])
    fetchGrades(selectedSY, selectedSection)
  }, [selectedSY, selectedSection])

  const fetchGrades = async (schoolYearId = selectedSY, sectionId = selectedSection) => {
    setLoading(true)
    const { data, error } = await supabase.from('quarterly_grades')
      .select('*, students(id, first_name, last_name, middle_name, lrn), subjects(id, name), quarters(id, quarter_number, name)')
      .eq('school_year_id', schoolYearId)
      .eq('section_id', sectionId)
    if (error) { toast.error('Failed to load grades'); console.error(error) }
    else setGrades(data || [])
    setLoading(false)
  }

  const filteredSections = useMemo(() => {
    return sections.filter(s => {
      if (selectedSY && s.school_year_id !== selectedSY) return false
      if (selectedGrade && s.grade_level_id !== selectedGrade) return false
      return true
    })
  }, [sections, selectedGrade, selectedSY])

  // Build student report cards
  const studentReports = useMemo(() => {
    const map = {}
    grades.forEach(g => {
      const sid = g.student_id
      if (!map[sid]) map[sid] = {
        student: g.students,
        subjects: {},
        allGrades: [],
      }
      const subKey = g.subject_id
      if (!map[sid].subjects[subKey]) {
        map[sid].subjects[subKey] = { name: g.subjects?.name || 'Unknown', quarters: {} }
      }
      map[sid].subjects[subKey].quarters[g.quarters?.quarter_number || 0] = {
        grade: g.transmuted_grade,
        descriptor: g.descriptor,
        status: g.status,
      }
      if (g.transmuted_grade) map[sid].allGrades.push(g.transmuted_grade)
    })

    // Compute averages and rank
    const reports = Object.entries(map).map(([id, data]) => {
      const subjectAverages = {}
      Object.entries(data.subjects).forEach(([subId, sub]) => {
        const vals = Object.values(sub.quarters).map(q => q.grade).filter(Boolean)
        subjectAverages[subId] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      })
      const genAvg = data.allGrades.length > 0
        ? data.allGrades.reduce((a, b) => a + b, 0) / data.allGrades.length
        : 0
      return {
        id,
        student: data.student,
        subjects: data.subjects,
        subjectAverages,
        generalAverage: Math.round(genAvg * 100) / 100,
        level: getGradeLevel(genAvg),
      }
    })

    // Sort by general average descending for ranking
    reports.sort((a, b) => b.generalAverage - a.generalAverage)
    reports.forEach((r, i) => { r.rank = i + 1 })

    return reports
  }, [grades])

  // Class-wide subject averages for chart
  const classSubjectAverages = useMemo(() => {
    const subMap = {}
    studentReports.forEach(r => {
      Object.entries(r.subjectAverages).forEach(([subId, avg]) => {
        if (!subMap[subId]) {
          const subName = Object.values(r.subjects).find((_, i) => Object.keys(r.subjects)[i] === subId)?.name || subId
          // Find name from subjects
          Object.entries(r.subjects).forEach(([key, val]) => {
            if (key === subId) subMap[subId] = { name: val.name, total: 0, count: 0 }
          })
        }
        if (subMap[subId] && avg > 0) {
          subMap[subId].total += avg
          subMap[subId].count++
        }
      })
    })
    return Object.entries(subMap)
      .map(([id, data]) => ({
        name: data.name?.length > 12 ? data.name.substring(0, 12) + '…' : data.name,
        fullName: data.name,
        average: data.count > 0 ? Math.round(data.total / data.count * 10) / 10 : 0,
      }))
      .sort((a, b) => b.average - a.average)
  }, [studentReports])

  // Distribution for radar
  const performanceDistribution = useMemo(() => {
    const dist = { Outstanding: 0, 'Very Satisfactory': 0, Satisfactory: 0, 'Fairly Satisfactory': 0, 'Did Not Meet': 0 }
    studentReports.forEach(r => {
      const key = r.level.label
      if (dist[key] !== undefined) dist[key]++
    })
    return Object.entries(dist).map(([name, count]) => ({ name, count }))
  }, [studentReports])

  // Class stats
  const classStats = useMemo(() => {
    if (studentReports.length === 0) return { avg: 0, highest: 0, lowest: 0, total: 0 }
    const avgs = studentReports.map(r => r.generalAverage).filter(a => a > 0)
    return {
      avg: avgs.length > 0 ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 10) / 10 : 0,
      highest: avgs.length > 0 ? Math.max(...avgs) : 0,
      lowest: avgs.length > 0 ? Math.min(...avgs) : 0,
      total: studentReports.length,
    }
  }, [studentReports])

  const subjectsList = useMemo(() => {
    const subs = {}
    grades.forEach(g => {
      if (g.subjects) subs[g.subject_id] = g.subjects.name
    })
    return Object.entries(subs).sort((a, b) => a[1].localeCompare(b[1]))
  }, [grades])

  const quartersList = useMemo(() => {
    const qs = {}
    grades.forEach(g => {
      if (g.quarters) qs[g.quarters.quarter_number] = g.quarters.name
    })
    return Object.entries(qs).sort((a, b) => a[0] - b[0])
  }, [grades])

  const exportCSV = () => {
    if (studentReports.length === 0) return
    const headers = ['Rank', 'LRN', 'Student Name', ...subjectsList.map(([, name]) => name), 'General Average', 'Descriptor']
    const rows = studentReports.map(r => [
      r.rank,
      r.student?.lrn || '',
      `${r.student?.last_name}, ${r.student?.first_name}`,
      ...subjectsList.map(([subId]) => r.subjectAverages[subId]?.toFixed(1) || '-'),
      r.generalAverage.toFixed(1),
      r.level.label,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grade-report.csv'
    a.click()
    toast.success('CSV exported!')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <PageHeader title="Grade Reports" subtitle="View quarterly grades, class rankings, and performance analytics">
        {studentReports.length > 0 && (
          <motion.button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </motion.button>
        )}
      </PageHeader>

      {/* Filters */}
      <motion.div
        className="bg-white rounded-xl border shadow-sm p-5 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">School Year</label>
            <select value={selectedSY} onChange={e => { setSelectedSY(e.target.value); setSelectedSection(''); setGrades([]) }} className="input-field">
              {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.year_name} {sy.status === 'active' || sy.is_current ? '(Active)' : ''}</option>)}
            </select>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Grade Level</label>
            <select value={selectedGrade} onChange={e => { setSelectedGrade(e.target.value); setSelectedSection(''); setGrades([]) }} className="input-field">
              <option value="">All Grades</option>
              {gradeLevels.map(gl => <option key={gl.id} value={gl.id}>{gl.name}</option>)}
            </select>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Section</label>
            <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="input-field">
              <option value="">Select Section</option>
              {filteredSections.map(s => <option key={s.id} value={s.id}>{s.grade_levels?.name} – {s.name}</option>)}
            </select>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-16">
            <LoadingSpinner />
          </motion.div>
        ) : !selectedSection ? (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white rounded-xl border shadow-sm p-12">
            <EmptyState title="Select a section" description="Choose a school year and section to view grade reports." icon={FileText} />
          </motion.div>
        ) : studentReports.length === 0 ? (
          <motion.div key="no-data" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white rounded-xl border shadow-sm p-12">
            <EmptyState title="No grades found" description="No quarterly grade data for this section." icon={FileText} />
          </motion.div>
        ) : (
          <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Class Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Users, label: 'Students', value: classStats.total, color: 'text-gray-700' },
                { icon: TrendingUp, label: 'Class Average', value: classStats.avg, color: 'text-blue-700' },
                { icon: Trophy, label: 'Highest', value: classStats.highest, color: 'text-green-700' },
                { icon: Award, label: 'Lowest', value: classStats.lowest, color: 'text-orange-700' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="bg-white rounded-xl border shadow-sm p-4"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -2 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${stat.color}`}><AnimatedNumber value={stat.value} /></p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color} opacity-30`} />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
              {[
                { key: 'cards', label: 'Report Cards' },
                { key: 'table', label: 'Class Ranking' },
                { key: 'charts', label: 'Analytics' },
              ].map(v => (
                <motion.button
                  key={v.key}
                  onClick={() => setViewMode(v.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === v.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {v.label}
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {viewMode === 'cards' && (
                <motion.div
                  key="cards"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {studentReports.map((report, idx) => {
                    const levelColors = GRADE_COLORS[report.level.key]
                    return (
                      <motion.div
                        key={report.id}
                        className={`bg-white rounded-xl border shadow-sm overflow-hidden`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx, 8) * 0.08 }}
                        whileHover={{ shadow: '0 8px 25px rgba(0,0,0,0.08)' }}
                      >
                        {/* Card Header */}
                        <div className={`px-5 py-4 border-b ${levelColors.bg}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                report.rank <= 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                              }`}>
                                {report.rank <= 3 ? <Medal className="w-5 h-5" /> : report.rank}
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900">
                                  {report.student?.last_name}, {report.student?.first_name} {report.student?.middle_name ? report.student.middle_name.charAt(0) + '.' : ''}
                                </h3>
                                <p className="text-xs text-gray-500">LRN: {report.student?.lrn} · Rank #{report.rank}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-bold ${levelColors.text}`}>{report.generalAverage.toFixed(1)}</p>
                              <GradeBadge grade={report.generalAverage} />
                            </div>
                          </div>
                        </div>

                        {/* Grades Table */}
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                                {quartersList.map(([qNum, qName]) => (
                                  <th key={qNum} className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">{qName}</th>
                                ))}
                                <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Average</th>
                                <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {Object.entries(report.subjects).map(([subId, sub], si) => {
                                const avg = report.subjectAverages[subId] || 0
                                const passed = avg >= 75
                                return (
                                  <motion.tr
                                    key={subId}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + si * 0.03 }}
                                    className="hover:bg-gray-50/50"
                                  >
                                    <td className="px-4 py-2 font-medium text-gray-900">{sub.name}</td>
                                    {quartersList.map(([qNum]) => {
                                      const qData = sub.quarters[parseInt(qNum)]
                                      const grade = qData?.grade
                                      return (
                                        <td key={qNum} className="px-4 py-2 text-center">
                                          {grade ? (
                                            <span className={`inline-block px-2.5 py-0.5 rounded-lg text-sm ${gradeColor(grade)}`}>
                                              {grade}
                                            </span>
                                          ) : (
                                            <span className="text-gray-300">-</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                    <td className="px-4 py-2 text-center">
                                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-sm font-bold ${gradeColor(avg)}`}>
                                        {avg > 0 ? avg.toFixed(1) : '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      {avg > 0 && (
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                          passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                          {passed ? 'PASSED' : 'FAILED'}
                                        </span>
                                      )}
                                    </td>
                                  </motion.tr>
                                )
                              })}
                              {/* General Average Footer */}
                              <tr className="bg-gray-50 font-bold">
                                <td className="px-4 py-2.5 text-gray-900" colSpan={quartersList.length + 1}>General Average</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`inline-block px-3 py-1 rounded-lg text-base ${gradeColor(report.generalAverage)}`}>
                                    {report.generalAverage.toFixed(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <GradeBadge grade={report.generalAverage} />
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}

              {viewMode === 'table' && (
                <motion.div
                  key="table"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-xl border shadow-sm overflow-hidden"
                >
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LRN</th>
                          {subjectsList.map(([id, name]) => (
                            <th key={id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              {name.length > 10 ? name.substring(0, 10) + '…' : name}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase bg-blue-50">GPA</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Descriptor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentReports.map((r, ri) => (
                          <motion.tr
                            key={r.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(ri, 15) * 0.04 }}
                            className={`hover:bg-gray-50/80 ${ri < 3 ? 'bg-yellow-50/30' : ''}`}
                          >
                            <td className="px-4 py-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                ri === 0 ? 'bg-yellow-500' : ri === 1 ? 'bg-gray-400' : ri === 2 ? 'bg-orange-500' : 'bg-gray-300'
                              }`}>
                                {r.rank}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                              {r.student?.last_name}, {r.student?.first_name}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{r.student?.lrn}</td>
                            {subjectsList.map(([subId]) => {
                              const avg = r.subjectAverages[subId]
                              return (
                                <td key={subId} className="px-3 py-2.5 text-center">
                                  {avg > 0 ? (
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${gradeColor(avg)}`}>
                                      {avg.toFixed(0)}
                                    </span>
                                  ) : '-'}
                                </td>
                              )
                            })}
                            <td className="px-4 py-2.5 text-center bg-blue-50/50">
                              <span className={`inline-block px-3 py-1 rounded-lg font-bold ${gradeColor(r.generalAverage)}`}>
                                {r.generalAverage.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <GradeBadge grade={r.generalAverage} />
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {viewMode === 'charts' && (
                <motion.div
                  key="charts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  {/* Subject Averages Bar Chart */}
                  <div className="bg-white rounded-xl border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Class Subject Averages
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={classSubjectAverages} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" domain={[60, 100]} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                          formatter={(val, name, props) => [val.toFixed(1), props.payload.fullName]}
                        />
                        <Bar dataKey="average" radius={[0, 6, 6, 0]} animationDuration={1200}>
                          {classSubjectAverages.map((entry, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Performance Distribution */}
                  <div className="bg-white rounded-xl border shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Star className="w-4 h-4" /> Performance Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={performanceDistribution}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis />
                        <Radar name="Students" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} animationDuration={1200} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top Performers */}
                  <div className="bg-white rounded-xl border shadow-sm p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <Trophy className="w-4 h-4" /> Top 10 Performers
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                      {studentReports.slice(0, 10).map((r, i) => (
                        <motion.div
                          key={r.id}
                          className={`p-3 rounded-xl border text-center ${i < 3 ? 'bg-gradient-to-b from-yellow-50 to-white border-yellow-200' : 'bg-white'}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.06 }}
                          whileHover={{ y: -2 }}
                        >
                          <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-white font-bold text-sm ${
                            i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-500' : 'bg-blue-400'
                          }`}>
                            #{r.rank}
                          </div>
                          <p className="font-semibold text-sm mt-2 text-gray-900">{r.student?.last_name}</p>
                          <p className="text-xs text-gray-500">{r.student?.first_name}</p>
                          <p className={`text-lg font-bold mt-1 ${getGradeLevel(r.generalAverage).key === 'outstanding' ? 'text-green-600' : 'text-blue-600'}`}>
                            {r.generalAverage.toFixed(1)}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
