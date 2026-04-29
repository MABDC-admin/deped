import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  Banknote,
  Calendar,
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  defaultInvoiceDueDate,
  generateInvoiceNumber,
  getStudentFeeForInvoice,
  invoiceFieldsFromStudentFee,
  syncInvoiceFromStudentFee,
  updateStudentFeeFromInvoice,
} from '../../lib/invoiceSync';
import {
  activeDiscountTemplates,
  calculateDiscountAmount,
  discountAmountInputValue,
  findMatchingDiscountTemplate,
  formatDiscountTemplate,
} from '../../lib/discountTemplates';
import toast from 'react-hot-toast';
import GlassCard from '../../components/ui/GlassCard';
import { SkeletonTable, SkeletonDashboard } from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const formatCurrency = (amount) =>
  `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const formatDate = (value, options = {}) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: options.short ? 'short' : 'long',
    day: 'numeric',
  });
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const studentName = (student) =>
  [student?.last_name, student?.first_name].filter(Boolean).join(', ') || 'Unassigned student';

const ledgerInvoiceNumber = (studentFee) => `LEDGER-${String(studentFee?.id || '').slice(0, 8).toUpperCase()}`;

const reconcileInvoicesWithLedger = (invoiceRows, studentFeeRows) => {
  const invoiceByFee = new Map();
  const invoiceByStudentYear = new Map();
  const usedInvoiceIds = new Set();

  invoiceRows.forEach(invoice => {
    if (invoice.student_fee_id && !invoiceByFee.has(invoice.student_fee_id)) {
      invoiceByFee.set(invoice.student_fee_id, invoice);
    }
    const key = `${invoice.student_id || ''}:${invoice.school_year_id || ''}`;
    if (invoice.student_id && invoice.school_year_id && invoice.status !== 'void' && !invoiceByStudentYear.has(key)) {
      invoiceByStudentYear.set(key, invoice);
    }
  });

  const ledgerInvoices = studentFeeRows.map(studentFee => {
    const key = `${studentFee.student_id || ''}:${studentFee.school_year_id || ''}`;
    const matchedInvoice = invoiceByFee.get(studentFee.id) || invoiceByStudentYear.get(key) || null;
    if (matchedInvoice?.id) usedInvoiceIds.add(matchedInvoice.id);

    const ledgerFields = invoiceFieldsFromStudentFee(studentFee);
    return {
      ...matchedInvoice,
      ...ledgerFields,
      id: matchedInvoice?.id || `student-fee-${studentFee.id}`,
      is_virtual: !matchedInvoice,
      invoice_number: matchedInvoice?.invoice_number || ledgerInvoiceNumber(studentFee),
      student_id: studentFee.student_id,
      student_fee_id: studentFee.id,
      school_year_id: studentFee.school_year_id,
      due_date: matchedInvoice?.due_date || defaultInvoiceDueDate(studentFee.created_at),
      status: matchedInvoice?.status === 'void' ? 'void' : ledgerFields.status,
      notes: matchedInvoice?.notes || '',
      created_at: matchedInvoice?.created_at || studentFee.created_at,
      updated_at: matchedInvoice?.updated_at || studentFee.updated_at,
      students: studentFee.students,
      school_years: studentFee.school_years,
      ledgerSynced: true,
    };
  });

  const standaloneInvoices = invoiceRows
    .filter(invoice => !usedInvoiceIds.has(invoice.id))
    .map(invoice => ({ ...invoice, ledgerSynced: Boolean(invoice.student_fee_id) }));

  return [...ledgerInvoices, ...standaloneInvoices].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
};

const displayStatus = (invoice) => {
  if (!invoice) return 'unpaid';
  if (invoice.status === 'void' || invoice.status === 'paid') return invoice.status;
  const balance = parseFloat(invoice.balance || 0);
  if (balance <= 0.005 && parseFloat(invoice.net_amount || 0) > 0) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = invoice.due_date ? new Date(invoice.due_date) : null;
  if (due) due.setHours(0, 0, 0, 0);
  if (balance > 0 && due && due < today) return 'overdue';
  return invoice.status || 'unpaid';
};

const statusConfig = {
  unpaid: {
    label: 'Unpaid',
    icon: ClockIcon,
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-300 dark:ring-amber-800',
    accent: 'text-amber-600',
  },
  partial: {
    label: 'Partial',
    icon: Wallet,
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/25 dark:text-blue-300 dark:ring-blue-800',
    accent: 'text-blue-600',
  },
  paid: {
    label: 'Fully Paid',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:ring-emerald-800',
    accent: 'text-emerald-600',
  },
  overdue: {
    label: 'Overdue',
    icon: AlertTriangle,
    badge: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-800',
    accent: 'text-red-600',
  },
  void: {
    label: 'Void',
    icon: Ban,
    badge: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700',
    accent: 'text-gray-500',
  },
};

function ClockIcon(props) {
  return <Calendar {...props} />;
}

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.unpaid;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${config.badge}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function MetricCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <GlassCard className="p-4" hover={false}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
          <p className="mt-1 text-xs text-gray-400 truncate">{sub}</p>
        </div>
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tone}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </GlassCard>
  );
}

const InvoiceList = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [discountTemplates, setDiscountTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [voidConfirm, setVoidConfirm] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '',
    school_year_id: '',
    total_amount: '',
    discount_type_id: '',
    discount_amount: '0',
    due_date: '',
    notes: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, studentsRes, yearsRes, studentFeesRes, discountTemplatesRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, students(first_name, last_name, lrn), school_years(year_name)')
          .order('created_at', { ascending: false }),
        supabase.from('students').select('id, first_name, last_name, lrn').order('last_name'),
        supabase.from('school_years').select('id, year_name, status, is_current, start_date').order('start_date', { ascending: false }),
        supabase
          .from('student_fees')
          .select('id, student_id, school_year_id, total_fees, total_discount, total_paid, balance, status, created_at, updated_at, students(first_name, last_name, lrn), school_years(year_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('discount_types')
          .select('id, name, type, value, category, school_year_id, is_active')
          .order('name'),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (yearsRes.error) throw yearsRes.error;
      if (studentFeesRes.error) throw studentFeesRes.error;
      if (discountTemplatesRes.error) console.error(discountTemplatesRes.error);

      setInvoices(reconcileInvoicesWithLedger(invoicesRes.data || [], studentFeesRes.data || []));
      setStudents(studentsRes.data || []);
      setSchoolYears(yearsRes.data || []);
      setDiscountTemplates(discountTemplatesRes.error ? [] : discountTemplatesRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to load invoices');
      setInvoices([]);
      setStudents([]);
      setSchoolYears([]);
      setDiscountTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const yearScopedInvoices = useMemo(() => {
    if (yearFilter === 'all') return invoices;
    return invoices.filter(invoice => invoice.school_year_id === yearFilter);
  }, [invoices, yearFilter]);

  const stats = useMemo(() => {
    const activeInvoices = yearScopedInvoices.filter(invoice => displayStatus(invoice) !== 'void');
    const grossAmount = activeInvoices.reduce((sum, invoice) => sum + (parseFloat(invoice.net_amount) || 0), 0);
    const outstandingAmount = activeInvoices
      .filter(invoice => ['unpaid', 'partial', 'overdue'].includes(displayStatus(invoice)))
      .reduce((sum, invoice) => sum + (parseFloat(invoice.balance) || 0), 0);
    const paidAmount = activeInvoices.reduce((sum, invoice) => sum + (parseFloat(invoice.amount_paid) || 0), 0);
    const overdueCount = activeInvoices.filter(invoice => displayStatus(invoice) === 'overdue').length;
    return {
      totalInvoices: yearScopedInvoices.length,
      grossAmount,
      outstandingAmount,
      paidAmount,
      overdueCount,
    };
  }, [yearScopedInvoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return yearScopedInvoices.filter(invoice => {
      const name = `${invoice.students?.first_name || ''} ${invoice.students?.last_name || ''}`.toLowerCase();
      const reverse = `${invoice.students?.last_name || ''} ${invoice.students?.first_name || ''}`.toLowerCase();
      const lrn = (invoice.students?.lrn || '').toLowerCase();
      const invoiceNumber = (invoice.invoice_number || '').toLowerCase();
      const status = displayStatus(invoice);
      const matchSearch = !q || name.includes(q) || reverse.includes(q) || lrn.includes(q) || invoiceNumber.includes(q);
      const matchStatus = statusFilter === 'all' || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [yearScopedInvoices, search, statusFilter]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students.slice(0, 25);
    return students.filter(student => {
      const name = `${student.first_name || ''} ${student.last_name || ''}`.toLowerCase();
      const reverse = `${student.last_name || ''} ${student.first_name || ''}`.toLowerCase();
      return name.includes(q) || reverse.includes(q) || (student.lrn || '').toLowerCase().includes(q);
    }).slice(0, 25);
  }, [students, studentSearch]);

  const activeSchoolYear = useMemo(
    () => schoolYears.find(sy => sy.is_current || sy.status === 'active') || schoolYears[0],
    [schoolYears]
  );

  const selectedFormStudent = students.find(student => student.id === form.student_id);
  const selectedFormDiscountTemplates = useMemo(
    () => activeDiscountTemplates(discountTemplates, form.school_year_id),
    [discountTemplates, form.school_year_id]
  );
  const selectedYearLabel = yearFilter === 'all'
    ? 'All school years'
    : schoolYears.find(sy => sy.id === yearFilter)?.year_name || 'Selected school year';

  const resetForm = () => {
    setForm({
      student_id: '',
      school_year_id: activeSchoolYear?.id || '',
      total_amount: '',
      discount_type_id: '',
      discount_amount: '0',
      due_date: defaultInvoiceDueDate(),
      notes: '',
    });
  };

  const handleFormSchoolYearChange = (schoolYearId) => {
    setForm(prev => {
      const selectedTemplate = discountTemplates.find(template => template.id === prev.discount_type_id);
      const templateStillValid = selectedTemplate && activeDiscountTemplates([selectedTemplate], schoolYearId).length > 0;

      return {
        ...prev,
        school_year_id: schoolYearId,
        discount_type_id: templateStillValid ? prev.discount_type_id : '',
        discount_amount: templateStillValid
          ? discountAmountInputValue(calculateDiscountAmount(selectedTemplate, prev.total_amount))
          : prev.discount_amount,
      };
    });
  };

  const handleTotalAmountChange = (value) => {
    setForm(prev => {
      const selectedTemplate = discountTemplates.find(template => template.id === prev.discount_type_id);
      return {
        ...prev,
        total_amount: value,
        discount_amount: selectedTemplate
          ? discountAmountInputValue(calculateDiscountAmount(selectedTemplate, value))
          : prev.discount_amount,
      };
    });
  };

  const handleDiscountTemplateChange = (templateId) => {
    setForm(prev => {
      const selectedTemplate = discountTemplates.find(template => template.id === templateId);
      return {
        ...prev,
        discount_type_id: templateId,
        discount_amount: selectedTemplate
          ? discountAmountInputValue(calculateDiscountAmount(selectedTemplate, prev.total_amount))
          : prev.discount_amount,
      };
    });
  };

  const openAddModal = () => {
    setEditingInvoice(null);
    resetForm();
    setStudentSearch('');
    setShowModal(true);
  };

  const openEditModal = (invoice) => {
    const discountTypeId = findMatchingDiscountTemplate(
      discountTemplates,
      invoice.discount_amount,
      invoice.total_amount,
      invoice.school_year_id
    );
    setEditingInvoice(invoice);
    setForm({
      student_id: invoice.student_id || '',
      school_year_id: invoice.school_year_id || '',
      total_amount: invoice.total_amount || '',
      discount_type_id: discountTypeId,
      discount_amount: invoice.discount_amount || '0',
      due_date: invoice.due_date || defaultInvoiceDueDate(),
      notes: invoice.notes || '',
    });
    setStudentSearch('');
    setViewInvoice(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.student_id || !form.due_date) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const linkedStudentFee = await getStudentFeeForInvoice(supabase, form.student_id, form.school_year_id);

      if (linkedStudentFee) {
        const totalAmount = parseFloat(form.total_amount) || 0;
        const discountAmount = parseFloat(form.discount_amount) || 0;
        if (totalAmount <= 0) {
          toast.error('Total amount must be greater than zero');
          return;
        }
        if (discountAmount < 0 || discountAmount > totalAmount) {
          toast.error('Discount must be between zero and the total amount');
          return;
        }

        const { data: updatedStudentFee, error: studentFeeError } = await updateStudentFeeFromInvoice(supabase, linkedStudentFee, {
          totalAmount,
          discountAmount,
        });
        if (studentFeeError) throw studentFeeError;

        const { error } = await syncInvoiceFromStudentFee(supabase, {
          studentFee: updatedStudentFee || linkedStudentFee,
          studentId: form.student_id,
          schoolYearId: form.school_year_id,
          generatedBy: user?.id || null,
          dueDate: form.due_date,
          notes: form.notes,
          invoiceId: editingInvoice?.is_virtual ? null : editingInvoice?.id,
        });
        if (error) throw error;
        toast.success(editingInvoice ? 'Invoice synced with ledger' : 'Invoice created from ledger');
        setShowModal(false);
        setEditingInvoice(null);
        fetchData();
        return;
      }

      if (!form.total_amount) {
        toast.error('Please enter an amount or select a student with ledger fees');
        return;
      }

      const totalAmount = parseFloat(form.total_amount) || 0;
      const discountAmount = parseFloat(form.discount_amount) || 0;
      if (totalAmount <= 0) {
        toast.error('Total amount must be greater than zero');
        return;
      }
      if (discountAmount < 0 || discountAmount > totalAmount) {
        toast.error('Discount must be between zero and the total amount');
        return;
      }

      const netAmount = totalAmount - discountAmount;

      if (editingInvoice && !editingInvoice.is_virtual) {
        const amountPaid = parseFloat(editingInvoice.amount_paid) || 0;
        const balance = Math.max(netAmount - amountPaid, 0);
        const { error } = await supabase.from('invoices').update({
          student_id: form.student_id,
          school_year_id: form.school_year_id || null,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          net_amount: netAmount,
          balance,
          due_date: form.due_date,
          notes: form.notes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', editingInvoice.id);
        if (error) throw error;
        toast.success('Invoice updated');
      } else {
        const { error } = await supabase.from('invoices').insert({
          invoice_number: generateInvoiceNumber(),
          student_id: form.student_id,
          school_year_id: form.school_year_id || null,
          total_amount: totalAmount,
          discount_amount: discountAmount,
          net_amount: netAmount,
          amount_paid: 0,
          balance: netAmount,
          due_date: form.due_date,
          status: 'unpaid',
          notes: form.notes || null,
          generated_by: user?.id || null,
        });
        if (error) throw error;
        toast.success('Invoice created');
      }

      setShowModal(false);
      setEditingInvoice(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (String(id).startsWith('student-fee-')) {
      toast.error('Ledger-generated invoices cannot be deleted here');
      return;
    }
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      toast.success('Invoice deleted');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to delete invoice');
    }
  };

  const handleVoid = async (invoice) => {
    if (invoice.is_virtual) {
      toast.error('Create the invoice first before voiding it');
      return;
    }
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding');
      return;
    }
    try {
      const { error } = await supabase.from('invoices').update({
        status: 'void',
        notes: `${invoice.notes ? `${invoice.notes} | ` : ''}VOID: ${voidReason}`,
        updated_at: new Date().toISOString(),
      }).eq('id', invoice.id);
      if (error) throw error;
      toast.success('Invoice voided');
      setVoidConfirm(null);
      setVoidReason('');
      setViewInvoice(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to void invoice');
    }
  };

  const handlePrint = (invoice) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to print the invoice.');
      return;
    }

    const status = displayStatus(invoice);
    const statusLabel = statusConfig[status]?.label || status;
    const student = `${invoice.students?.first_name || ''} ${invoice.students?.last_name || ''}`.trim() || 'Unassigned student';
    const printedAt = new Date().toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
          <style>
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.45;
              background: #fff;
            }
            .sheet { max-width: 190mm; margin: 0 auto; }
            .header {
              display: grid;
              grid-template-columns: 1fr auto;
              gap: 24px;
              align-items: start;
              padding-bottom: 18px;
              border-bottom: 2px solid #111827;
            }
            .brand { color: #4b5563; font-size: 12px; margin-bottom: 6px; }
            .title { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: 0; }
            .number { margin-top: 6px; font-family: "Courier New", monospace; color: #374151; }
            .status {
              display: inline-block;
              padding: 6px 10px;
              border: 1px solid #111827;
              border-radius: 8px;
              font-weight: 800;
              text-transform: uppercase;
              text-align: center;
            }
            .meta { margin-top: 10px; text-align: right; color: #4b5563; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
            .panel { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; min-height: 118px; }
            .panel-title {
              margin: 0 0 10px;
              font-size: 11px;
              font-weight: 800;
              color: #4b5563;
              text-transform: uppercase;
              letter-spacing: .06em;
            }
            .name { font-size: 16px; font-weight: 800; margin-bottom: 6px; }
            .line { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
            .label { color: #6b7280; }
            .value { font-weight: 700; text-align: right; }
            .table-wrap { margin-top: 18px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th {
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              color: #374151;
              font-size: 10px;
              text-align: left;
              padding: 8px;
              text-transform: uppercase;
              letter-spacing: .05em;
            }
            td { border: 1px solid #d1d5db; padding: 9px 8px; vertical-align: top; }
            .amount { text-align: right; white-space: nowrap; }
            .summary { width: 52%; margin-left: auto; margin-top: 16px; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
            .summary-row { display: flex; justify-content: space-between; gap: 18px; padding: 9px 12px; border-bottom: 1px solid #e5e7eb; }
            .summary-row:last-child { border-bottom: 0; }
            .summary-row.total { background: #111827; color: #fff; font-size: 15px; font-weight: 800; }
            .notes { margin-top: 18px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; min-height: 58px; }
            .footer {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin-top: 44px;
              break-inside: avoid;
            }
            .signature { border-top: 1px solid #111827; padding-top: 7px; text-align: center; color: #374151; }
            .fine { margin-top: 16px; color: #6b7280; font-size: 10px; text-align: center; }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <section class="header">
              <div>
                <div class="brand">DepEd School Management System</div>
                <h1 class="title">Invoice</h1>
                <div class="number">${escapeHtml(invoice.invoice_number || '-')}</div>
              </div>
              <div>
                <div class="status">${escapeHtml(statusLabel)}</div>
                <div class="meta">Printed ${escapeHtml(printedAt)}</div>
              </div>
            </section>

            <section class="grid">
              <div class="panel">
                <h2 class="panel-title">Bill To</h2>
                <div class="name">${escapeHtml(student)}</div>
                <div class="line"><span class="label">LRN</span><span class="value">${escapeHtml(invoice.students?.lrn || '-')}</span></div>
                <div class="line"><span class="label">School Year</span><span class="value">${escapeHtml(invoice.school_years?.year_name || '-')}</span></div>
              </div>
              <div class="panel">
                <h2 class="panel-title">Invoice Details</h2>
                <div class="line"><span class="label">Issue Date</span><span class="value">${escapeHtml(formatDate(invoice.created_at, { short: true }))}</span></div>
                <div class="line"><span class="label">Due Date</span><span class="value">${escapeHtml(formatDate(invoice.due_date, { short: true }))}</span></div>
                <div class="line"><span class="label">Status</span><span class="value">${escapeHtml(statusLabel)}</span></div>
              </div>
            </section>

            <section class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="width: 22%;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      School fees and charges
                      ${invoice.notes ? `<div style="margin-top:4px;color:#6b7280;">${escapeHtml(invoice.notes)}</div>` : ''}
                    </td>
                    <td class="amount">${escapeHtml(formatCurrency(invoice.total_amount))}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section class="summary">
              <div class="summary-row"><span>Total Amount</span><strong>${escapeHtml(formatCurrency(invoice.total_amount))}</strong></div>
              <div class="summary-row"><span>Discount</span><strong>${escapeHtml(formatCurrency(invoice.discount_amount))}</strong></div>
              <div class="summary-row"><span>Net Amount</span><strong>${escapeHtml(formatCurrency(invoice.net_amount))}</strong></div>
              <div class="summary-row"><span>Amount Paid</span><strong>${escapeHtml(formatCurrency(invoice.amount_paid))}</strong></div>
              <div class="summary-row total"><span>Balance Due</span><span>${escapeHtml(formatCurrency(invoice.balance))}</span></div>
            </section>

            <section class="notes">
              <h2 class="panel-title">Notes</h2>
              ${escapeHtml(invoice.notes || 'Please settle this invoice on or before the due date.')}
            </section>

            <section class="footer">
              <div class="signature">Prepared by</div>
              <div class="signature">Received by</div>
            </section>
            <div class="fine">This invoice was generated by the DepEd School Management System.</div>
          </main>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (loading) return <div className="space-y-6"><SkeletonDashboard /><SkeletonTable /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-500" /> Invoices
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedYearLabel} billing, balances, and printable invoice records
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-60">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 text-sm font-medium text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All school years</option>
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.year_name}{sy.is_current || sy.status === 'active' ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Invoices" value={stats.totalInvoices} sub="records in view" icon={Receipt} tone="bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-300" />
        <MetricCard label="Billed" value={formatCurrency(stats.grossAmount)} sub="net invoice amount" icon={FileText} tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-300" />
        <MetricCard label="Collected" value={formatCurrency(stats.paidAmount)} sub="payments applied" icon={Banknote} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-300" />
        <MetricCard label="Outstanding" value={formatCurrency(stats.outstandingAmount)} sub={`${stats.overdueCount} overdue`} icon={AlertTriangle} tone="bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-300" />
      </div>

      <GlassCard className="p-4" hover={false}>
        <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search student, LRN, or invoice number"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['all', 'All'],
              ['unpaid', 'Unpaid'],
              ['partial', 'Partial'],
              ['paid', 'Fully Paid'],
              ['overdue', 'Overdue'],
              ['void', 'Void'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {filtered.length === 0 ? (
        <GlassCard className="p-6" hover={false}>
          <EmptyState icon={FileText} title="No invoices found" description="No invoice records match the selected filters." action={openAddModal} actionLabel="Create Invoice" />
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden" hover={false} padding="">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Invoice Register</h2>
              <p className="text-xs text-gray-400 mt-0.5">{filtered.length} matching records</p>
            </div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{selectedYearLabel}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                <tr>
                  {['Invoice', 'Student', 'School Year', 'Amount', 'Paid', 'Balance', 'Due', 'Status', 'Actions'].map(header => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.slice(0, 150).map((invoice, index) => {
                  const status = displayStatus(invoice);
                  return (
                    <motion.tr
                      key={invoice.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(index * 0.015, 0.35) }}
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button onClick={() => setViewInvoice(invoice)} className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-700">
                          {invoice.invoice_number}
                        </button>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {invoice.ledgerSynced ? 'Ledger synced' : `Issued ${formatDate(invoice.created_at, { short: true })}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{studentName(invoice.students)}</p>
                        <p className="text-xs text-gray-400 font-mono">LRN {invoice.students?.lrn || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{invoice.school_years?.year_name || '-'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(invoice.net_amount)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600 whitespace-nowrap">{formatCurrency(invoice.amount_paid)}</td>
                      <td className={`px-4 py-3 text-sm font-bold whitespace-nowrap ${parseFloat(invoice.balance || 0) > 0 ? statusConfig[status]?.accent || 'text-gray-900' : 'text-emerald-600'}`}>
                        {formatCurrency(invoice.balance)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(invoice.due_date, { short: true })}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewInvoice(invoice)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(invoice)} className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePrint(invoice)} className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 transition-colors" title="Print">
                            <Printer className="w-4 h-4" />
                          </button>
                          {!invoice.is_virtual && invoice.status !== 'void' && (
                            <button onClick={() => { setVoidConfirm(invoice); setVoidReason(''); }} className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 transition-colors" title="Void">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {!invoice.is_virtual && (
                            <button onClick={() => setDeleteConfirm(invoice)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <AnimatePresence>
        {viewInvoice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewInvoice(null)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{viewInvoice.invoice_number}</h3>
                    <StatusBadge status={displayStatus(viewInvoice)} />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Invoice preview and account balance</p>
                </div>
                <button onClick={() => setViewInvoice(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Bill To</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/25 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{studentName(viewInvoice.students)}</p>
                          <p className="text-xs text-gray-400 font-mono">LRN {viewInvoice.students?.lrn || '-'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Timeline</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Issued</span><strong className="text-gray-900 dark:text-white">{formatDate(viewInvoice.created_at, { short: true })}</strong></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">Due</span><strong className="text-gray-900 dark:text-white">{formatDate(viewInvoice.due_date, { short: true })}</strong></div>
                        <div className="flex justify-between gap-3"><span className="text-gray-500">School Year</span><strong className="text-gray-900 dark:text-white">{viewInvoice.school_years?.year_name || '-'}</strong></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <div className="grid grid-cols-[1fr_140px] bg-gray-50 dark:bg-gray-800/80 text-xs font-bold uppercase tracking-wide text-gray-500">
                      <div className="p-3">Description</div>
                      <div className="p-3 text-right">Amount</div>
                    </div>
                    <div className="grid grid-cols-[1fr_140px] border-t border-gray-200 dark:border-gray-800">
                      <div className="p-4">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">School fees and charges</p>
                        <p className="text-xs text-gray-400 mt-1">{viewInvoice.notes || 'Standard billing assessment'}</p>
                      </div>
                      <div className="p-4 text-right text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(viewInvoice.total_amount)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden self-start">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/80">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Balance Due</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(viewInvoice.balance)}</p>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {[
                      ['Total Amount', formatCurrency(viewInvoice.total_amount)],
                      ['Discount', formatCurrency(viewInvoice.discount_amount)],
                      ['Net Amount', formatCurrency(viewInvoice.net_amount)],
                      ['Amount Paid', formatCurrency(viewInvoice.amount_paid)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                        <span className="text-gray-500">{label}</span>
                        <strong className="text-gray-900 dark:text-white">{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-2">
                    <button onClick={() => handlePrint(viewInvoice)} className="py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2">
                      <Printer className="w-4 h-4" /> Print
                    </button>
                    <button onClick={() => openEditModal(viewInvoice)} className="py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 flex items-center justify-center gap-2">
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingInvoice ? 'Edit Invoice' : 'Create Invoice'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Student billing details and due date</p>
                </div>
                <button disabled={saving} onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Student</label>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by name or LRN"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select student</option>
                      {filteredStudents.map(student => (
                        <option key={student.id} value={student.id}>{student.last_name}, {student.first_name} ({student.lrn || 'No LRN'})</option>
                      ))}
                    </select>
                  </div>
                  {selectedFormStudent && (
                    <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 flex items-center gap-3">
                      <User className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{studentName(selectedFormStudent)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">LRN {selectedFormStudent.lrn || '-'}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">School Year</label>
                    <select value={form.school_year_id} onChange={e => handleFormSchoolYearChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select school year</option>
                      {schoolYears.map(sy => (
                        <option key={sy.id} value={sy.id}>{sy.year_name}{sy.is_current || sy.status === 'active' ? ' (Active)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Due Date</label>
                    <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Total Amount</label>
                    <input type="number" step="0.01" min="0" value={form.total_amount} onChange={e => handleTotalAmountChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Discount Template</label>
                    <select value={form.discount_type_id} onChange={e => handleDiscountTemplateChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Custom discount</option>
                      {selectedFormDiscountTemplates.map(template => (
                        <option key={template.id} value={template.id}>{formatDiscountTemplate(template, form.total_amount)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Discount</label>
                    <input type="number" step="0.01" min="0" value={form.discount_amount} onChange={e => setForm({ ...form, discount_type_id: '', discount_amount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Net Amount</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                      {formatCurrency(Math.max((parseFloat(form.total_amount) || 0) - (parseFloat(form.discount_amount) || 0), 0))}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Optional notes for this invoice" />
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                <button onClick={() => setShowModal(false)} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/25 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete invoice?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This will permanently delete <strong>{deleteConfirm.invoice_number}</strong>.
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirm.id)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {voidConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setVoidConfirm(null)}>
            <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-12 rounded-lg bg-amber-50 dark:bg-amber-900/25 flex items-center justify-center mb-4">
                <Ban className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Void invoice</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Add a reason for voiding <strong>{voidConfirm.invoice_number}</strong>.
              </p>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
                className="w-full mt-4 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-amber-500 resize-none" placeholder="Reason for voiding" />
              <div className="flex gap-3 mt-5">
                <button onClick={() => setVoidConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleVoid(voidConfirm)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors">
                  Void Invoice
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceList;
