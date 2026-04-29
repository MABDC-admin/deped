export function Skeleton({ className = '', variant = 'rect' }) {
  const variants = {
    rect: 'h-4 w-full',
    circle: 'h-10 w-10 rounded-full',
    card: 'h-32 w-full',
    text: 'h-3 w-3/4',
    title: 'h-6 w-1/2',
    avatar: 'h-12 w-12 rounded-full',
    button: 'h-10 w-24 rounded-xl',
    stat: 'h-20 w-full',
  }

  return (
    <div className={`skeleton animate-shimmer ${variants[variant] || variants.rect} ${className}`} />
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="title" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-dark-700">
        <Skeleton variant="title" />
      </div>
      <div className="divide-y divide-gray-100 dark:divide-dark-700">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4" style={{ animationDelay: `${i * 100}ms` }}>
            <Skeleton variant="avatar" />
            {Array.from({ length: cols - 1 }).map((_, j) => (
              <Skeleton key={j} className={`h-4 flex-1 ${j === cols - 2 ? 'w-1/4' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-6 space-y-3">
            <div className="flex justify-between items-start">
              <Skeleton variant="text" className="w-20" />
              <Skeleton variant="circle" className="h-8 w-8" />
            </div>
            <Skeleton variant="title" className="w-16 h-8" />
            <Skeleton variant="text" className="w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

export default function SkeletonLoader({ type = 'rect', ...props }) {
  if (type === 'dashboard') return <SkeletonDashboard />
  if (type === 'table') return <SkeletonTable {...props} />
  if (type === 'card') return <SkeletonCard />
  return <Skeleton variant={type} {...props} />
}
