import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { syncInvoiceFromStudentFee } from '../../lib/invoiceSync'
import { getSavedCashierSchoolYearId, saveCashierSchoolYearId } from '../../lib/schoolYearSelection'
import { useAuth } from '../../contexts/AuthContext'
import GlassCard from '../../components/ui/GlassCard'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonDashboard, SkeletonTable } from '../../components/ui/SkeletonLoader'
import toast from 'react-hot-toast'

const emptyLedger = { fees: [], payments: [], charges: [], feeTypes: [] }
const defaultPaymentForm = { amount: '', payment_method: 'cash', remarks: '', fee_type_id: '' }

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

const formatReceiptDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatPaymentMethod = (value) =>
  String(value || 'cash')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())

const studentName = (student) => {
  if (!student) return ''
  return [student.last_name, student.first_name].filter(Boolean).join(', ')
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

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
  const { user } = useAuth()
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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm)
  const [processing, setProcessing] = useState(false)
  const [receiptModal, setReceiptModal] = useState(null)

  useEffect(() => {
    loadSchoolYears()
  }, [location.search])

  useEffect(() => {
    if (!selectedSY) return
    saveCashierSchoolYearId(selectedSY)
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
      const savedYear = getSavedCashierSchoolYearId()
      const nextYear = years.find(y => y.id === requestedYear) || years.find(y => y.id === savedYear) || years.find(y => y.is_current || y.status === 'active') || years[0]

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
          .select('id, name, school_year_id, is_active')
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
        feeTypes: (feeTypesRes.data || []).filter(type => type.is_active !== false && (!type.school_year_id || type.school_year_id === schoolYearId)),
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

  const getFeeTypeName = (feeTypeId) => ledger.feeTypes.find(type => type.id === feeTypeId)?.name
  const payableFee = useMemo(
    () => ledger.fees.find(row => parseFloat(row.balance || 0) > 0) || null,
    [ledger.fees]
  )

  const openPaymentModal = () => {
    if (!selectedStudent) {
      toast.error('Please select a student first')
      return
    }
    if (!payableFee) {
      toast.error('No outstanding fee found for this student')
      return
    }
    setPaymentForm({ ...defaultPaymentForm, fee_type_id: ledger.feeTypes[0]?.id || '' })
    setShowPaymentModal(true)
  }

  const processLedgerPayment = async (e) => {
    e.preventDefault()
    if (!selectedStudent || !selectedSY) {
      toast.error('Please select a student and school year')
      return
    }
    if (!payableFee) {
      toast.error('No outstanding fee found for this student')
      return
    }
    const amount = parseFloat(paymentForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (amount > parseFloat(payableFee.balance || 0)) {
      toast.error(`Amount exceeds outstanding balance of ${formatCurrency(payableFee.balance)}`)
      return
    }

    setProcessing(true)
    try {
      const orNumber = `OR-${Date.now().toString(36).toUpperCase()}`
      const paymentData = {
        student_id: selectedStudent.id,
        student_fee_id: payableFee.id,
        amount,
        payment_method: paymentForm.payment_method,
        payment_date: new Date().toISOString().split('T')[0],
        remarks: paymentForm.remarks || null,
        or_number: orNumber,
        fee_type_id: paymentForm.fee_type_id || null,
        received_by: user?.id,
        status: 'completed',
        receipt_number: orNumber,
        processed_by: user?.id,
      }
      const { data: payment, error } = await supabase
        .from('payments')
        .insert(paymentData)
        .select()
        .single()
      if (error) throw error

      const { error: receiptError } = await supabase.from('receipts').insert({
        or_number: orNumber,
        payment_id: payment.id,
        student_id: selectedStudent.id,
        amount,
        payment_method: paymentForm.payment_method,
        payment_date: new Date().toISOString().split('T')[0],
        cashier_id: user?.id,
        cashier_name: user?.user_metadata?.first_name
          ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
          : user?.email,
        remarks: paymentForm.remarks || null,
      })
      if (receiptError) throw receiptError

      const newPaid = (parseFloat(payableFee.total_paid) || 0) + amount
      const projectedBalance = (parseFloat(payableFee.total_fees) || 0) - (parseFloat(payableFee.total_discount) || 0) - newPaid
      const { error: updateError } = await supabase
        .from('student_fees')
        .update({
          total_paid: newPaid,
          status: projectedBalance <= 0 ? 'paid' : 'partial',
        })
        .eq('id', payableFee.id)
      if (updateError) throw updateError

      const syncedStudentFee = {
        ...payableFee,
        total_paid: newPaid,
        balance: Math.max(projectedBalance, 0),
        status: projectedBalance <= 0 ? 'paid' : 'partial',
      }
      const { error: invoiceSyncError } = await syncInvoiceFromStudentFee(supabase, {
        studentFee: syncedStudentFee,
        studentId: selectedStudent.id,
        schoolYearId: selectedSY,
        generatedBy: user?.id || null,
      })
      if (invoiceSyncError) throw invoiceSyncError

      const gradeSection = [
        selectedStudent.enrollment?.grade_levels?.name,
        selectedStudent.enrollment?.sections?.name,
      ].filter(Boolean).join(' - ') || '-'
      const cashierName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
        : user?.email || 'Cashier'
      setReceiptModal({
        orNumber,
        studentName: studentName(selectedStudent),
        lrn: selectedStudent.lrn || '-',
        gradeSection,
        schoolYear: selectedYear?.year_name || 'Selected School Year',
        feeType: getFeeTypeName(paymentForm.fee_type_id) || 'General Payment',
        amount,
        method: paymentForm.payment_method,
        paymentDate: new Date().toISOString(),
        cashierName,
        remarks: paymentForm.remarks || '',
        previousBalance: parseFloat(payableFee.balance || 0),
        newBalance: Math.max(projectedBalance, 0),
      })
      toast.success(`Collected ${formatCurrency(amount)} from ${selectedStudent.first_name || 'student'}`)
      setShowPaymentModal(false)
      setPaymentForm(defaultPaymentForm)
      await loadLedger(selectedStudent, selectedSY)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const handlePrintLedger = () => {
    if (!selectedStudent) {
      toast.error('Please select a student first')
      return
    }

    const printWindow = window.open('', '_blank', 'width=900,height=1100')
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to print the ledger.')
      return
    }

    const studentDisplayName = studentName(selectedStudent)
    const gradeSection = [
      selectedStudent.enrollment?.grade_levels?.name,
      selectedStudent.enrollment?.sections?.name,
    ].filter(Boolean).join(' - ') || '-'
    const printedAt = new Date().toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    const statusLabel = (ledgerView.status || 'unpaid').replace('_', ' ').toUpperCase()

    const chargeRows = ledger.charges.length
      ? ledger.charges.map(charge => `
          <tr>
            <td>${escapeHtml(charge.fee_types?.name || 'Fee')}</td>
            <td>${escapeHtml(formatDate(charge.due_date))}</td>
            <td class="amount">${escapeHtml(formatCurrency(charge.amount))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" class="empty">No fee structure found for this grade level.</td></tr>'

    const paymentRows = ledger.payments.length
      ? ledger.payments.map(payment => `
          <tr>
            <td>${escapeHtml(formatDate(payment.payment_date))}</td>
            <td>${escapeHtml(getFeeTypeName(payment.fee_type_id) || payment.or_number || payment.receipt_number || 'Payment')}</td>
            <td>${escapeHtml(payment.or_number || payment.receipt_number || '-')}</td>
            <td>${escapeHtml(payment.payment_method || '-')}</td>
            <td class="amount">${escapeHtml(formatCurrency(payment.amount))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="empty">No payments recorded for this school year.</td></tr>'

    const ledgerRows = ledgerView.rows.length
      ? ledgerView.rows.map(row => `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>
              ${escapeHtml(row.description)}
              ${row.receipt ? `<div class="muted mono">${escapeHtml(row.receipt)}</div>` : ''}
            </td>
            <td class="amount">${row.debit ? escapeHtml(formatCurrency(row.debit)) : '-'}</td>
            <td class="amount">${row.credit ? escapeHtml(formatCurrency(row.credit)) : '-'}</td>
            <td class="amount strong">${escapeHtml(formatCurrency(row.running))}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="empty">No ledger entries yet.</td></tr>'

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Student Ledger - ${escapeHtml(studentDisplayName)}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11px;
              line-height: 1.35;
              background: #fff;
            }
            .sheet { max-width: 190mm; margin: 0 auto; }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 18px;
              padding-bottom: 12px;
              border-bottom: 2px solid #111827;
            }
            .title { font-size: 22px; font-weight: 800; letter-spacing: 0; margin: 0; }
            .subtitle { margin-top: 4px; color: #4b5563; font-size: 12px; }
            .print-meta { text-align: right; color: #4b5563; white-space: nowrap; }
            .block { margin-top: 14px; break-inside: avoid; }
            .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; }
            .panel { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
            .panel-title {
              margin: 0 0 8px;
              font-size: 11px;
              color: #374151;
              text-transform: uppercase;
              letter-spacing: .05em;
              font-weight: 800;
            }
            .info-row { display: grid; grid-template-columns: 95px 1fr; gap: 8px; padding: 3px 0; }
            .label { color: #6b7280; }
            .value { font-weight: 700; color: #111827; }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 12px;
            }
            .summary-card {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px;
              min-height: 58px;
            }
            .summary-label { color: #6b7280; font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: .04em; }
            .summary-value { margin-top: 5px; font-size: 15px; font-weight: 800; }
            .balance-due { color: #b45309; }
            .paid { color: #047857; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th {
              background: #f3f4f6;
              color: #374151;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: .04em;
              text-align: left;
              padding: 7px 8px;
              border: 1px solid #d1d5db;
            }
            td {
              padding: 7px 8px;
              border: 1px solid #d1d5db;
              vertical-align: top;
              overflow-wrap: anywhere;
            }
            .amount { text-align: right; white-space: nowrap; }
            .strong { font-weight: 800; }
            .muted { color: #6b7280; }
            .mono { font-family: "Courier New", monospace; }
            .empty { text-align: center; color: #6b7280; padding: 18px 8px; }
            .section-title {
              margin: 0 0 8px;
              font-size: 13px;
              font-weight: 800;
              color: #111827;
            }
            .signature-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 36px;
              margin-top: 32px;
              break-inside: avoid;
            }
            .signature-line { border-top: 1px solid #111827; padding-top: 6px; text-align: center; color: #374151; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .no-print { display: none; }
              .block { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <section class="header">
              <div>
                <h1 class="title">Student Ledger</h1>
                <div class="subtitle">DepEd School Management System</div>
              </div>
              <div class="print-meta">
                <div><strong>${escapeHtml(selectedYear?.year_name || 'Selected School Year')}</strong></div>
                <div>Printed ${escapeHtml(printedAt)}</div>
              </div>
            </section>

            <section class="block grid">
              <div class="panel">
                <h2 class="panel-title">Student Information</h2>
                <div class="info-row"><div class="label">Name</div><div class="value">${escapeHtml(studentDisplayName)}</div></div>
                <div class="info-row"><div class="label">LRN</div><div class="value mono">${escapeHtml(selectedStudent.lrn || '-')}</div></div>
                <div class="info-row"><div class="label">Grade/Section</div><div class="value">${escapeHtml(gradeSection)}</div></div>
                <div class="info-row"><div class="label">Status</div><div class="value">${escapeHtml(selectedStudent.status || '-')}</div></div>
              </div>
              <div class="panel">
                <h2 class="panel-title">Account Status</h2>
                <div class="info-row"><div class="label">Ledger Status</div><div class="value">${escapeHtml(statusLabel)}</div></div>
                <div class="info-row"><div class="label">School Year</div><div class="value">${escapeHtml(selectedYear?.year_name || '-')}</div></div>
                <div class="info-row"><div class="label">Payments</div><div class="value">${ledger.payments.length}</div></div>
              </div>
            </section>

            <section class="summary">
              <div class="summary-card"><div class="summary-label">Assessment</div><div class="summary-value">${escapeHtml(formatCurrency(ledgerView.totalFees))}</div></div>
              <div class="summary-card"><div class="summary-label">Discount</div><div class="summary-value">${escapeHtml(formatCurrency(ledgerView.totalDiscount))}</div></div>
              <div class="summary-card"><div class="summary-label">Paid</div><div class="summary-value paid">${escapeHtml(formatCurrency(ledgerView.totalPaid))}</div></div>
              <div class="summary-card"><div class="summary-label">Balance</div><div class="summary-value ${ledgerView.balance > 0 ? 'balance-due' : 'paid'}">${escapeHtml(formatCurrency(ledgerView.balance))}</div></div>
            </section>

            <section class="block">
              <h2 class="section-title">Fee Breakdown</h2>
              <table>
                <thead><tr><th>Fee</th><th style="width: 28%;">Due Date</th><th style="width: 25%;">Amount</th></tr></thead>
                <tbody>${chargeRows}</tbody>
              </table>
            </section>

            <section class="block">
              <h2 class="section-title">Payment History</h2>
              <table>
                <thead><tr><th style="width: 16%;">Date</th><th>Fee/Description</th><th style="width: 22%;">OR/Receipt</th><th style="width: 16%;">Method</th><th style="width: 18%;">Amount</th></tr></thead>
                <tbody>${paymentRows}</tbody>
              </table>
            </section>

            <section class="block">
              <h2 class="section-title">Ledger Entries</h2>
              <table>
                <thead><tr><th style="width: 15%;">Date</th><th style="width: 17%;">Type</th><th>Description</th><th style="width: 15%;">Debit</th><th style="width: 15%;">Credit</th><th style="width: 16%;">Balance</th></tr></thead>
                <tbody>${ledgerRows}</tbody>
              </table>
            </section>

            <section class="signature-row">
              <div class="signature-line">Prepared by Cashier</div>
              <div class="signature-line">Received / Verified by</div>
            </section>
          </main>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const handlePrintReceipt = (receipt) => {
    if (!receipt) return

    const printWindow = window.open('', '_blank', 'width=560,height=760')
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to print the receipt.')
      return
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Payment Receipt - ${escapeHtml(receipt.orNumber)}</title>
          <style>
            @page { size: A5 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.35;
              background: #fff;
            }
            .receipt { max-width: 135mm; margin: 0 auto; }
            .header {
              text-align: center;
              padding-bottom: 12px;
              border-bottom: 2px solid #111827;
            }
            .system { font-size: 12px; color: #4b5563; margin-bottom: 4px; }
            .title { font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 0; }
            .or-number {
              display: inline-block;
              margin-top: 8px;
              padding: 5px 10px;
              border: 1px solid #111827;
              border-radius: 6px;
              font-family: "Courier New", monospace;
              font-weight: 800;
            }
            .amount-box {
              margin: 16px 0;
              border: 2px solid #111827;
              border-radius: 10px;
              text-align: center;
              padding: 14px;
              break-inside: avoid;
            }
            .amount-label {
              color: #4b5563;
              text-transform: uppercase;
              font-size: 10px;
              font-weight: 800;
              letter-spacing: .06em;
            }
            .amount { margin-top: 4px; font-size: 28px; font-weight: 800; }
            .section { margin-top: 14px; break-inside: avoid; }
            .section-title {
              margin: 0 0 6px;
              color: #374151;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: .05em;
              font-weight: 800;
            }
            .row {
              display: grid;
              grid-template-columns: 105px 1fr;
              gap: 10px;
              padding: 7px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .label { color: #6b7280; }
            .value { color: #111827; font-weight: 700; overflow-wrap: anywhere; }
            .mono { font-family: "Courier New", monospace; }
            .balance-row {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-top: 12px;
            }
            .balance-card {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px;
            }
            .balance-label {
              color: #6b7280;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 800;
              letter-spacing: .05em;
            }
            .balance-value { margin-top: 4px; font-size: 14px; font-weight: 800; }
            .footer {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 28px;
              margin-top: 36px;
              break-inside: avoid;
            }
            .signature {
              border-top: 1px solid #111827;
              text-align: center;
              padding-top: 6px;
              color: #374151;
              font-size: 11px;
            }
            .note { margin-top: 16px; color: #6b7280; font-size: 10px; text-align: center; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <section class="header">
              <div class="system">DepEd School Management System</div>
              <h1 class="title">Official Receipt</h1>
              <div class="or-number">${escapeHtml(receipt.orNumber)}</div>
            </section>

            <section class="amount-box">
              <div class="amount-label">Amount Received</div>
              <div class="amount">${escapeHtml(formatCurrency(receipt.amount))}</div>
            </section>

            <section class="section">
              <h2 class="section-title">Student Information</h2>
              <div class="row"><div class="label">Student</div><div class="value">${escapeHtml(receipt.studentName)}</div></div>
              <div class="row"><div class="label">LRN</div><div class="value mono">${escapeHtml(receipt.lrn)}</div></div>
              <div class="row"><div class="label">Grade/Section</div><div class="value">${escapeHtml(receipt.gradeSection)}</div></div>
              <div class="row"><div class="label">School Year</div><div class="value">${escapeHtml(receipt.schoolYear)}</div></div>
            </section>

            <section class="section">
              <h2 class="section-title">Payment Details</h2>
              <div class="row"><div class="label">Date</div><div class="value">${escapeHtml(formatReceiptDate(receipt.paymentDate))}</div></div>
              <div class="row"><div class="label">Fee Type</div><div class="value">${escapeHtml(receipt.feeType)}</div></div>
              <div class="row"><div class="label">Method</div><div class="value">${escapeHtml(formatPaymentMethod(receipt.method))}</div></div>
              <div class="row"><div class="label">Cashier</div><div class="value">${escapeHtml(receipt.cashierName)}</div></div>
              ${receipt.remarks ? `<div class="row"><div class="label">Remarks</div><div class="value">${escapeHtml(receipt.remarks)}</div></div>` : ''}
            </section>

            <section class="balance-row">
              <div class="balance-card">
                <div class="balance-label">Previous Balance</div>
                <div class="balance-value">${escapeHtml(formatCurrency(receipt.previousBalance))}</div>
              </div>
              <div class="balance-card">
                <div class="balance-label">New Balance</div>
                <div class="balance-value">${escapeHtml(formatCurrency(receipt.newBalance))}</div>
              </div>
            </section>

            <section class="footer">
              <div class="signature">Cashier</div>
              <div class="signature">Received by</div>
            </section>
            <div class="note">This receipt was generated after payment posting.</div>
          </main>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const handleYearChange = (schoolYearId) => {
    const nextYear = schoolYears.find(y => y.id === schoolYearId)
    saveCashierSchoolYearId(schoolYearId)
    setSelectedSY(schoolYearId)
    setSelectedYear(nextYear || null)
    setSearch('')
    setShowPaymentModal(false)
    setReceiptModal(null)
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={openPaymentModal}
                      disabled={!payableFee}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CreditCard className="w-4 h-4" /> Collect Payment
                    </button>
                    <button
                      onClick={handlePrintLedger}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Printer className="w-4 h-4" /> Print
                    </button>
                  </div>
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
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{getFeeTypeName(payment.fee_type_id) || payment.or_number || payment.receipt_number || 'Payment'}</p>
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

      <AnimatePresence>
        {showPaymentModal && selectedStudent && payableFee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !processing && setShowPaymentModal(false)}
          >
            <motion.form
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              onSubmit={processLedgerPayment}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" /> Collect Payment
                </h3>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{studentName(selectedStudent)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">LRN {selectedStudent.lrn || '-'} · {selectedYear?.year_name || 'Selected SY'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-amber-700 dark:text-amber-300">Balance</p>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(payableFee.balance)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={payableFee.balance || undefined}
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-lg font-bold outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fee Type</label>
                  <select
                    value={paymentForm.fee_type_id}
                    onChange={e => setPaymentForm(prev => ({ ...prev, fee_type_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">General Payment</option>
                    {ledger.feeTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: 'Cash' },
                      { id: 'bank_transfer', label: 'Bank' },
                      { id: 'gcash', label: 'GCash' },
                    ].map(method => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentForm(prev => ({ ...prev, payment_method: method.id }))}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          paymentForm.payment_method === method.id
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-300'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
                  <textarea
                    value={paymentForm.remarks}
                    onChange={e => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Optional notes"
                  />
                </div>

                <button
                  type="submit"
                  disabled={processing || !paymentForm.amount}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:shadow-lg hover:shadow-green-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Collect {paymentForm.amount ? formatCurrency(paymentForm.amount) : 'Payment'}
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {receiptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setReceiptModal(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-5">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment Receipt</h3>
                <p className="text-sm text-gray-400 font-mono mt-1">{receiptModal.orNumber}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-5">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-center border-b border-gray-200 dark:border-gray-800">
                  <p className="text-xs uppercase tracking-wider text-green-700 dark:text-green-300 font-bold">Amount Received</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(receiptModal.amount)}</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    { label: 'Student', value: receiptModal.studentName },
                    { label: 'LRN', value: receiptModal.lrn },
                    { label: 'School Year', value: receiptModal.schoolYear },
                    { label: 'Fee Type', value: receiptModal.feeType },
                    { label: 'Method', value: formatPaymentMethod(receiptModal.method) },
                    { label: 'Date', value: formatReceiptDate(receiptModal.paymentDate) },
                    { label: 'Previous Balance', value: formatCurrency(receiptModal.previousBalance) },
                    { label: 'New Balance', value: formatCurrency(receiptModal.newBalance) },
                  ].map(field => (
                    <div key={field.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                      <span className="text-sm text-gray-500 shrink-0">{field.label}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white text-right break-words">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handlePrintReceipt(receiptModal)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print Receipt
                </button>
                <button
                  onClick={() => setReceiptModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:shadow-lg transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
