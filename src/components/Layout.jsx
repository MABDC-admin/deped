import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { Breadcrumbs, CommandPalette } from './ui'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-950 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar setIsOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-mesh">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
