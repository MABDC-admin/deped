import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform, useInView } from 'framer-motion'

function AnimatedNumber({ value }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const numericValue = typeof value === 'number' ? value : parseInt(value, 10)
  const isNumeric = !isNaN(numericValue) && typeof value !== 'string'

  const spring = useSpring(0, { damping: 30, stiffness: 100 })
  const display = useTransform(spring, (v) => Math.round(v))
  const [displayVal, setDisplayVal] = useState(0)

  useEffect(() => {
    if (isInView && isNumeric) {
      spring.set(numericValue)
    }
  }, [isInView, numericValue, spring, isNumeric])

  useEffect(() => {
    if (!isNumeric) return
    const unsubscribe = display.on('change', (v) => setDisplayVal(v))
    return unsubscribe
  }, [display, isNumeric])

  if (!isNumeric) {
    return <span ref={ref}>{value}</span>
  }

  return <span ref={ref}>{displayVal}</span>
}

export default function StatsCard({ title, value, icon: Icon, color = 'blue', loading }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  }
  return (
    <motion.div
      className="card flex items-center gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}
    >
      <motion.div
        className={"p-3 rounded-lg " + (colors[color] || colors.blue)}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <Icon className="w-6 h-6" />
      </motion.div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {loading ? (
          <motion.div
            className="h-8 w-16 bg-gray-200 rounded mt-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        ) : (
          <p className="text-2xl font-bold text-gray-900">
            <AnimatedNumber value={value} />
          </p>
        )}
      </div>
    </motion.div>
  )
}
