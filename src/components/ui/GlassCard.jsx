import { motion } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext'

export default function GlassCard({ 
  children, className = '', hover = true, glow = false, 
  gradient = null, padding = 'p-6', animate = true, delay = 0,
  onClick, ...props 
}) {
  const { isDark } = useTheme()
  
  const glowClass = glow ? (isDark ? 'shadow-neon-blue' : 'shadow-lg shadow-primary-100') : ''
  const gradientBg = gradient ? `bg-gradient-to-br ${gradient}` : ''
  
  const Comp = animate ? motion.div : 'div'
  const animateProps = animate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] },
  } : {}

  return (
    <Comp
      className={`glass-card ${hover ? 'glass-card-hover' : ''} ${padding} ${glowClass} ${gradientBg} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      whileHover={hover && animate ? { y: -2, transition: { duration: 0.2 } } : undefined}
      whileTap={onClick && animate ? { scale: 0.98 } : undefined}
      onClick={onClick}
      {...animateProps}
      {...props}
    >
      {children}
    </Comp>
  )
}
