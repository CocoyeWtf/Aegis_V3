/* Barre latérale de navigation 2 niveaux / Two-level sliding navigation sidebar */

import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/useAppStore'
import { useAuthStore } from '../../stores/useAuthStore'

interface NavItem {
  path: string
  label: string
  icon: string
  resource: string
  superadminOnly?: boolean
}

interface NavGroup {
  key: string
  label: string
  icon: string
  path?: string
  resource?: string
  children?: NavItem[]
}

const navGroups: NavGroup[] = [
  { key: 'dashboard', label: 'nav.dashboard', icon: '📊', path: '/', resource: 'dashboard' },
  {
    key: 'database',
    label: 'nav.database',
    icon: '🗄️',
    children: [
      { path: '/countries', label: 'nav.countries', icon: '🌍', resource: 'countries' },
      { path: '/bases', label: 'nav.bases', icon: '🏭', resource: 'bases' },
      { path: '/pdvs', label: 'nav.pdvs', icon: '🏪', resource: 'pdvs' },
      { path: '/suppliers', label: 'nav.suppliers', icon: '📦', resource: 'suppliers' },
      { path: '/base-activities', label: 'nav.baseActivities', icon: '🏷️', resource: 'base-activities' },
    ],
  },
  {
    key: 'transport',
    label: 'nav.transportOps',
    icon: '🚛',
    children: [
      { path: '/contracts', label: 'nav.contracts', icon: '📝', resource: 'contracts' },
      { path: '/distances', label: 'nav.distances', icon: '📏', resource: 'distances' },
      { path: '/volumes', label: 'nav.volumes', icon: '📋', resource: 'volumes' },
      { path: '/fuel-prices', label: 'nav.fuelPrices', icon: '⛽', resource: 'parameters' },
      { path: '/km-tax', label: 'nav.kmTax', icon: '💰', resource: 'distances' },
      { path: '/tour-planning', label: 'nav.tourPlanning', icon: '🗺️', resource: 'tour-planning' },
      { path: '/tour-history', label: 'nav.tourHistory', icon: '📜', resource: 'tour-history' },
      { path: '/transporter-summary', label: 'nav.transporterSummary', icon: '🧾', resource: 'tour-history' },
    ],
  },
  {
    key: 'baseOps',
    label: 'nav.baseOps',
    icon: '🏭',
    children: [
      { path: '/operations', label: 'nav.postier', icon: '📮', resource: 'operations' },
    ],
  },
  { key: 'guardPost', label: 'nav.guardPost', icon: '🚧', path: '/guard-post', resource: 'guard-post' },
  {
    key: 'admin',
    label: 'nav.admin',
    icon: '⚙️',
    children: [
      { path: '/admin/users', label: 'nav.users', icon: '👥', resource: 'users' },
      { path: '/admin/roles', label: 'nav.roles', icon: '🛡️', resource: 'roles' },
      { path: '/parameters', label: 'nav.parameters', icon: '⚙️', resource: 'parameters' },
      { path: '/audit', label: 'nav.auditLog', icon: '📜', resource: 'parameters', superadminOnly: true },
    ],
  },
]

/* Trouve le groupe contenant la route active / Find group containing active route */
function findGroupForPath(pathname: string): string | null {
  for (const group of navGroups) {
    if (group.children) {
      for (const child of group.children) {
        if (pathname === child.path || pathname.startsWith(child.path + '/')) {
          return group.key
        }
      }
    }
  }
  return null
}

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

interface SidebarProps {
  /** Forcer le mode collapsed (ex: fullscreen) / Force collapsed mode */
  forceCollapsed?: boolean
}

export function Sidebar({ forceCollapsed = false }: SidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isSuperadmin = useAuthStore((s) => s.user?.is_superadmin ?? false)
  const location = useLocation()

  /* En mode forceCollapsed, toujours collapsed / When forced, always collapsed */
  const isCollapsed = forceCollapsed || sidebarCollapsed

  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  /* Popover pour groupes en mode collapsed / Popover for groups in collapsed mode */
  const [popoverGroup, setPopoverGroup] = useState<string | null>(null)
  const [popoverY, setPopoverY] = useState(0)
  const popoverRef = useRef<HTMLDivElement>(null)

  /* Auto-détection du groupe actif au montage et à chaque changement de route */
  useEffect(() => {
    const groupKey = findGroupForPath(location.pathname)
    if (groupKey) {
      setActiveGroup(groupKey)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Fermer popover sur navigation ou clic en dehors / Close popover on nav or outside click */
  useEffect(() => {
    setPopoverGroup(null)
  }, [location.pathname])

  useEffect(() => {
    if (!popoverGroup) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverGroup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverGroup])

  /* Filtrage RBAC + superadmin / RBAC filtering + superadmin-only items */
  const canSeeItem = (child: NavItem) =>
    hasPermission(child.resource, 'read') && (!child.superadminOnly || isSuperadmin)

  const visibleGroups = navGroups.filter((group) => {
    if (group.children) {
      return group.children.some(canSeeItem)
    }
    return group.resource ? hasPermission(group.resource, 'read') : true
  })

  /* Groupe actuellement ouvert / Currently open group */
  const currentGroup = activeGroup ? navGroups.find((g) => g.key === activeGroup) : null
  const visibleChildren = currentGroup?.children?.filter(canSeeItem) ?? []

  /* Groupe popover visible / Popover group children */
  const popoverGroupObj = popoverGroup ? navGroups.find((g) => g.key === popoverGroup) : null
  const popoverChildren = popoverGroupObj?.children?.filter(canSeeItem) ?? []

  /* Gestion du clic sur un groupe L1 / Handle L1 group click */
  const handleGroupClick = (group: NavGroup, e: React.MouseEvent) => {
    if (group.path) {
      return // NavLink gère la navigation
    }
    if (group.children) {
      if (isCollapsed) {
        /* En mode collapsed : afficher popover / In collapsed mode: show popover */
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        setPopoverY(rect.top)
        setPopoverGroup(popoverGroup === group.key ? null : group.key)
      } else {
        setActiveGroup(group.key)
      }
    }
  }

  /* Navigation depuis le popover / Navigate from popover */
  const handlePopoverNav = (path: string) => {
    navigate(path)
    setPopoverGroup(null)
  }

  return (
    <aside
      className="h-screen flex flex-col border-r transition-all duration-300 shrink-0 relative"
      style={{
        width: isCollapsed ? '56px' : '240px',
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--border-color)',
      }}
    >
      {/* Logo + toggle */}
      <div className="p-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xl shrink-0">🔥</span>
          {!isCollapsed && (
            <span className="font-bold text-base whitespace-nowrap" style={{ color: 'var(--color-primary)' }}>
              Chaos Route
            </span>
          )}
        </div>
        {/* Masquer toggle en forceCollapsed / Hide toggle when forceCollapsed */}
        {!forceCollapsed && (
          <button
            onClick={toggleSidebar}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>
        )}
      </div>

      {/* Navigation glissante / Sliding navigation */}
      <nav className="flex-1 overflow-hidden relative">
        <div
          className="flex h-full"
          style={{
            width: '200%',
            transform: activeGroup && !isCollapsed ? 'translateX(-50%)' : 'translateX(0)',
            transition: 'transform 0.25s ease',
          }}
        >
          {/* Panel L1 — Liste des groupes / Group list */}
          <div className="w-1/2 overflow-y-auto p-1.5">
            {visibleGroups.map((group) =>
              group.path ? (
                /* Lien direct / Direct link */
                <NavLink
                  key={group.key}
                  to={group.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors ${
                      isActive ? 'font-semibold' : ''
                    }`
                  }
                  style={({ isActive }) => ({
                    backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                    color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                    justifyContent: isCollapsed ? 'center' : undefined,
                  })}
                  title={isCollapsed ? t(group.label) : undefined}
                >
                  <span className="text-base shrink-0">{group.icon}</span>
                  {!isCollapsed && <span className="truncate">{t(group.label)}</span>}
                </NavLink>
              ) : (
                /* Bouton de groupe / Group button */
                <button
                  key={group.key}
                  onClick={(e) => handleGroupClick(group, e)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors text-left"
                  style={{
                    backgroundColor: (activeGroup === group.key || popoverGroup === group.key) ? 'var(--bg-tertiary)' : 'transparent',
                    color: (activeGroup === group.key || popoverGroup === group.key) ? 'var(--color-primary)' : 'var(--text-secondary)',
                    justifyContent: isCollapsed ? 'center' : undefined,
                  }}
                  title={isCollapsed ? t(group.label) : undefined}
                >
                  <span className="text-base shrink-0">{group.icon}</span>
                  {!isCollapsed && (
                    <>
                      <span className="truncate flex-1">{t(group.label)}</span>
                      <span className="text-xs opacity-50 shrink-0">›</span>
                    </>
                  )}
                </button>
              )
            )}
          </div>

          {/* Panel L2 — Items du groupe actif / Active group items */}
          <div className="w-1/2 overflow-y-auto p-1.5">
            {currentGroup && (
              <>
                {/* Bouton retour + en-tête groupe / Back button + group header */}
                <button
                  onClick={() => setActiveGroup(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="text-base shrink-0">←</span>
                  <span className="truncate">{t('nav.back')}</span>
                </button>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 mb-1 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>{currentGroup.icon}</span>
                  <span className="truncate">{t(currentGroup.label)}</span>
                </div>
                {/* Items L2 */}
                {visibleChildren.map((item) => (
                  <NavItemLink key={item.path} item={item} collapsed={false} />
                ))}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Popover flottant pour groupes en mode collapsed / Floating popover for collapsed groups */}
      {popoverGroup && popoverChildren.length > 0 && (
        <div
          ref={popoverRef}
          className="fixed z-50 rounded-lg border shadow-xl py-1 min-w-[180px]"
          style={{
            left: '60px',
            top: `${popoverY}px`,
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {popoverGroupObj && t(popoverGroupObj.label)}
          </div>
          {popoverChildren.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => handlePopoverNav(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left hover:opacity-80"
                style={{
                  backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                }}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                <span className="truncate">{t(item.label)}</span>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
