/* Barre latérale de navigation / Navigation sidebar */

import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/useAppStore'

const navItems = [
  { path: '/', label: 'nav.dashboard', icon: '📊' },
  { path: '/countries', label: 'nav.countries', icon: '🌍' },
  { path: '/bases', label: 'nav.bases', icon: '🏭' },
  { path: '/pdvs', label: 'nav.pdvs', icon: '🏪' },
  { path: '/vehicles', label: 'nav.vehicles', icon: '🚛' },
  { path: '/suppliers', label: 'nav.suppliers', icon: '📦' },
  { path: '/volumes', label: 'nav.volumes', icon: '📋' },
  { path: '/contracts', label: 'nav.contracts', icon: '📝' },
  { path: '/distances', label: 'nav.distances', icon: '📏' },
  { path: '/parameters', label: 'nav.parameters', icon: '⚙️' },
  { path: '/tour-planning', label: 'nav.tourPlanning', icon: '🗺️' },
  { path: '/tour-history', label: 'nav.tourHistory', icon: '📜' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed } = useAppStore()

  return (
    <aside
      className="h-screen flex flex-col border-r transition-all duration-300"
      style={{
        width: sidebarCollapsed ? '64px' : '240px',
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="p-4 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <span className="text-2xl">🔥</span>
        {!sidebarCollapsed && (
          <span className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>
            Chaos Route
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive ? 'font-semibold' : ''
              }`
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
            })}
          >
            <span className="text-lg">{item.icon}</span>
            {!sidebarCollapsed && <span>{t(item.label)}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
