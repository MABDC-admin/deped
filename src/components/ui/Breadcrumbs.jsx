import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Home } from 'lucide-react'

const pathNames = {
  'students': 'Students',
  'enrollment': 'Enrollment',
  'new': 'New',
  'teachers': 'Teachers',
  'sections': 'Sections',
  'subjects': 'Subjects',
  'grade-levels': 'Grade Levels',
  'school-years': 'School Years',
  'promotions': 'Promotions',
  'users': 'Users & Roles',
  'grades': 'Grades',
  'entry': 'Entry',
  'reports': 'Reports',
  'attendance': 'Attendance',
  'fees': 'Fees',
  'payments': 'Payments',
  'announcements': 'Announcements',
  'schedule': 'Schedule',
  'settings': 'Settings',
  'school-info': 'School Info',
  'system': 'System',
  'audit-logs': 'Audit Logs',
  'behavioral': 'Behavioral Records',
  'counseling': 'Counseling',
  'notifications': 'Notifications',
}

export default function Breadcrumbs() {
  const location = useLocation()
  const pathSegments = location.pathname.split('/').filter(Boolean)

  if (pathSegments.length === 0) return null

  return (
    <motion.nav 
      className="flex items-center gap-1 text-sm mb-4"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link to="/" className="flex items-center gap-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {pathSegments.map((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/')
        const isLast = index === pathSegments.length - 1
        const name = pathNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

        return (
          <motion.span 
            key={path} 
            className="flex items-center gap-1"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />
            {isLast ? (
              <span className="font-medium text-gray-700 dark:text-gray-200">{name}</span>
            ) : (
              <Link to={path} className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                {name}
              </Link>
            )}
          </motion.span>
        )
      })}
    </motion.nav>
  )
}
