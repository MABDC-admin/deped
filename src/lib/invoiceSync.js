const numeric = (value) => parseFloat(value || 0) || 0

export const defaultInvoiceDueDate = (baseDate = new Date()) => {
  const date = new Date(baseDate || new Date())
  date.setDate(date.getDate() + 30)
  return date.toISOString().split('T')[0]
}

export const generateInvoiceNumber = () => {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `INV-${date}-${rand}`
}

export const invoiceStatusFromStudentFee = (studentFee) => {
  const netAmount = Math.max(numeric(studentFee?.total_fees) - numeric(studentFee?.total_discount), 0)
  const amountPaid = numeric(studentFee?.total_paid)
  const balance = Math.max(
    studentFee?.balance === null || studentFee?.balance === undefined
      ? netAmount - amountPaid
      : numeric(studentFee.balance),
    0
  )

  if (netAmount > 0 && balance <= 0) return 'paid'
  if (amountPaid > 0) return 'partial'
  return studentFee?.status && studentFee.status !== 'paid' ? studentFee.status : 'unpaid'
}

export const invoiceFieldsFromStudentFee = (studentFee) => {
  const totalAmount = numeric(studentFee?.total_fees)
  const discountAmount = numeric(studentFee?.total_discount)
  const netAmount = Math.max(totalAmount - discountAmount, 0)
  const amountPaid = numeric(studentFee?.total_paid)
  const balance = Math.max(
    studentFee?.balance === null || studentFee?.balance === undefined
      ? netAmount - amountPaid
      : numeric(studentFee.balance),
    0
  )

  return {
    total_amount: totalAmount,
    discount_amount: discountAmount,
    net_amount: netAmount,
    amount_paid: amountPaid,
    balance,
    status: invoiceStatusFromStudentFee({ ...studentFee, balance, total_paid: amountPaid }),
  }
}

export async function getStudentFeeForInvoice(supabase, studentId, schoolYearId) {
  if (!studentId || !schoolYearId) return null

  const { data, error } = await supabase
    .from('student_fees')
    .select('id, student_id, school_year_id, total_fees, total_discount, total_paid, balance, status, created_at, updated_at')
    .eq('student_id', studentId)
    .eq('school_year_id', schoolYearId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function updateStudentFeeFromInvoice(supabase, studentFee, { totalAmount, discountAmount }) {
  if (!studentFee?.id) return { data: null, error: null }

  const totalFees = numeric(totalAmount)
  const totalDiscount = numeric(discountAmount)
  const totalPaid = numeric(studentFee.total_paid)
  const projectedBalance = Math.max(totalFees - totalDiscount - totalPaid, 0)
  const status = projectedBalance <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

  const { data, error } = await supabase
    .from('student_fees')
    .update({
      total_fees: totalFees,
      total_discount: totalDiscount,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', studentFee.id)
    .select('id, student_id, school_year_id, total_fees, total_discount, total_paid, balance, status, created_at, updated_at')
    .single()

  return { data, error }
}

export async function syncInvoiceFromStudentFee(
  supabase,
  { studentFee, studentId, schoolYearId, generatedBy = null, dueDate = null, notes = undefined, invoiceId = null } = {}
) {
  if (!studentFee?.id || !studentId || !schoolYearId) return { data: null, error: null }

  const ledgerFields = invoiceFieldsFromStudentFee(studentFee)
  const basePayload = {
    student_id: studentId,
    student_fee_id: studentFee.id,
    school_year_id: schoolYearId,
    ...ledgerFields,
    updated_at: new Date().toISOString(),
  }
  if (dueDate) basePayload.due_date = dueDate
  if (notes !== undefined) basePayload.notes = notes || null

  let existing = null

  if (invoiceId) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, notes')
      .eq('id', invoiceId)
      .maybeSingle()
    if (error) return { data: null, error }
    existing = data || null
  }

  if (!existing) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, notes')
      .eq('student_fee_id', studentFee.id)
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { data: null, error }
    existing = data || null
  }

  if (!existing) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, due_date, notes')
      .eq('student_id', studentId)
      .eq('school_year_id', schoolYearId)
      .neq('status', 'void')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { data: null, error }
    existing = data || null
  }

  if (existing) {
    const { data, error } = await supabase
      .from('invoices')
      .update(basePayload)
      .eq('id', existing.id)
      .select()
      .single()
    return { data, error }
  }

  const insertPayload = {
    ...basePayload,
    invoice_number: generateInvoiceNumber(),
    due_date: dueDate || defaultInvoiceDueDate(studentFee.created_at),
    notes: notes !== undefined ? notes || null : 'Generated from student ledger',
    generated_by: generatedBy,
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert(insertPayload)
    .select()
    .single()

  return { data, error }
}
