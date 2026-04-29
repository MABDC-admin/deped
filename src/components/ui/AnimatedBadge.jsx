import { motion } from 'framer-motion'

const variants = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  warning: 'bg-amber-100 text-amber-700 border-amber-200/50 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  danger: 'bg-red-100 text-red-700 border-red-200/50 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  info: 'bg-blue-100 text-blue-700 border-blue-200/50 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  purple: 'bg-purple-100 text-purple-700 border-purple-200/50 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200/50 dark:bg-dark-600 dark:text-gray-300 dark:border-dark-500',
}

const dotColors = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  purple: 'bg-purple-500',
  neutral: 'bg-gray-400',
}

export default function AnimatedBadge({ 
  children, variant = 'neutral', pulse = false, dot = false,
  icon: Icon, size = 'sm', className = '' 
}) {
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
    lg: 'px-5 py-2 text-base',
  }

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border
        ${sizeClasses[size]} ${variants[variant]} ${className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      whileHover={{ scale: 1.05 }}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[variant]}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[variant]}`} />
        </span>
      )}
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </motion.span>
  )
}
