import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
const ringSizes = { sm: 'w-6 h-6', md: 'w-12 h-12', lg: 'w-16 h-16' }

export default function LoadingSpinner({ size = 'md' }) {
  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className={"absolute rounded-full border-2 border-primary-200 " + ringSizes[size]}
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Loader2 className={sizes[size] + ' animate-spin text-primary-600'} />
      </motion.div>
    </div>
  )
}
