import { Fragment, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CreditCard,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import GlassCard from '../../components/ui/GlassCard'
import EmptyState from '../../components/ui/EmptyState'
import { SkeletonDashboard, SkeletonTable } from '../../components/ui/SkeletonLoader'
import toast from 'react-hot-toast'

const defaultLoanForm = {
  school_year_id: '',
  borrower_name: '',
  lender_name: '',
  purpose: '',
  principal_amount: '',
  interest_rate: '0',
  term_months: '12',
  start_date: new Date().toISOString().split('T')[0],
  due_date: '',
  payment_frequency: 'monthly',
  paid_amount: '0',
  status: 'active',
  notes: '',
}

const defaultPaymentForm = {
  amount: '',
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: 'cash',
  reference_number: '',
  remarks: '',
}

const statusStyles = {
  active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  restructured: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  written_off: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'gcash', label: 'GCash' },
]

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one_time', label: 'One Time' },
]

const numeric = value => parseFloat(value || 0) || 0
const formatCurrency = amount => `₱${numeric(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
const formatDate = value => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
const titleCase = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())

const totalPayable = loan => numeric(loan.principal_amount) + (numeric(loan.principal_amount) * numeric(loan.interest_rate) / 100)
const outstandingBalance = loan => Math.max(totalPayable(loan) - numeric(loan.paid_amount), 0)
const isPastDue = loan => {
  if (!loan?.due_date || ['paid', 'cancelled', 'written_off'].includes(loan.status)) return false
  const due = new Date(loan.due_date)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today && outstandingBalance(loan) > 0
}
const displayStatus = loan => outstandingBalance(loan) <= 0.005 ? 'paid' : isPastDue(loan) ? 'overdue' : loan.status || 'active'

const addMonths = (dateValue, months) => {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  date.setMonth(date.getMonth() + (parseInt(months, 10) || 0))
  return date.toISOString().split('T')[0]
}

const normalizeStatus = loan => {
  const balance = outstandingBalance(loan)
  if (balance <= 0.005) return 'paid'
  if (loan.status === 'paid') return 'active'
  if (loan.due_date && isPastDue({ ...loan, status: loan.status || 'active' })) return 'overdue'
  return loan.status || 'active'
}

export default function LoanList() {
  const { user } = useAuth()
  const [loans, setLoans] = useState([])
  const [schoolYears, setSchoolYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [paymentLoan, setPaymentLoan] = useState(null)
  const [expandedLoanId, setExpandedLoanId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultLoanForm)
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [loansRes, paymentsRes, yearsRes] = await Promise.all([
        supabase
          .from('loans')
          .select('*, school_years(year_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('loan_payments')
          .select('*')
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('school_years')
          .select('id, year_name, status, is_current, start_date')
          .order('start_date', { ascending: false }),
      ])

      if (loansRes.error) throw loansRes.error
      if (paymentsRes.error) throw paymentsRes.error
      if (yearsRes.error) throw yearsRes.error

      const paymentsByLoan = (paymentsRes.data || []).reduce((map, payment) => {
        if (!map[payment.loan_id]) map[payment.loan_id] = []
        map[payment.loan_id].push(payment)
        return map
      }, {})

      setLoans((loansRes.data || []).map(loan => ({
        ...loan,
        loan_payments: paymentsByLoan[loan.id] || [],
      })))
      setSchoolYears(yearsRes.data || [])
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to load loans')
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const openLoans = loans.filter(loan => !['paid', 'cancelled', 'written_off'].includes(displayStatus(loan)))
    const totalPrincipal = loans.reduce((sum, loan) => sum + numeric(loan.principal_amount), 0)
    const totalPaid = loans.reduce((sum, loan) => sum + numeric(loan.paid_amount), 0)
    const outstanding = loans.reduce((sum, loan) => sum + outstandingBalance(loan), 0)
    const overdue = loans.filter(loan => displayStatus(loan) === 'overdue').length
    return { totalPrincipal, totalPaid, outstanding, activeCount: openLoans.length, overdue }
  }, [loans])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return loans.filter(loan => {
      const status = displayStatus(loan)
      const matchStatus = statusFilter === 'all' || status === statusFilter
      const matchSearch = !q
        || (loan.borrower_name || '').toLowerCase().includes(q)
        || (loan.lender_name || '').toLowerCase().includes(q)
        || (loan.purpose || '').toLowerCase().includes(q)
        || (loan.notes || '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [loans, search, statusFilter])

  const activeSchoolYear = useMemo(
    () => schoolYears.find(sy => sy.is_current || sy.status === 'active') || schoolYears[0] || null,
    [schoolYears]
  )

  const openAddModal = () => {
    setEditingLoan(null)
    setForm({ ...defaultLoanForm, school_year_id: activeSchoolYear?.id || '', due_date: addMonths(defaultLoanForm.start_date, defaultLoanForm.term_months) })
    setShowModal(true)
  }

  const openEditModal = (loan) => {
    setEditingLoan(loan)
    setForm({
      school_year_id: loan.school_year_id || '',
      borrower_name: loan.borrower_name || '',
      lender_name: loan.lender_name || '',
      purpose: loan.purpose || '',
      principal_amount: loan.principal_amount || '',
      interest_rate: loan.interest_rate ?? '0',
      term_months: loan.term_months || '12',
      start_date: loan.start_date || '',
      due_date: loan.due_date || '',
      payment_frequency: loan.payment_frequency || 'monthly',
      paid_amount: loan.paid_amount || '0',
      status: loan.status || 'active',
      notes: loan.notes || '',
    })
    setShowModal(true)
  }

  const updateForm = (patch) => {
    setForm(prev => {
      const next = { ...prev, ...patch }
      if (patch.start_date !== undefined || patch.term_months !== undefined) {
        next.due_date = addMonths(next.start_date, next.term_months)
      }
      return next
    })
  }

  const saveLoan = async () => {
    const principal = numeric(form.principal_amount)
    const paid = numeric(form.paid_amount)
    if (!form.borrower_name.trim() || !form.purpose.trim() || principal <= 0 || !form.start_date) {
      toast.error('Please fill in borrower, purpose, principal, and start date')
      return
    }
    if (paid > principal + (principal * numeric(form.interest_rate) / 100)) {
      toast.error('Paid amount cannot exceed total payable')
      return
    }

    setSaving(true)
    try {
      const payload = {
        school_year_id: form.school_year_id || null,
        borrower_name: form.borrower_name.trim(),
        lender_name: form.lender_name.trim() || null,
        purpose: form.purpose.trim(),
        principal_amount: principal,
        interest_rate: numeric(form.interest_rate),
        term_months: parseInt(form.term_months, 10) || 1,
        start_date: form.start_date,
        due_date: form.due_date || null,
        payment_frequency: form.payment_frequency,
        paid_amount: paid,
        status: normalizeStatus({
          ...form,
          principal_amount: principal,
          interest_rate: numeric(form.interest_rate),
          paid_amount: paid,
        }),
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editingLoan) {
        const { error } = await supabase.from('loans').update(payload).eq('id', editingLoan.id)
        if (error) throw error
        toast.success('Loan updated')
      } else {
        const { error } = await supabase.from('loans').insert({ ...payload, recorded_by: user?.id || null })
        if (error) throw error
        toast.success('Loan added')
      }

      setShowModal(false)
      setEditingLoan(null)
      await fetchData()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save loan')
    } finally {
      setSaving(false)
    }
  }

  const openPaymentModal = (loan) => {
    setPaymentLoan(loan)
    setPaymentForm({ ...defaultPaymentForm, amount: String(outstandingBalance(loan).toFixed(2)) })
  }

  const recordPayment = async () => {
    if (!paymentLoan) return
    const amount = numeric(paymentForm.amount)
    const outstanding = outstandingBalance(paymentLoan)
    if (amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (amount > outstanding + 0.005) {
      toast.error(`Payment exceeds outstanding balance of ${formatCurrency(outstanding)}`)
      return
    }

    setSaving(true)
    try {
      const nextPaid = numeric(paymentLoan.paid_amount) + amount
      const nextLoan = { ...paymentLoan, paid_amount: nextPaid }
      const nextStatus = normalizeStatus(nextLoan)

      const { error: paymentError } = await supabase.from('loan_payments').insert({
        loan_id: paymentLoan.id,
        amount,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number.trim() || null,
        remarks: paymentForm.remarks.trim() || null,
        recorded_by: user?.id || null,
      })
      if (paymentError) throw paymentError

      const { error: loanError } = await supabase
        .from('loans')
        .update({ paid_amount: nextPaid, status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', paymentLoan.id)
      if (loanError) throw loanError

      toast.success('Loan payment recorded')
      setPaymentLoan(null)
      setExpandedLoanId(paymentLoan.id)
      await fetchData()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const deleteLoan = async (loan) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('loans').delete().eq('id', loan.id)
      if (error) throw error
      toast.success('Loan deleted')
      setDeleteConfirm(null)
      await fetchData()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to delete loan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Principal', value: formatCurrency(stats.totalPrincipal), sub: 'all loans', icon: Wallet, tone: 'text-blue-600' },
          { label: 'Collected', value: formatCurrency(stats.totalPaid), sub: 'repayments', icon: Banknote, tone: 'text-emerald-600' },
          { label: 'Outstanding', value: formatCurrency(stats.outstanding), sub: `${stats.activeCount} active loans`, icon: AlertCircle, tone: stats.outstanding > 0 ? 'text-amber-600' : 'text-emerald-600' },
          { label: 'Overdue', value: stats.overdue, sub: 'past due', icon: Calendar, tone: stats.overdue > 0 ? 'text-red-600' : 'text-gray-600' },
        ].map((item, i) => {
          const Icon = item.icon
          return (
            <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="p-4" hover={false}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className={`mt-1 text-xl font-bold ${item.tone} dark:text-white`}>{item.value}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{item.sub}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${item.tone}`} />
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>

      <GlassCard className="p-4" hover={false}>
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-500" /> Loans
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track school loans, repayment progress, and due dates.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search borrower, lender, purpose"
                className="w-full sm:w-72 pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="restructured">Restructured</option>
              <option value="written_off">Written Off</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Loan
            </button>
          </div>
        </div>
      </GlassCard>

      {filtered.length === 0 ? (
        <GlassCard className="p-6" hover={false}>
          <EmptyState title="No loans found" description="No loan records match the current filters." />
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden" hover={false} padding="">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                <tr>
                  {['Borrower', 'Purpose', 'Principal', 'Payable', 'Paid', 'Balance', 'Due', 'Status', 'History', 'Actions'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, 150).map((loan, i) => {
                  const status = displayStatus(loan)
                  const lastPayment = loan.loan_payments?.[0]
                  const paymentCount = loan.loan_payments?.length || 0
                  const isExpanded = expandedLoanId === loan.id
                  return (
                    <Fragment key={loan.id}>
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.015, 0.4) }}
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{loan.borrower_name}</p>
                          <p className="text-xs text-gray-400">{loan.lender_name || 'No lender'}{loan.school_years?.year_name ? ` · ${loan.school_years.year_name}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">{loan.purpose}</p>
                          {lastPayment && <p className="text-xs text-gray-400">Last payment {formatDate(lastPayment.payment_date)}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(loan.principal_amount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(totalPayable(loan))}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600 font-semibold">{formatCurrency(loan.paid_amount)}</td>
                        <td className="px-4 py-3 text-sm font-bold text-amber-600">{formatCurrency(outstandingBalance(loan))}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(loan.due_date)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[status] || statusStyles.active}`}>
                            {titleCase(status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                            title="Show payment history"
                          >
                            {paymentCount} payment{paymentCount === 1 ? '' : 's'}
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openPaymentModal(loan)} disabled={outstandingBalance(loan) <= 0.005}
                              className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed" title="Record payment">
                              <Banknote className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditModal(loan)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(loan)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                      {isExpanded && (
                        <tr key={`${loan.id}-payments`} className="bg-slate-50/80 dark:bg-gray-900/60">
                          <td colSpan={10} className="px-4 py-4">
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">Payment History</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{loan.borrower_name} · {loan.purpose}</p>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Paid {formatCurrency(loan.paid_amount)} of {formatCurrency(totalPayable(loan))}
                                </div>
                              </div>
                              {paymentCount === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-gray-400">
                                  No payments recorded for this borrower yet.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                      <tr>
                                        {['Date', 'Amount', 'Method', 'Reference', 'Remarks'].map(header => (
                                          <th key={header} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase text-gray-400">{header}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                      {loan.loan_payments.map(payment => (
                                        <tr key={payment.id}>
                                          <td className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300">{formatDate(payment.payment_date)}</td>
                                          <td className="px-4 py-2.5 text-sm font-semibold text-emerald-600">{formatCurrency(payment.amount)}</td>
                                          <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300">{titleCase(payment.payment_method)}</td>
                                          <td className="px-4 py-2.5 text-sm text-gray-500">{payment.reference_number || '-'}</td>
                                          <td className="px-4 py-2.5 text-sm text-gray-500">{payment.remarks || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingLoan ? 'Edit Loan' : 'Add Loan'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loan terms, dates, repayment status, and notes.</p>
                </div>
                <button disabled={saving} onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Borrower *" value={form.borrower_name} onChange={value => updateForm({ borrower_name: value })} placeholder="Borrower name" />
                  <Field label="Lender" value={form.lender_name} onChange={value => updateForm({ lender_name: value })} placeholder="Lender or institution" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Purpose *</label>
                  <textarea value={form.purpose} onChange={e => updateForm({ purpose: e.target.value })} rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="What is this loan for?" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Field label="Principal *" type="number" value={form.principal_amount} onChange={value => updateForm({ principal_amount: value })} placeholder="0.00" />
                  <Field label="Interest %" type="number" value={form.interest_rate} onChange={value => updateForm({ interest_rate: value })} placeholder="0" />
                  <Field label="Term Months" type="number" value={form.term_months} onChange={value => updateForm({ term_months: value })} placeholder="12" />
                  <Field label="Paid Amount" type="number" value={form.paid_amount} onChange={value => updateForm({ paid_amount: value })} placeholder="0.00" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Field label="Start Date *" type="date" value={form.start_date} onChange={value => updateForm({ start_date: value })} />
                  <Field label="Due Date" type="date" value={form.due_date} onChange={value => updateForm({ due_date: value })} />
                  <SelectField label="Frequency" value={form.payment_frequency} onChange={value => updateForm({ payment_frequency: value })} options={frequencies} />
                  <SelectField label="Status" value={form.status} onChange={value => updateForm({ status: value })} options={[
                    { value: 'active', label: 'Active' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'overdue', label: 'Overdue' },
                    { value: 'restructured', label: 'Restructured' },
                    { value: 'written_off', label: 'Written Off' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                    <textarea value={form.notes} onChange={e => updateForm({ notes: e.target.value })} rows={3}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Optional notes" />
                  </div>
                  <SelectField label="School Year" value={form.school_year_id} onChange={value => updateForm({ school_year_id: value })} options={[
                    { value: '', label: 'No school year' },
                    ...schoolYears.map(sy => ({ value: sy.id, label: sy.year_name })),
                  ]} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SummaryBox label="Total Payable" value={formatCurrency(totalPayable(form))} />
                  <SummaryBox label="Outstanding" value={formatCurrency(outstandingBalance(form))} />
                  <SummaryBox label="Projected Status" value={titleCase(normalizeStatus(form))} />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                <button onClick={() => setShowModal(false)} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={saveLoan} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editingLoan ? 'Update Loan' : 'Add Loan'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {paymentLoan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setPaymentLoan(null)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Record Loan Payment</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{paymentLoan.borrower_name} · {formatCurrency(outstandingBalance(paymentLoan))} outstanding</p>
                </div>
                <button disabled={saving} onClick={() => setPaymentLoan(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Amount" type="number" value={paymentForm.amount} onChange={value => setPaymentForm(prev => ({ ...prev, amount: value }))} placeholder="0.00" />
                  <Field label="Payment Date" type="date" value={paymentForm.payment_date} onChange={value => setPaymentForm(prev => ({ ...prev, payment_date: value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField label="Payment Method" value={paymentForm.payment_method} onChange={value => setPaymentForm(prev => ({ ...prev, payment_method: value }))} options={paymentMethods} />
                  <Field label="Reference #" value={paymentForm.reference_number} onChange={value => setPaymentForm(prev => ({ ...prev, reference_number: value }))} placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
                  <textarea value={paymentForm.remarks} onChange={e => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))} rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Optional remarks" />
                </div>
                <button onClick={recordPayment} disabled={saving}
                  className="w-full px-4 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Banknote className="w-4 h-4" />}
                  Save Payment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/25 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete loan?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This will delete the loan for <strong>{deleteConfirm.borrower_name}</strong> and its payment history.
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteConfirm(null)} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => deleteLoan(deleteConfirm)} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

function SummaryBox({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  )
}
