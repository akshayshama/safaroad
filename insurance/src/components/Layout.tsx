import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Map, 
  FileCheck, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Bell,
  User,
  LogOut
} from 'lucide-react'
import clsx from 'clsx'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Map', href: '/map', icon: Map },
  { name: 'Claims', href: '/claims', icon: FileCheck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-surface p-2 rounded-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 bg-surface transform transition-transform lg:translate-x-0 lg:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-surface-light">
            <div className="flex items-center">
              <span className="text-3xl mr-3">🛣️</span>
              <div>
                <h1 className="text-xl font-bold">SafeRoad</h1>
                <p className="text-xs text-gray-500">Insurance Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary/20 text-primary'
                      : 'text-gray-400 hover:bg-surface-light hover:text-white'
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={20} className="mr-3" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-surface-light">
            <div className="flex items-center px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center">
                <User size={20} />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">Insurance Co.</p>
                <p className="text-xs text-gray-500">admin@safaroad.app</p>
              </div>
              <button className="text-gray-500 hover:text-white">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-surface-light px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold capitalize">
              {location.pathname.replace('/', '') || 'Dashboard'}
            </h2>
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-surface-light">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
              </button>
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
