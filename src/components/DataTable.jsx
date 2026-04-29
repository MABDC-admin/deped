import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import EmptyState from './EmptyState'
import LoadingSpinner from './LoadingSpinner'

const tableRowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i, 10) * 0.05,
      duration: 0.3,
      ease: 'easeOut',
    },
  }),
}

export default function DataTable({ columns, data, loading, searchable = true, pageSize = 10, onRowClick }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const filtered = useMemo(() => {
    if (!data) return []
    let result = [...data]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(row =>
        columns.some(col => {
          const val = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]) : ''
          return String(val || '').toLowerCase().includes(q)
        })
      )
    }
    if (sortCol !== null) {
      const col = columns[sortCol]
      result.sort((a, b) => {
        const aVal = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor]
        const bVal = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor]
        const cmp = String(aVal || '').localeCompare(String(bVal || ''), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [data, search, sortCol, sortDir, columns])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (idx) => {
    if (sortCol === idx) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(idx); setSortDir('asc') }
  }

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {searchable && (
        <motion.div
          className="mb-4 relative"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input-field pl-10 max-w-sm" />
        </motion.div>
      )}
      {filtered.length === 0 ? <EmptyState /> : (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => col.accessor && handleSort(idx)}>
                      <div className="flex items-center gap-1">
                        {col.header}
                        {col.accessor && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence mode="popLayout">
                  {paged.map((row, ri) => (
                    <motion.tr
                      key={row.id || ri}
                      className={
                        onRowClick
                          ? 'cursor-pointer transition-colors duration-150 hover:bg-blue-50/70 active:bg-blue-100/70'
                          : 'hover:bg-gray-50'
                      }
                      onClick={(e) => {
                        if (!onRowClick) return
                        // Don't trigger row click if user clicked a button, link, or action icon
                        const target = e.target.closest('button, a, [role="button"], .action-cell')
                        if (target) return
                        onRowClick(row)
                      }}
                      variants={tableRowVariants}
                      initial="hidden"
                      animate="visible"
                      custom={ri}
                      layout
                      whileHover={onRowClick ? { scale: 1.002, backgroundColor: 'rgba(59, 130, 246, 0.04)' } : {}}
                    >
                      {columns.map((col, ci) => (
                        <td key={ci} className={
                          'px-4 py-3 text-sm text-gray-700 whitespace-nowrap' +
                          (col.header === 'Actions' ? ' action-cell' : '')
                        }>
                          {col.cell ? col.cell(row) : (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor])}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <motion.div
              className="flex items-center justify-between mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-sm text-gray-500">Showing {(page-1)*pageSize+1}-{Math.min(page*pageSize, filtered.length)} of {filtered.length}</p>
              <div className="flex gap-2">
                <motion.button
                  onClick={() => setPage(p => Math.max(1, p-1))}
                  disabled={page===1}
                  className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </motion.button>
                <span className="flex items-center px-3 text-sm">Page {page} of {totalPages}</span>
                <motion.button
                  onClick={() => setPage(p => Math.min(totalPages, p+1))}
                  disabled={page===totalPages}
                  className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}
