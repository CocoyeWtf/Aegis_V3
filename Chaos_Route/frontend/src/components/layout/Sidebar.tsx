/* Barre latérale de navigation / Navigation sidebar (collapsible) */

import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/useAppStore'
import { useAuthStore } from '../../stores/useAuthStore'

interface NavItem {
  path: string
  label: string
  icon: string
  resource: string
}

const navItems: NavItem[] = [
  { path: '/', label: 'nav.dashboard', icon: '📊', resource: 'dashboard' },
  { path: '/countries', label: 'nav.countries', icon: '🌍', resource: 'countries' },
  { path: '/bases', label: 'nav.bases', icon: '🏭', resource: 'bases' },
  { path: '/pdvs', label: 'nav.pdvs', icon: '🏪', resource: 'pdvs' },
  { path: '/suppliers', label: 'nav.suppliers', icon: '📦', resource: 'suppliers' },
  { path: '/volumes', label: 'nav.volumes', icon: '📋', resource: 'volumes' },
  { path: '/contracts', label: 'nav.contracts', icon: '📝', resource: 'contracts' },
  { path: '/distances', label: 'nav.distances', icon: '📏', resource: 'distances' },
  { path: '/base-activities', label: 'nav.baseActivities', icon: '🏷️', resource: 'base-activities' },
  { path: '/parameters', label: 'nav.parameters', icon: '⚙️', resource: 'parameters' },
  { path: '/tour-planning', label: 'nav.tourPlanning', icon: '🗺️', resource: 'tour-planning' },
  { path: '/tour-history', label: 'nav.tourHistory', icon: '📜', resource: 'tour-history' },
]

const adminItems: NavItem[] = [
  { path: '/admin/users', label: 'nav.users', icon: '👥', resource: 'users' },
  { path: '/admin/roles', label: 'nav.roles', icon: '🛡️', resource: 'roles' },
]

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation()

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
          isActive ? 'font-semibold' : ''
        }`
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
        color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
        justifyContent: collapsed ? 'center' : undefined,
      })}
      title={collapsed ? t(item.label) : undefined}
    >
      <span className="text-base shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{t(item.label)}</span>}
    </NavLink>
  )
}

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const hasPermission = useAuthStore((s) => s.hasPermission)

  const visibleNav = navItems.filter((item) => hasPermission(item.resource, 'read'))
  const visibleAdmin = adminItems.filter((item) => hasPermission(item.resource, 'read'))

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
        {visibleNav.map((item) => (
          <NavItemLink key={item.path} item={item} collapsed={sidebarCollapsed} />
        ))}

        {/* Section Administration / Admin section */}
        {visibleAdmin.length > 0 && (
          <>
            <div
              className="mt-4 mb-1 px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {!sidebarCollapsed && t('nav.admin')}
              {sidebarCollapsed && '—'}
            </div>
            {visibleAdmin.map((item) => (
              <NavItemLink key={item.path} item={item} collapsed={sidebarCollapsed} />
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
