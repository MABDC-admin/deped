import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

function TabIcon({ icon }) {
  if (!icon) return null

  if (typeof icon === 'string') {
    return (
      <span aria-hidden="true" className="text-sm leading-none">
        {icon}
      </span>
    )
  }

  const Icon = icon
  return <Icon className="w-4 h-4" />
}

export default function AnimatedTabs({ tabs, activeTab, onChange, className = '' }) {
  const [indicatorStyle, setIndicatorStyle] = useState({})
  const tabRefs = useRef([])

  useEffect(() => {
    const activeIndex = tabs.findIndex(t => t.id === activeTab)
    if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
      const tab = tabRefs.current[activeIndex]
      setIndicatorStyle({
        left: tab.offsetLeft,
        width: tab.offsetWidth,
      })
    }
  }, [activeTab, tabs])

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-1 bg-gray-100/80 dark:bg-dark-800/80 rounded-xl p-1 backdrop-blur-sm">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={el => tabRefs.current[index] = el}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200
              ${activeTab === tab.id 
                ? 'text-primary-700 dark:text-primary-300' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            <TabIcon icon={tab.icon} />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full
                ${activeTab === tab.id 
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' 
                  : 'bg-gray-200 text-gray-500 dark:bg-dark-600 dark:text-gray-400'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <motion.div
        className="absolute top-1 h-[calc(100%-8px)] bg-white dark:bg-dark-700 rounded-lg shadow-sm"
        animate={indicatorStyle}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ zIndex: 0 }}
      />
    </div>
  )
}
