import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useMotionValue, useTransform } from 'framer-motion'

export default function AnimatedCounter({ value, duration = 1.5, className = '', prefix = '', suffix = '', decimals = 0 }) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 50, damping: 20, duration: duration * 1000 })
  const display = useTransform(spring, (latest) => {
    const num = decimals > 0 ? latest.toFixed(decimals) : Math.round(latest)
    return `${prefix}${Number(num).toLocaleString()}${suffix}`
  })
  const ref = useRef(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          motionValue.set(value)
          setHasAnimated(true)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, hasAnimated])

  useEffect(() => {
    if (hasAnimated) motionValue.set(value)
  }, [value])

  return <motion.span ref={ref} className={className}>{display}</motion.span>
}
