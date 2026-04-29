import { useAuth } from '../contexts/AuthContext'
import Dashboard from '../pages/Dashboard'
import CashierProcess from '../pages/portal/CashierProcess'
import RegistrarDashboard from '../pages/portal/RegistrarDashboard'
import TeacherClasses from '../pages/portal/TeacherClasses'
import PrincipalOverview from '../pages/portal/PrincipalOverview'
import GuidanceWellness from '../pages/portal/GuidanceWellness'
import ParentChildren from '../pages/portal/ParentChildren'
import StudentGrades from '../pages/portal/StudentGrades'

const roleDashboards = {
  super_admin: Dashboard,
  cashier: CashierProcess,
  registrar: RegistrarDashboard,
  teacher: TeacherClasses,
  principal: PrincipalOverview,
  guidance: GuidanceWellness,
  parent: ParentChildren,
  student: StudentGrades,
}

export default function DashboardRouter() {
  const { role } = useAuth()
  const DashboardComponent = roleDashboards[role] || Dashboard
  return <DashboardComponent />
}
