import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'
import Layout from './components/Layout'
import Login from './pages/Login'
import DashboardRouter from './components/DashboardRouter'
import StudentList from './pages/students/StudentList'
import StudentDetail from './pages/students/StudentDetail'
import EnrollmentList from './pages/enrollment/EnrollmentList'
import EnrollmentForm from './pages/enrollment/EnrollmentForm'
import EnrollmentDetail from './pages/enrollment/EnrollmentDetail'
import TeacherList from './pages/teachers/TeacherList'
import SectionList from './pages/sections/SectionList'
import SubjectList from './pages/subjects/SubjectList'
import GradeLevelList from './pages/grade-levels/GradeLevelList'
import SchoolYearList from './pages/school-years/SchoolYearList'
import PromotionHistory from './pages/school-years/PromotionHistory'
import UserList from './pages/users/UserList'
import GradeEntry from './pages/grades/GradeEntry'
import GradeReport from './pages/grades/GradeReport'
import AttendanceList from './pages/attendance/AttendanceList'
import FeeList from './pages/fees/FeeList'
import PaymentList from './pages/fees/PaymentList'
import InvoiceList from './pages/finance/InvoiceList'
import ReceiptList from './pages/finance/ReceiptList'
import ExpenseList from './pages/finance/ExpenseList'
import FinanceReports from './pages/finance/FinanceReports'
import AnnouncementList from './pages/announcements/AnnouncementList'
import ClassSchedule from './pages/schedule/ClassSchedule'
import SchoolInfo from './pages/settings/SchoolInfo'
import SystemSettings from './pages/settings/SystemSettings'
import AuditLog from './pages/audit/AuditLog'
import BehavioralList from './pages/behavioral/BehavioralList'
import CounselingList from './pages/counseling/CounselingList'
import NotificationList from './pages/notifications/NotificationList'
// Portal pages
import TeacherClasses from './pages/portal/TeacherClasses'
import PrincipalOverview from './pages/portal/PrincipalOverview'
import GuidanceWellness from './pages/portal/GuidanceWellness'
import CashierProcess from './pages/portal/CashierProcess'
import ParentChildren from './pages/portal/ParentChildren'
import StudentGrades from './pages/portal/StudentGrades'
import RegistrarRecords from './pages/portal/RegistrarRecords'

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
              <Route path="users" element={<RoleGuard allowed={["super_admin","registrar"]}><UserList /></RoleGuard>} />
              <Route path="grades/entry" element={<RoleGuard allowed={["super_admin","teacher","registrar"]}><GradeEntry /></RoleGuard>} />
              <Route path="grades/reports" element={<RoleGuard allowed={["teacher","registrar","principal"]}><GradeReport /></RoleGuard>} />
              <Route path="attendance" element={<RoleGuard allowed={["teacher","registrar","principal","guidance"]}><AttendanceList /></RoleGuard>} />
              <Route path="fees" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><FeeList /></RoleGuard>} />
              <Route path="payments" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><PaymentList /></RoleGuard>} />
              <Route path="invoices" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><InvoiceList /></RoleGuard>} />
              <Route path="receipts" element={<RoleGuard allowed={["super_admin","cashier","registrar"]}><ReceiptList /></RoleGuard>} />
              <Route path="expenses" element={<RoleGuard allowed={["super_admin","cashier"]}><ExpenseList /></RoleGuard>} />
              <Route path="finance/reports" element={<RoleGuard allowed={["super_admin","cashier","principal"]}><FinanceReports /></RoleGuard>} />
              <Route path="announcements" element={<RoleGuard allowed={["registrar","teacher","principal","guidance","cashier","parent","student"]}><AnnouncementList /></RoleGuard>} />
              <Route path="schedule" element={<RoleGuard allowed={["registrar","teacher","principal","guidance"]}><ClassSchedule /></RoleGuard>} />
              <Route path="settings/school-info" element={<RoleGuard allowed={["super_admin","registrar"]}><SchoolInfo /></RoleGuard>} />
              <Route path="settings/system" element={<RoleGuard allowed={["super_admin","registrar"]}><SystemSettings /></RoleGuard>} />
              <Route path="audit-logs" element={<RoleGuard allowed={["super_admin","registrar"]}><AuditLog /></RoleGuard>} />
              <Route path="behavioral" element={<RoleGuard allowed={["super_admin","teacher","guidance","principal","registrar"]}><BehavioralList /></RoleGuard>} />
              <Route path="counseling" element={<RoleGuard allowed={["super_admin","guidance","principal","registrar","teacher"]}><CounselingList /></RoleGuard>} />
              <Route path="notifications" element={<RoleGuard allowed={["registrar","teacher","principal","guidance","cashier","parent","student"]}><NotificationList /></RoleGuard>} />
              {/* Portal Routes */}
              <Route path="portal/teacher/classes" element={<RoleGuard allowed={["teacher"]}><TeacherClasses /></RoleGuard>} />
              <Route path="portal/principal/overview" element={<RoleGuard allowed={["principal"]}><PrincipalOverview /></RoleGuard>} />
              <Route path="portal/guidance/wellness" element={<RoleGuard allowed={["guidance"]}><GuidanceWellness /></RoleGuard>} />
              <Route path="portal/cashier/process" element={<RoleGuard allowed={["cashier"]}><CashierProcess /></RoleGuard>} />
              <Route path="portal/parent/children" element={<RoleGuard allowed={["parent"]}><ParentChildren /></RoleGuard>} />
              <Route path="portal/student/grades" element={<RoleGuard allowed={["student"]}><StudentGrades /></RoleGuard>} />
              <Route path="portal/registrar/records" element={<RoleGuard allowed={["registrar"]}><RegistrarRecords /></RoleGuard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
