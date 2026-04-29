import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { NotificationCenter } from './ui'
import {
  Menu, Search, Sun, Moon, LogOut, User, Settings,
  ChevronDown, Command, Maximize, Minimize
} from 'lucide-react'

export default function Topbar({ setIsOpen }) {
  const { user, role, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const stopMenuEvent = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
  }

  const handleSettings = (event) => {
    stopMenuEvent(event)
    setShowProfile(false)
    navigate('/settings/system')
  }

  const handleLogout = async (event) => {
    stopMenuEvent(event)
    setShowProfile(false)
    try {
      await logout()
    } catch (err) {
      console.error('Logout error:', err)
    }
    navigate('/login', { replace: true })
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const userInitials = user?.user_metadata?.full_name 
    ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'AD'

  const roleBadgeColors = {
    admin: 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300',
    teacher: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    principal: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    guidance: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
    cashier: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    parent: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    student: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  }

  return (
    <header className="glass-topbar sticky top-0 z-[1000] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Menu + Search */}
        <div className="flex items-center gap-3">
          <motion.button
            className="btn-icon lg:hidden"
            onClick={() => setIsOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          <motion.button
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-gray-100/80 dark:bg-dark-700/80 hover:bg-gray-200/80 dark:hover:bg-dark-600/80 rounded-xl text-sm text-gray-400 transition-all duration-200 min-w-[200px]"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-white dark:bg-dark-600 rounded-md shadow-sm">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </motion.button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <motion.button
            className="btn-icon"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait">
              {isDark ? (
                <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Sun className="w-5 h-5 text-amber-400" />
                </motion.div>
              ) : (
                <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Moon className="w-5 h-5 text-gray-500" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Fullscreen */}
          <motion.button
            className="btn-icon hidden md:flex"
            onClick={toggleFullscreen}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </motion.button>

          {/* Notifications */}
          <NotificationCenter />

          {/* Profile */}
          <div className="relative z-[1001]" ref={profileRef}>
            <motion.button
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100/80 dark:hover:bg-dark-700/50 transition-all duration-200"
              onClick={() => setShowProfile(!showProfile)}
              whileTap={{ scale: 0.97 }}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-primary-500/20">
                {userInitials}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${roleBadgeColors[role] || 'text-gray-400'} px-1 rounded`}>
                  {role || 'admin'}
                </p>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-400 hidden md:block" />
            </motion.button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-dark-700 overflow-hidden z-[1002]"
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="p-3 border-b border-gray-100 dark:border-dark-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {user?.user_metadata?.full_name || 'Admin User'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button type="button" className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-xl transition-colors"
                      onPointerDown={handleSettings}
                      onClick={handleSettings}>
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button type="button" className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                      onPointerDown={handleLogout}
                      onClick={handleLogout}>
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
