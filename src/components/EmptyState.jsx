import { InboxIcon } from 'lucide-react'
import { motion } from 'framer-motion'

export default function EmptyState({ title = 'No data found', description = 'Get started by creating a new record.', icon: Icon = InboxIcon }) {
  return (
    <motion.div
      className="text-center py-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
      >
        <Icon className="mx-auto h-12 w-12 text-gray-400" />
      </motion.div>
      <motion.h3
        className="mt-2 text-sm font-semibold text-gray-900"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
      >
        {title}
      </motion.h3>
      <motion.p
        className="mt-1 text-sm text-gray-500"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        {description}
      </motion.p>
    </motion.div>
  )
}
