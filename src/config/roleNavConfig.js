import { Wallet, PieChart, FileSpreadsheet, 
  LayoutDashboard, Users, GraduationCap, ClipboardList, Calendar, 
  DollarSign, Megaphone, Settings, Shield, BookOpen, UserCheck,
  Heart, Brain, Receipt, Eye, School, BarChart3, Clock,
  AlertTriangle, FileText, Bell, Layers, Target, CreditCard
} from 'lucide-react';

// Define navigation items per role
export const roleNavConfig = {
  super_admin: {
    label: 'Admin Portal',
    color: 'from-violet-500 to-purple-600',
    sections: [
      {
        title: 'Overview',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Records Office', path: '/portal/registrar/records', icon: FileText },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
          { label: 'Notifications', path: '/notifications', icon: Bell },
        ]
      },
      {
        title: 'Academic',
        items: [
          { label: 'Students', path: '/students', icon: Users },
          { label: 'Teachers', path: '/teachers', icon: GraduationCap },
          { label: 'Sections', path: '/sections', icon: Layers },
          { label: 'Subjects', path: '/subjects', icon: BookOpen },
          { label: 'Grade Levels', path: '/grade-levels', icon: Target },
          { label: 'Schedule', path: '/schedule', icon: Calendar },
          { label: 'Enrollment', path: '/enrollment', icon: ClipboardList },
        ]
      },
      {
        title: 'Grades & Attendance',
        items: [
          { label: 'Grade Entry', path: '/grades/entry', icon: FileText },
          { label: 'Grade Reports', path: '/grades/reports', icon: BarChart3 },
          { label: 'Attendance', path: '/attendance', icon: UserCheck },
        ]
      },
      {
        title: 'Finance',
        items: [
          { label: 'Fees', path: '/fees', icon: DollarSign },
          { label: 'Payments', path: '/payments', icon: Receipt },
          { label: 'Expenses', path: '/expenses', icon: Wallet },
          { label: 'Loans', path: '/loans', icon: CreditCard },
        ]
      },
      {
        title: 'Student Services',
        items: [
          { label: 'Behavioral', path: '/behavioral', icon: AlertTriangle },
          { label: 'Counseling', path: '/counseling', icon: Heart },
        ]
      },
      {
        title: 'System',
        items: [
          { label: 'Users', path: '/users', icon: Shield },
          { label: 'School Years', path: '/school-years', icon: Clock },
          { label: 'School Info', path: '/settings/school-info', icon: School },
          { label: 'Settings', path: '/settings/system', icon: Settings },
          { label: 'Audit Log', path: '/audit-logs', icon: Eye },
        ]
      }
    ]
  },
  
  teacher: {
    label: 'Teacher Portal',
    color: 'from-blue-500 to-cyan-500',
    sections: [
      {
        title: 'My Portal',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'My Classes', path: '/portal/teacher/classes', icon: BookOpen },
          { label: 'My Schedule', path: '/schedule', icon: Calendar },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
        ]
      },
      {
        title: 'Academic Work',
        items: [
          { label: 'Grade Entry', path: '/grades/entry', icon: FileText },
          { label: 'Grade Reports', path: '/grades/reports', icon: BarChart3 },
          { label: 'Attendance', path: '/attendance', icon: UserCheck },
        ]
      },
      {
        title: 'Student Services',
        items: [
          { label: 'My Students', path: '/students', icon: Users },
          { label: 'Behavioral', path: '/behavioral', icon: AlertTriangle },
          { label: 'Counseling', path: '/counseling', icon: Heart },
        ]
      }
    ]
  },
  
  principal: {
    label: 'Principal Portal',
    color: 'from-amber-500 to-orange-600',
    sections: [
      {
        title: 'Command Center',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'School Overview', path: '/portal/principal/overview', icon: School },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
        ]
      },
      {
        title: 'Monitor',
        items: [
          { label: 'Students', path: '/students', icon: Users },
          { label: 'Teachers', path: '/teachers', icon: GraduationCap },
          { label: 'Grades', path: '/grades/reports', icon: BarChart3 },
          { label: 'Attendance', path: '/attendance', icon: UserCheck },
          { label: 'Schedule', path: '/schedule', icon: Calendar },
        ]
      },
      {
        title: 'Reports',
        items: [
          { label: 'Behavioral', path: '/behavioral', icon: AlertTriangle },
          { label: 'Counseling', path: '/counseling', icon: Heart },
          { label: 'Finance', path: '/payments', icon: DollarSign },
          { label: 'Audit Log', path: '/audit-logs', icon: Eye },
        ]
      }
    ]
  },
  
  guidance: {
    label: 'Guidance Portal',
    color: 'from-pink-500 to-rose-600',
    sections: [
      {
        title: 'Wellness Center',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Student Wellness', path: '/portal/guidance/wellness', icon: Heart },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
        ]
      },
      {
        title: 'Case Management',
        items: [
          { label: 'Behavioral Records', path: '/behavioral', icon: AlertTriangle },
          { label: 'Counseling', path: '/counseling', icon: Brain },
          { label: 'Students', path: '/students', icon: Users },
          { label: 'Attendance', path: '/attendance', icon: UserCheck },
        ]
      }
    ]
  },
  
  cashier: {
    label: 'Cashier Portal',
    color: 'from-green-500 to-emerald-600',
    sections: [
      {
        title: 'Finance Center',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Process Payment', path: '/portal/cashier/process', icon: Receipt },
          { label: 'Student Ledger', path: '/portal/cashier/ledger', icon: BookOpen },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
          { label: 'Notifications', path: '/notifications', icon: Bell },
        ]
      },
      {
        title: 'Fee Management',
        items: [
          { label: 'Fee Types & Structure', path: '/fees', icon: DollarSign },
          { label: 'Payment Records', path: '/payments', icon: Receipt },
          { label: 'Invoices', path: '/invoices', icon: FileText },
          { label: 'Receipts', path: '/receipts', icon: FileSpreadsheet },
        ]
      },
      {
        title: 'Reports & Tracking',
        items: [
          { label: 'Expenses', path: '/expenses', icon: Wallet },
          { label: 'Loans', path: '/loans', icon: CreditCard },
          { label: 'Financial Reports', path: '/finance/reports', icon: PieChart },
          { label: 'Students', path: '/students', icon: Users },
        ]
      }
    ]
  },
  parent: {
    label: 'Parent Portal',
    color: 'from-teal-500 to-cyan-600',
    sections: [
      {
        title: 'Family',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'My Children', path: '/portal/parent/children', icon: Users },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
        ]
      },
    ]
  },
  
  student: {
    label: 'Student Portal',
    color: 'from-indigo-500 to-blue-600',
    sections: [
      {
        title: 'My Portal',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
        ]
      },
      {
        title: 'Academics',
        items: [
          { label: 'My Grades', path: '/portal/student/grades', icon: BarChart3 },
        ]
      }
    ]
  },
  
  registrar: {
    label: 'Registrar Portal',
    color: 'from-slate-500 to-gray-700',
    sections: [
      {
        title: 'Records Office',
        items: [
          { label: 'Dashboard', path: '/', icon: LayoutDashboard },
          { label: 'Records Office', path: '/portal/registrar/records', icon: FileText },
          { label: 'Announcements', path: '/announcements', icon: Megaphone },
          { label: 'Notifications', path: '/notifications', icon: Bell },
        ]
      },
      {
        title: 'Student Records',
        items: [
          { label: 'Students', path: '/students', icon: Users },
          { label: 'Enrollment', path: '/enrollment', icon: ClipboardList },
          { label: 'Sections', path: '/sections', icon: Layers },
          { label: 'Grade Levels', path: '/grade-levels', icon: Target },
          { label: 'School Years', path: '/school-years', icon: Clock },
        ]
      },
      {
        title: 'Academic',
        items: [
          { label: 'Grade Entry', path: '/grades/entry', icon: FileText },
          { label: 'Grade Reports', path: '/grades/reports', icon: BarChart3 },
          { label: 'Attendance', path: '/attendance', icon: UserCheck },
          { label: 'Schedule', path: '/schedule', icon: Calendar },
          { label: 'Subjects', path: '/subjects', icon: BookOpen },
        ]
      }
    ]
  }
};

export function getNavForRole(role) {
  return roleNavConfig[role] || roleNavConfig['student'];
}
