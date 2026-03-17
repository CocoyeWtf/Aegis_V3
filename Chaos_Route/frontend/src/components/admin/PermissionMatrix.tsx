/* Matrice de permissions par menu/sous-menu / Permission matrix grid organized by menu sections */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/* Structure menu/sous-menu identique au Sidebar / Menu structure matching Sidebar */
interface ResourceGroup {
  key: string
  label: string
  icon: string
  resources: { resource: string; label: string }[]
}

const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    key: 'dashboard', label: 'Tableau de bord', icon: '📊',
    resources: [
      { resource: 'dashboard', label: 'Tableau de bord' },
    ],
  },
  {
    key: 'database', label: 'Base de donnees', icon: '🗄️',
    resources: [
      { resource: 'countries', label: 'Pays / Regions' },
      { resource: 'pdvs', label: 'Points de vente' },
      { resource: 'base-activities', label: 'Activites base' },
      { resource: 'bases', label: 'Bases logistiques' },
      { resource: 'loaders', label: 'Chargeurs' },
      { resource: 'support-types', label: 'Types de support' },
      { resource: 'surcharge-types', label: 'Types de surcharge' },
      { resource: 'distances', label: 'Distancier / Taxe km' },
      { resource: 'devices', label: 'Appareils mobiles' },
      { resource: 'carriers', label: 'Transporteurs' },
      { resource: 'suppliers', label: 'Fournisseurs' },
    ],
  },
  {
    key: 'transport', label: 'Transport', icon: '🚛',
    resources: [
      { resource: 'contracts', label: 'Contrats' },
      { resource: 'volumes', label: 'Volumes' },
      { resource: 'tour-planning', label: 'Planning tournees' },
      { resource: 'tour-history', label: 'Historique / Synthese transport' },
      { resource: 'aide-decision', label: 'Aide a la decision' },
      { resource: 'surcharges', label: 'Surcharges' },
    ],
  },
  {
    key: 'baseOps', label: 'Operations base', icon: '🏭',
    resources: [
      { resource: 'operations', label: 'Operations (postier)' },
      { resource: 'tracking', label: 'Suivi chauffeurs' },
      { resource: 'pickup-requests', label: 'Reprises / Reception base' },
      { resource: 'declarations', label: 'Declarations chauffeur' },
      { resource: 'consignment-movements', label: 'Suivi consignes' },
      { resource: 'waybill-archives', label: 'Registre CMR' },
      { resource: 'base-container-stock', label: 'Stock contenants base' },
    ],
  },
  {
    key: 'pdvOps', label: 'PDV', icon: '🏪',
    resources: [
      { resource: 'pdv-stock', label: 'Stock contenants PDV' },
    ],
  },
  {
    key: 'fleet', label: 'Flotte', icon: '🚚',
    resources: [
      { resource: 'vehicles', label: 'Vehicules' },
      { resource: 'inspections', label: 'Inspections' },
      { resource: 'fleet', label: 'Maintenance / Couts' },
    ],
  },
  {
    key: 'reports', label: 'Rapports', icon: '📈',
    resources: [
      { resource: 'reports', label: 'Tous les rapports' },
    ],
  },
  {
    key: 'guardPost', label: 'Poste de garde', icon: '🚧',
    resources: [
      { resource: 'guard-post', label: 'Poste de garde' },
    ],
  },
  {
    key: 'admin', label: 'Administration', icon: '⚙️',
    resources: [
      { resource: 'users', label: 'Utilisateurs' },
      { resource: 'roles', label: 'Roles' },
      { resource: 'parameters', label: 'Parametres / Prix carburant / Audit' },
      { resource: 'imports-exports', label: 'Imports / Exports' },
    ],
  },
]

/* Liste plate pour les toggles globaux / Flat list for global toggles */
const ALL_RESOURCES = RESOURCE_GROUPS.flatMap((g) => g.resources.map((r) => r.resource))

const ACTIONS = ['read', 'create', 'update', 'delete'] as const

interface PermissionEntry {
  resource: string
  action: string
}

interface PermissionMatrixProps {
  value: PermissionEntry[]
  onChange: (permissions: PermissionEntry[]) => void
}

export function PermissionMatrix({ value, onChange }: PermissionMatrixProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const has = (resource: string, action: string) =>
    value.some((p) => p.resource === resource && p.action === action)

  const toggle = (resource: string, action: string) => {
    if (has(resource, action)) {
      onChange(value.filter((p) => !(p.resource === resource && p.action === action)))
    } else {
      onChange([...value, { resource, action }])
    }
  }

  const toggleRow = (resource: string) => {
    const allChecked = ACTIONS.every((a) => has(resource, a))
    if (allChecked) {
      onChange(value.filter((p) => p.resource !== resource))
    } else {
      const without = value.filter((p) => p.resource !== resource)
      const added = ACTIONS.map((a) => ({ resource, action: a }))
      onChange([...without, ...added])
    }
  }

  /* Toggle toutes les resources d'un groupe / Toggle all resources in a group */
  const toggleGroup = (group: ResourceGroup) => {
    const groupResources = group.resources.map((r) => r.resource)
    const allChecked = groupResources.every((r) => ACTIONS.every((a) => has(r, a)))
    if (allChecked) {
      onChange(value.filter((p) => !groupResources.includes(p.resource)))
    } else {
      const without = value.filter((p) => !groupResources.includes(p.resource))
      const added: PermissionEntry[] = []
      groupResources.forEach((r) => ACTIONS.forEach((a) => added.push({ resource: r, action: a })))
      onChange([...without, ...added])
    }
  }

  const toggleCol = (action: string) => {
    const allChecked = ALL_RESOURCES.every((r) => has(r, action))
    if (allChecked) {
      onChange(value.filter((p) => p.action !== action))
    } else {
      const without = value.filter((p) => p.action !== action)
      const added = ALL_RESOURCES.map((r) => ({ resource: r, action }))
      onChange([...without, ...added])
    }
  }

  const toggleAll = () => {
    const total = ALL_RESOURCES.length * ACTIONS.length
    if (value.length >= total) {
      onChange([])
    } else {
      const all: PermissionEntry[] = []
      ALL_RESOURCES.forEach((r) => ACTIONS.forEach((a) => all.push({ resource: r, action: a })))
      onChange(all)
    }
  }

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /* Compter les permissions actives d'un groupe / Count active permissions in a group */
  const groupCount = (group: ResourceGroup) => {
    const total = group.resources.length * ACTIONS.length
    let active = 0
    for (const r of group.resources) {
      for (const a of ACTIONS) {
        if (has(r.resource, a)) active++
      }
    }
    return { active, total }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th
              className="text-left px-3 py-2 font-medium"
              style={{ color: 'var(--text-muted)', width: '280px' }}
            >
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs underline"
                style={{ color: 'var(--color-primary)' }}
              >
                {t('admin.roles.toggleAll')}
              </button>
            </th>
            {ACTIONS.map((action) => (
              <th key={action} className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)', width: '70px' }}>
                <button
                  type="button"
                  onClick={() => toggleCol(action)}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t(`admin.roles.action_${action}`)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCE_GROUPS.map((group) => {
            const isCollapsed = collapsed.has(group.key)
            const { active, total } = groupCount(group)
            const allGroupChecked = active === total
            return (
              <tbody key={group.key}>
                {/* En-tete de groupe / Group header */}
                <tr
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderTop: '2px solid var(--border-color)',
                  }}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCollapse(group.key)}
                        className="text-xs"
                        style={{ color: 'var(--text-muted)', width: '16px' }}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="font-semibold text-xs hover:underline flex items-center gap-1.5"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span>{group.icon}</span>
                        <span>{group.label}</span>
                      </button>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: allGroupChecked
                            ? 'rgba(34,197,94,0.15)'
                            : active > 0
                              ? 'rgba(249,115,22,0.15)'
                              : 'var(--bg-tertiary)',
                          color: allGroupChecked
                            ? '#22c55e'
                            : active > 0
                              ? 'var(--color-primary)'
                              : 'var(--text-muted)',
                        }}
                      >
                        {active}/{total}
                      </span>
                    </div>
                  </td>
                  {ACTIONS.map((action) => {
                    const colChecked = group.resources.every((r) => has(r.resource, action))
                    return (
                      <td key={action} className="px-3 py-2 text-center">
                        <label
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition-all border ${colChecked ? 'border-orange-500' : ''}`}
                          style={{
                            backgroundColor: colChecked ? 'rgba(249,115,22,0.15)' : 'var(--bg-tertiary)',
                            borderColor: colChecked ? 'var(--color-primary)' : 'var(--border-color)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={colChecked}
                            onChange={() => {
                              const resources = group.resources.map((r) => r.resource)
                              if (colChecked) {
                                onChange(value.filter((p) => !(resources.includes(p.resource) && p.action === action)))
                              } else {
                                const without = value.filter((p) => !(resources.includes(p.resource) && p.action === action))
                                const added = resources.map((r) => ({ resource: r, action }))
                                onChange([...without, ...added])
                              }
                            }}
                            className="sr-only"
                          />
                          {colChecked && (
                            <span style={{ color: 'var(--color-primary)' }} className="text-sm font-bold">✓</span>
                          )}
                        </label>
                      </td>
                    )
                  })}
                </tr>
                {/* Sous-elements / Sub-items */}
                {!isCollapsed && group.resources.map((item) => (
                  <tr
                    key={item.resource}
                    className="border-t"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <td className="pl-10 pr-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleRow(item.resource)}
                        className="text-xs hover:underline text-left"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {item.label}
                      </button>
                    </td>
                    {ACTIONS.map((action) => {
                      const checked = has(item.resource, action)
                      return (
                        <td key={action} className="px-3 py-1.5 text-center">
                          <label
                            className={`inline-flex items-center justify-center w-6 h-6 rounded cursor-pointer transition-all border ${checked ? 'border-orange-500' : ''}`}
                            style={{
                              backgroundColor: checked ? 'rgba(249,115,22,0.15)' : 'var(--bg-tertiary)',
                              borderColor: checked ? 'var(--color-primary)' : 'var(--border-color)',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(item.resource, action)}
                              className="sr-only"
                            />
                            {checked && (
                              <span style={{ color: 'var(--color-primary)' }} className="text-xs font-bold">✓</span>
                            )}
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
