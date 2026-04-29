import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

export default function EmptyState({ 
  icon: Icon = Inbox, title = 'No data yet', 
  description = 'Items will appear here once created.',
  action, actionLabel = 'Get Started', className = '' 
}) {
  return (
    <motion.div
      className={`flex flex-col items-center justify-center py-16 ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center mb-6"
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      >
        <Icon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
      </motion.div>
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm mb-6">{description}</p>
      {action && (
        <motion.button
          className="btn-primary"
          onClick={action}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  )
}
