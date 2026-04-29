import { motion } from 'framer-motion'

export default function PageHeader({ title, subtitle, children }) {
  return (
    <motion.div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div>
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            className="mt-1 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {children && (
        <motion.div
          className="mt-4 sm:mt-0 flex gap-3"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  )
}
