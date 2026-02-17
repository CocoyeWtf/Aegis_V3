/* Barre latérale de navigation / Navigation sidebar (collapsible) */

import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/useAppStore'

const navItems = [
  { path: '/', label: 'nav.dashboard', icon: '📊' },
  { path: '/countries', label: 'nav.countries', icon: '🌍' },
  { path: '/bases', label: 'nav.bases', icon: '🏭' },
  { path: '/pdvs', label: 'nav.pdvs', icon: '🏪' },
  { path: '/suppliers', label: 'nav.suppliers', icon: '📦' },
  { path: '/volumes', label: 'nav.volumes', icon: '📋' },
  { path: '/contracts', label: 'nav.contracts', icon: '📝' },
  { path: '/distances', label: 'nav.distances', icon: '📏' },
  { path: '/base-activities', label: 'nav.baseActivities', icon: '🏷️' },
  { path: '/parameters', label: 'nav.parameters', icon: '⚙️' },
  { path: '/tour-planning', label: 'nav.tourPlanning', icon: '🗺️' },
  { path: '/tour-history', label: 'nav.tourHistory', icon: '📜' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <aside
      className="h-screen flex flex-col border-r transition-all duration-300 shrink-0"
      style={{
        width: sidebarCollapsed ? '56px' : '240px',
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Logo + toggle */}
      <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xl shrink-0">🔥</span>
          {!sidebarCollapsed && (
            <span className="font-bold text-base whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>
              Chaos Route
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          {sidebarCollapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                isActive ? 'font-semibold' : ''
              }`
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
              justifyContent: sidebarCollapsed ? 'center' : undefined,
            })}
            title={sidebarCollapsed ? t(item.label) : undefined}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {!sidebarCollapsed && <span className="truncate">{t(item.label)}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
