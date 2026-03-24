import { NavLink, Outlet } from 'react-router-dom'
import { Users, Briefcase, Layers, Network, GitBranch, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Members', icon: Users, path: '/members' },
  { label: 'Programs', icon: Briefcase, path: '/programs' },
  { label: 'Functional Areas', icon: Layers, path: '/functional-areas' },
  { label: 'Teams', icon: Network, path: '/teams' },
  { label: 'Import', icon: Upload, path: '/import' },
]

const treeNavItems = [
  { label: 'Org Chart', icon: GitBranch, path: '/tree/org', end: true },
  { label: 'Program Trees', icon: Briefcase, path: '/tree/programs', end: false },
  { label: 'Area Trees', icon: Layers, path: '/tree/areas', end: false },
]

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-white flex flex-col">
        {/* App title */}
        <div className="px-6 py-5 border-b border-slate-700">
          <span className="text-lg font-semibold tracking-tight">Team Resourcer</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, path }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {/* Tree Views section */}
          <div className="pt-4 pb-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tree Views
            </p>
          </div>
          {treeNavItems.map(({ label, icon: Icon, path, end }) => (
            <NavLink
              key={path}
              to={path}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
