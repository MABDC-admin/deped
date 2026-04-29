import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  ClipboardList, UserCheck, Settings, Bell, DollarSign, BarChart3,
  School, FileText, Shield, Clock, AlertTriangle, Heart, Megaphone,
  BookMarked, Activity, Layers, CalendarDays, UserCog, Command, ArrowRight,
  Wallet, CreditCard
} from 'lucide-react'

const commands = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, category: 'Navigation' },
  { name: 'Students', path: '/students', icon: GraduationCap, category: 'Navigation' },
  { name: 'New Enrollment', path: '/enrollment/new', icon: ClipboardList, category: 'Actions' },
  { name: 'Enrollment List', path: '/enrollment', icon: ClipboardList, category: 'Navigation' },
  { name: 'Teachers', path: '/teachers', icon: UserCheck, category: 'Navigation' },
  { name: 'Sections', path: '/sections', icon: BookOpen, category: 'Navigation' },
  { name: 'Subjects', path: '/subjects', icon: BookMarked, category: 'Navigation' },
  { name: 'Grade Levels', path: '/grade-levels', icon: Layers, category: 'Navigation' },
  { name: 'School Years', path: '/school-years', icon: CalendarDays, category: 'Navigation' },
  { name: 'Users & Roles', path: '/users', icon: UserCog, category: 'Navigation' },
  { name: 'Grade Entry', path: '/grades/entry', icon: FileText, category: 'Grading' },
  { name: 'Grade Reports', path: '/grades/reports', icon: BarChart3, category: 'Grading' },
  { name: 'Attendance', path: '/attendance', icon: Calendar, category: 'Navigation' },
  { name: 'Fees', path: '/fees', icon: DollarSign, category: 'Finance' },
  { name: 'Payments', path: '/payments', icon: Activity, category: 'Finance' },
  { name: 'Student Ledger', path: '/portal/cashier/ledger', icon: BookOpen, category: 'Finance' },
  { name: 'Expenses', path: '/expenses', icon: Wallet, category: 'Finance' },
  { name: 'Loans', path: '/loans', icon: CreditCard, category: 'Finance' },
  { name: 'Announcements', path: '/announcements', icon: Megaphone, category: 'Communication' },
  { name: 'Notifications', path: '/notifications', icon: Bell, category: 'Communication' },
  { name: 'Class Schedule', path: '/schedule', icon: Clock, category: 'Navigation' },
  { name: 'School Info', path: '/settings/school-info', icon: School, category: 'Settings' },
  { name: 'System Settings', path: '/settings/system', icon: Settings, category: 'Settings' },
  { name: 'Audit Logs', path: '/audit-logs', icon: Shield, category: 'System' },
  { name: 'Behavioral Records', path: '/behavioral', icon: AlertTriangle, category: 'Student Services' },
  { name: 'Counseling', path: '/counseling', icon: Heart, category: 'Student Services' },
]

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query) return commands
    const q = query.toLowerCase()
    return commands.filter(c => 
      c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    )
  }, [query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = (cmd) => {
    navigate(cmd.path)
    setIsOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex])
    }
  }

  const grouped = useMemo(() => {
    const groups = {}
    filtered.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filtered])

  let flatIndex = -1

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <motion.div
            className="relative w-full max-w-xl mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-dark-600/50 overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-dark-700">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search pages, actions..."
                className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none text-sm"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-dark-700 rounded-md">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">No results found</div>
              ) : (
                Object.entries(grouped).map(([category, cmds]) => (
                  <div key={category} className="mb-2">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {category}
                    </div>
                    {cmds.map(cmd => {
                      flatIndex++
                      const idx = flatIndex
                      return (
                        <motion.button
                          key={cmd.path}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors
                            ${idx === selectedIndex
                              ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
                          onClick={() => handleSelect(cmd)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          whileHover={{ x: 4 }}
                          transition={{ duration: 0.15 }}
                        >
                          <cmd.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1 text-left font-medium">{cmd.name}</span>
                          {idx === selectedIndex && (
                            <ArrowRight className="w-3 h-3 text-primary-400" />
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-200 dark:border-dark-700 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded">↵</kbd> Open</span>
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded">Esc</kbd> Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
