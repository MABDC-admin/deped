import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  Printer,
  Receipt,
  Search,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import GlassCard from '../../components/ui/GlassCard'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonDashboard, SkeletonTable } from '../../components/ui/SkeletonLoader'
import toast from 'react-hot-toast'

const emptyLedger = { fees: [], payments: [], charges: [], feeTypes: [] }

const formatCurrency = (amount) =>
  `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const studentName = (student) => {
  if (!student) return ''
  return [student.last_name, student.first_name].filter(Boolean).join(', ')
}

function MetricCard({ label, value, sub, icon: Icon, tone = 'text-gray-700' }) {
  return (
    <GlassCard className="p-4" hover={false}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`mt-1 text-xl font-bold ${tone} dark:text-white`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400 truncate">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center shrink-0">
          <Icon className={`w-5 h-5 ${tone}`} />
        </div>
      </div>
    </GlassCard>
  )
}

export default function CashierLedger() {
  const location = useLocation()
  const navigate = useNavigate()
  const [schoolYears, setSchoolYears] = useState([])
  const [selectedSY, setSelectedSY] = useState('')
  const [selectedYear, setSelectedYear] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledger, setLedger] = useState(emptyLedger)

  useEffect(() => {
    loadSchoolYears()
  }, [location.search])

  useEffect(() => {
    if (!selectedSY) return
    loadStudents(selectedSY)
  }, [selectedSY])

  useEffect(() => {
    if (!selectedStudent || !selectedSY) {
      setLedger(emptyLedger)
      return
    }
    loadLedger(selectedStudent, selectedSY)
  }, [selectedStudent?.id, selectedSY])

  const loadSchoolYears = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('school_years')
        .select('id, year_name, status, is_current, start_date')
        .order('start_date', { ascending: false })

      if (error) throw error
      const years = data || []
      const requestedYear = new URLSearchParams(location.search).get('school_year_id')
      const nextYear = years.find(y => y.id === requestedYear) || years.find(y => y.is_current || y.status === 'active') || years[0]

      setSchoolYears(years)
      setSelectedSY(nextYear?.id || '')
      setSelectedYear(nextYear || null)
      if (!nextYear) setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load school years')
      setLoading(false)
    }
  }

  const loadStudents = async (schoolYearId) => {
    setStudentsLoading(true)
    setSelectedStudent(null)
    setLedger(emptyLedger)
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, status, school_year_id, grade_level_id, section_id, enrollment_date, created_at, students(id, lrn, first_name, middle_name, last_name, suffix, gender, status), grade_levels(id, name), sections(id, name)')
        .eq('school_year_id', schoolYearId)
        .eq('status', 'enrolled')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) throw error

      const roster = (data || [])
        .filter(row => row.students)
        .map(row => ({
          ...row.students,
          enrollment: {
            id: row.id,
            status: row.status,
            school_year_id: row.school_year_id,
            grade_level_id: row.grade_level_id,
            section_id: row.section_id,
            enrollment_date: row.enrollment_date,
            created_at: row.created_at,
            grade_levels: row.grade_levels,
            sections: row.sections,
          },
        }))
        .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))

      const params = new URLSearchParams(location.search)
      const requestedStudent = params.get('student_id')
      const nextStudent = roster.find(s => s.id === requestedStudent) || null

      setStudents(roster)
      setSelectedStudent(nextStudent)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load enrolled students')
      setStudents([])
    } finally {
      setStudentsLoading(false)
      setLoading(false)
    }
  }

  const loadLedger = async (student, schoolYearId) => {
    setLedgerLoading(true)
    try {
      const gradeLevelId = student.enrollment?.grade_level_id
      const chargesQuery = gradeLevelId
        ? supabase
            .from('fee_structures')
            .select('id, amount, due_date, created_at, fee_types(name)')
            .eq('school_year_id', schoolYearId)
            .eq('grade_level_id', gradeLevelId)
            .order('due_date', { ascending: true })
        : Promise.resolve({ data: [], error: null })

      const [feesRes, paymentsRes, chargesRes, feeTypesRes] = await Promise.all([
        supabase
          .from('student_fees')
          .select('id, total_fees, total_discount, total_paid, balance, status, created_at, updated_at, school_years(year_name)')
          .eq('student_id', student.id)
          .eq('school_year_id', schoolYearId)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('id, amount, payment_method, payment_date, created_at, status, receipt_number, or_number, reference_number, remarks, is_refunded, fee_type_id, student_fees!inner(school_year_id)')
          .eq('student_id', student.id)
          .eq('student_fees.school_year_id', schoolYearId)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false }),
        chargesQuery,
        supabase
          .from('fee_types')
          .select('id, name')
          .order('name'),
      ])

      if (feesRes.error) throw feesRes.error
      if (paymentsRes.error) throw paymentsRes.error
      if (chargesRes.error) throw chargesRes.error
      if (feeTypesRes.error) throw feeTypesRes.error

      setLedger({
        fees: feesRes.data || [],
        payments: paymentsRes.data || [],
        charges: chargesRes.data || [],
        feeTypes: feeTypesRes.data || [],
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load student ledger')
      setLedger(emptyLedger)
    } finally {
      setLedgerLoading(false)
    }
  }

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students.slice(0, 80)
    return students.filter(student => {
      const forward = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase()
      const reverse = `${student.last_name || ''} ${student.first_name || ''}`.toLowerCase()
      return forward.includes(q) || reverse.includes(q) || (student.lrn || '').toLowerCase().includes(q)
    }).slice(0, 80)
  }, [students, search])

  const ledgerView = useMemo(() => {
    const feeTotal = ledger.fees.reduce((sum, row) => sum + (parseFloat(row.total_fees) || 0), 0)
    const chargeTotal = ledger.charges.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0)
    const totalFees = feeTotal || chargeTotal
    const totalDiscount = ledger.fees.reduce((sum, row) => sum + (parseFloat(row.total_discount) || 0), 0)
    const paidFromFees = ledger.fees.reduce((sum, row) => sum + (parseFloat(row.total_paid) || 0), 0)
    const paidFromPayments = ledger.payments
      .filter(payment => !payment.is_refunded && ['completed', 'paid'].includes(payment.status || 'completed'))
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0)
    const totalPaid = paidFromFees || paidFromPayments
    const balanceFromFees = ledger.fees.reduce((sum, row) => sum + (parseFloat(row.balance) || 0), 0)
    const balance = ledger.fees.length ? balanceFromFees : Math.max(totalFees - totalDiscount - totalPaid, 0)
    const status = ledger.fees[0]?.status || (balance <= 0 && totalFees > 0 ? 'paid' : balance < totalFees ? 'partial' : 'unpaid')

    const entries = []
    if (totalFees > 0) {
      entries.push({
        key: 'assessment',
        date: ledger.fees[0]?.created_at || selectedStudent?.enrollment?.created_at,
        type: 'Assessment',
        description: 'School year assessment',
        debit: totalFees,
        credit: 0,
      })
    }
    if (totalDiscount > 0) {
      entries.push({
        key: 'discount',
        date: ledger.fees[0]?.created_at || selectedStudent?.enrollment?.created_at,
        type: 'Discount',
        description: 'Approved discount',
        debit: 0,
        credit: totalDiscount,
      })
    }
    const feeTypeName = (feeTypeId) => ledger.feeTypes.find(type => type.id === feeTypeId)?.name

    ledger.payments.forEach(payment => {
      entries.push({
        key: payment.id,
        date: payment.payment_date || payment.created_at,
        type: payment.is_refunded ? 'Refunded Payment' : 'Payment',
        description: feeTypeName(payment.fee_type_id) || payment.remarks || payment.or_number || payment.receipt_number || 'Payment received',
        debit: 0,
        credit: parseFloat(payment.amount) || 0,
        receipt: payment.or_number || payment.receipt_number,
      })
    })

    let running = 0
    const rows = entries
      .sort((a, b) => {
        const dateDiff = new Date(a.date || 0) - new Date(b.date || 0)
        if (dateDiff !== 0) return dateDiff
        return (a.debit ? 0 : 1) - (b.debit ? 0 : 1)
      })
      .map(entry => {
        running += (entry.debit || 0) - (entry.credit || 0)
        return { ...entry, running }
      })

    return { totalFees, totalDiscount, totalPaid, balance, status, rows }
  }, [ledger, selectedStudent])

  const handleYearChange = (schoolYearId) => {
    const nextYear = schoolYears.find(y => y.id === schoolYearId)
    setSelectedSY(schoolYearId)
    setSelectedYear(nextYear || null)
    setSearch('')
  }

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-green-500" /> Student Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedYear?.year_name || 'Selected school year'} financial records
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedSY}
              onChange={e => handleYearChange(e.target.value)}
              className="w-full sm:w-56 pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-sm font-medium text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-green-500"
            >
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.year_name}{sy.is_current || sy.status === 'active' ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => navigate(selectedSY ? `/portal/cashier/process?school_year_id=${selectedSY}` : '/portal/cashier/process')}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all"
          >
            <CreditCard className="w-4 h-4" /> Process Payment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <GlassCard className="p-4" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-green-500" /> Students
            </h2>
            <span className="text-xs text-gray-400">{students.length} enrolled</span>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or LRN"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-sm outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {studentsLoading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading students...</p>
            ) : filteredStudents.length === 0 ? (
              <EmptyState title="No students found" description="No enrolled students match this school year and search." className="py-10" />
            ) : (
              filteredStudents.map(student => {
                const active = selectedStudent?.id === student.id
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      active
                        ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                        : 'border-gray-100 dark:border-gray-800 hover:border-green-200 hover:bg-green-50/50 dark:hover:bg-green-900/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {student.first_name?.charAt(0)}{student.last_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{studentName(student)}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">LRN: {student.lrn || '-'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {student.enrollment?.grade_levels?.name || '-'}{student.enrollment?.sections?.name ? ` - ${student.enrollment.sections.name}` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </GlassCard>

        <div className="space-y-6 min-w-0">
          {!selectedStudent ? (
            <GlassCard className="p-6" hover={false}>
              <EmptyState
                icon={User}
                title="Select a student"
                description="Choose an enrolled student to view assessments, payments, and running balance."
              />
            </GlassCard>
          ) : ledgerLoading ? (
            <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>
          ) : (
            <>
              <GlassCard className="p-5" hover={false}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                      {selectedStudent.first_name?.charAt(0)}{selectedStudent.last_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">{studentName(selectedStudent)}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        LRN {selectedStudent.lrn || '-'} · {selectedStudent.enrollment?.grade_levels?.name || '-'}{selectedStudent.enrollment?.sections?.name ? ` - ${selectedStudent.enrollment.sections.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
              </GlassCard>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard label="Assessment" value={formatCurrency(ledgerView.totalFees)} sub={selectedYear?.year_name} icon={FileText} tone="text-blue-600" />
                <MetricCard label="Discount" value={formatCurrency(ledgerView.totalDiscount)} sub="Applied credits" icon={CheckCircle2} tone="text-violet-600" />
                <MetricCard label="Paid" value={formatCurrency(ledgerView.totalPaid)} sub={`${ledger.payments.length} payment${ledger.payments.length !== 1 ? 's' : ''}`} icon={Banknote} tone="text-green-600" />
                <MetricCard label="Balance" value={formatCurrency(ledgerView.balance)} sub={ledgerView.status} icon={AlertCircle} tone={ledgerView.balance > 0 ? 'text-amber-600' : 'text-green-600'} />
              </div>

              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
                <GlassCard className="p-5" hover={false}>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-500" /> Fee Breakdown
                  </h3>
                  {ledger.charges.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">No fee structure found for this grade level.</p>
                  ) : (
                    <div className="space-y-2">
                      {ledger.charges.map(charge => (
                        <div key={charge.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{charge.fee_types?.name || 'Fee'}</p>
                            <p className="text-xs text-gray-400">Due {formatDate(charge.due_date)}</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(charge.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>

                <GlassCard className="p-5" hover={false}>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-green-500" /> Payment History
                  </h3>
                  {ledger.payments.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">No payments recorded for this school year.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {ledger.payments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{ledger.feeTypes.find(type => type.id === payment.fee_type_id)?.name || payment.or_number || payment.receipt_number || 'Payment'}</p>
                            <p className="text-xs text-gray-400">{formatDate(payment.payment_date)} · {payment.payment_method || '-'}</p>
                          </div>
                          <p className="text-sm font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>

              <GlassCard className="overflow-hidden" hover={false} padding="">
                <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-green-500" /> Ledger Entries
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                      <tr>
                        {['Date', 'Type', 'Description', 'Debit', 'Credit', 'Balance'].map(header => (
                          <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {ledgerView.rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No ledger entries yet.</td>
                        </tr>
                      ) : (
                        ledgerView.rows.map(entry => (
                          <motion.tr key={entry.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-green-50/30 dark:hover:bg-green-900/10">
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(entry.date)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{entry.type}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 min-w-56">
                              {entry.description}
                              {entry.receipt && <span className="block text-xs text-gray-400 font-mono">{entry.receipt}</span>}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{entry.debit ? formatCurrency(entry.debit) : '-'}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-600">{entry.credit ? formatCurrency(entry.credit) : '-'}</td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(entry.running)}</td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
