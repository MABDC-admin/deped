import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'
import Layout from './components/Layout'

const lazyPage = (importer) => lazy(async () => {
  try {
    const module = await importer()
    if (typeof window !== 'undefined') sessionStorage.removeItem('sms:chunk-reload')
    return module
  } catch (error) {
    const message = String(error?.message || error || '')
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message)

    if (isChunkError && typeof window !== 'undefined' && !sessionStorage.getItem('sms:chunk-reload')) {
      sessionStorage.setItem('sms:chunk-reload', '1')
      window.location.reload()
      return new Promise(() => {})
    }

    throw error
  }
})

const Login = lazyPage(() => import('./pages/Login'))
const DashboardRouter = lazyPage(() => import('./components/DashboardRouter'))
const StudentList = lazyPage(() => import('./pages/students/StudentList'))
const StudentDetail = lazyPage(() => import('./pages/students/StudentDetail'))
const EnrollmentList = lazyPage(() => import('./pages/enrollment/EnrollmentList'))
const EnrollmentForm = lazyPage(() => import('./pages/enrollment/EnrollmentForm'))
const EnrollmentDetail = lazyPage(() => import('./pages/enrollment/EnrollmentDetail'))
const TeacherList = lazyPage(() => import('./pages/Teachers/TeacherList'))
const SectionList = lazyPage(() => import('./pages/sections/SectionList'))
const SubjectList = lazyPage(() => import('./pages/subjects/SubjectList'))
const GradeLevelList = lazyPage(() => import('./pages/grade-levels/GradeLevelList'))
const SchoolYearList = lazyPage(() => import('./pages/school-years/SchoolYearList'))
const PromotionHistory = lazyPage(() => import('./pages/school-years/PromotionHistory'))
const UserList = lazyPage(() => import('./pages/users/UserList'))
const GradeEntry = lazyPage(() => import('./pages/Grades/GradeEntry'))
const GradeReport = lazyPage(() => import('./pages/Grades/GradeReport'))
const AttendanceList = lazyPage(() => import('./pages/Attendance/AttendanceList'))
const FeeList = lazyPage(() => import('./pages/Fees/FeeList'))
const PaymentList = lazyPage(() => import('./pages/Fees/PaymentList'))
const InvoiceList = lazyPage(() => import('./pages/finance/InvoiceList'))
const ReceiptList = lazyPage(() => import('./pages/finance/ReceiptList'))
const ExpenseList = lazyPage(() => import('./pages/finance/ExpenseList'))
const LoanList = lazyPage(() => import('./pages/finance/LoanList'))
const FinanceReports = lazyPage(() => import('./pages/finance/FinanceReports'))
const AnnouncementList = lazyPage(() => import('./pages/Announcements/AnnouncementList'))
const ClassSchedule = lazyPage(() => import('./pages/schedule/ClassSchedule'))
const SchoolInfo = lazyPage(() => import('./pages/Settings/SchoolInfo'))
const SystemSettings = lazyPage(() => import('./pages/Settings/SystemSettings'))
const AuditLog = lazyPage(() => import('./pages/audit/AuditLog'))
const BehavioralList = lazyPage(() => import('./pages/behavioral/BehavioralList'))
const CounselingList = lazyPage(() => import('./pages/counseling/CounselingList'))
const NotificationList = lazyPage(() => import('./pages/notifications/NotificationList'))
const TeacherClasses = lazyPage(() => import('./pages/portal/TeacherClasses'))
const PrincipalOverview = lazyPage(() => import('./pages/portal/PrincipalOverview'))
const GuidanceWellness = lazyPage(() => import('./pages/portal/GuidanceWellness'))
const CashierProcess = lazyPage(() => import('./pages/portal/CashierProcess'))
const CashierLedger = lazyPage(() => import('./pages/portal/CashierLedger'))
const ParentChildren = lazyPage(() => import('./pages/portal/ParentChildren'))
const StudentGrades = lazyPage(() => import('./pages/portal/StudentGrades'))
const RegistrarRecords = lazyPage(() => import('./pages/portal/RegistrarRecords'))

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-primary-100 border-t-primary-600 animate-spin" />
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '16px',
                background: 'var(--toast-bg, #fff)',
                color: 'var(--toast-color, #1f2937)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.05)',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<DashboardRouter />} />
                <Route path="students" element={<RoleGuard allowed={["registrar","teacher","principal","guidance","cashier"]}><StudentList /></RoleGuard>} />
                <Route path="students/:id" element={<RoleGuard allowed={["registrar","teacher","principal","guidance","cashier"]}><StudentDetail /></RoleGuard>} />
                <Route path="enrollment" element={<RoleGuard allowed={["registrar"]}><EnrollmentList /></RoleGuard>} />
                <Route path="enrollment/new" element={<RoleGuard allowed={["registrar"]}><EnrollmentForm /></RoleGuard>} />
                <Route path="enrollment/:id" element={<RoleGuard allowed={["registrar"]}><EnrollmentDetail /></RoleGuard>} />
                <Route path="enrollment/:id/edit" element={<RoleGuard allowed={["registrar"]}><EnrollmentForm /></RoleGuard>} />
                <Route path="teachers" element={<RoleGuard allowed={["registrar","principal"]}><TeacherList /></RoleGuard>} />
                <Route path="sections" element={<RoleGuard allowed={["registrar"]}><SectionList /></RoleGuard>} />
                <Route path="subjects" element={<RoleGuard allowed={["registrar"]}><SubjectList /></RoleGuard>} />
                <Route path="grade-levels" element={<RoleGuard allowed={["registrar"]}><GradeLevelList /></RoleGuard>} />
                <Route path="school-years" element={<RoleGuard allowed={["registrar"]}><SchoolYearList /></RoleGuard>} />
                <Route path="school-years/promotions" element={<RoleGuard allowed={["registrar"]}><PromotionHistory /></RoleGuard>} />
                <Route path="users" element={<RoleGuard allowed={["super_admin"]}><UserList /></RoleGuard>} />
                <Route path="grades/entry" element={<RoleGuard allowed={["super_admin","teacher","registrar"]}><GradeEntry /></RoleGuard>} />
                <Route path="grades/reports" element={<RoleGuard allowed={["teacher","registrar","principal"]}><GradeReport /></RoleGuard>} />
                <Route path="attendance" element={<RoleGuard allowed={["teacher","registrar","principal","guidance"]}><AttendanceList /></RoleGuard>} />
                <Route path="fees" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><FeeList /></RoleGuard>} />
                <Route path="payments" element={<RoleGuard allowed={["super_admin","cashier","registrar","principal"]}><PaymentList /></RoleGuard>} />
                <Route path="invoices" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><InvoiceList /></RoleGuard>} />
                <Route path="receipts" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><ReceiptList /></RoleGuard>} />
                <Route path="expenses" element={<RoleGuard allowed={["super_admin","cashier"]}><ExpenseList /></RoleGuard>} />
                <Route path="loans" element={<RoleGuard allowed={["super_admin","cashier"]}><LoanList /></RoleGuard>} />
                <Route path="finance/reports" element={<RoleGuard allowed={["super_admin","cashier","principal"]}><FinanceReports /></RoleGuard>} />
                <Route path="announcements" element={<RoleGuard allowed={["registrar","teacher","principal","guidance","cashier","parent","student"]}><AnnouncementList /></RoleGuard>} />
                <Route path="schedule" element={<RoleGuard allowed={["registrar","teacher","principal","guidance"]}><ClassSchedule /></RoleGuard>} />
                <Route path="settings/school-info" element={<RoleGuard allowed={["super_admin"]}><SchoolInfo /></RoleGuard>} />
                <Route path="settings/system" element={<RoleGuard allowed={["super_admin"]}><SystemSettings /></RoleGuard>} />
                <Route path="audit-logs" element={<RoleGuard allowed={["super_admin"]}><AuditLog /></RoleGuard>} />
                <Route path="behavioral" element={<RoleGuard allowed={["super_admin","teacher","guidance","principal","registrar"]}><BehavioralList /></RoleGuard>} />
                <Route path="counseling" element={<RoleGuard allowed={["super_admin","guidance","principal","registrar","teacher"]}><CounselingList /></RoleGuard>} />
                <Route path="notifications" element={<RoleGuard allowed={["registrar","teacher","principal","guidance","cashier","parent","student"]}><NotificationList /></RoleGuard>} />
                <Route path="portal/teacher/classes" element={<RoleGuard allowed={["teacher"]}><TeacherClasses /></RoleGuard>} />
                <Route path="portal/principal/overview" element={<RoleGuard allowed={["principal"]}><PrincipalOverview /></RoleGuard>} />
                <Route path="portal/guidance/wellness" element={<RoleGuard allowed={["guidance"]}><GuidanceWellness /></RoleGuard>} />
                <Route path="portal/cashier/process" element={<RoleGuard allowed={["cashier"]}><CashierProcess /></RoleGuard>} />
                <Route path="portal/cashier/ledger" element={<RoleGuard allowed={["cashier"]}><CashierLedger /></RoleGuard>} />
                <Route path="portal/parent/children" element={<RoleGuard allowed={["parent"]}><ParentChildren /></RoleGuard>} />
                <Route path="portal/student/grades" element={<RoleGuard allowed={["student"]}><StudentGrades /></RoleGuard>} />
                <Route path="portal/registrar/records" element={<RoleGuard allowed={["registrar"]}><RegistrarRecords /></RoleGuard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
