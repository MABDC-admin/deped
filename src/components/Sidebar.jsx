import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Sparkles, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getNavForRole } from '../config/roleNavConfig';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navConfig = getNavForRole(role);
  const [collapsed, setCollapsed] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setIsOpen(false);
    navigate('/login', { replace: true });
  };

  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'User';

  const sidebarContent = (
    <div className="relative flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${navConfig.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <p className="font-bold text-sm text-gray-800 dark:text-white">DepEd SMS</p>
                <p className={`text-xs font-medium bg-gradient-to-r ${navConfig.color} bg-clip-text text-transparent`}>
                  {navConfig.label}
                </p>
              </div>
            )}
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100/80 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {/* Collapse toggle — desktop only */}
          {!collapsed ? (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100/80 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100/80 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              title="Expand sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
        {navConfig.sections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed && (
              <div className="flex items-center w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <span>{section.title}</span>
              </div>
            )}
            
            <div className="overflow-hidden space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) => `
                      group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-150 relative
                      ${isActive
                        ? `bg-gradient-to-r ${navConfig.color} text-white shadow-lg shadow-blue-500/20`
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/10 dark:border-white/5">
        {collapsed ? (
          <button 
            onClick={handleLogout}
            className="w-full flex justify-center p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${navConfig.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{firstName}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">{role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile sidebar — slide-in drawer */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 w-72
          transform transition-transform duration-300 ease-in-out
          lg:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="absolute inset-0 glass-card rounded-none border-l-0 border-t-0 border-b-0" />
        {sidebarContent}
      </aside>

      {/* Desktop sidebar — always visible */}
      <aside
        className={`
          hidden lg:flex flex-col flex-shrink-0
          h-screen sticky top-0
          transition-all duration-300
          ${collapsed ? 'w-20' : 'w-72'}
        `}
      >
        <div className="absolute inset-0 glass-card rounded-none border-l-0 border-t-0 border-b-0" />
        {sidebarContent}
      </aside>
    </>
  );
}
