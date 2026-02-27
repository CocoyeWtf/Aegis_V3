/* Matrice de permissions / Permission matrix grid */

import { useTranslation } from 'react-i18next'

const RESOURCES = [
  'dashboard',
  'countries',
  'bases',
  'pdvs',
  'suppliers',
  'volumes',
  'contracts',
  'distances',
  'base-activities',
  'parameters',
  'tour-planning',
  'tour-history',
  'operations',
  'guard-post',
  'imports-exports',
  'users',
  'roles',
  'loaders',
  'devices',
  'tracking',
  'support-types',
  'pickup-requests',
  'aide-decision',
  'surcharges',
  'surcharge-types',
]

const ACTIONS = ['read', 'create', 'update', 'delete'] as const

interface PermissionEntry {
  resource: string
  action: string
}

interface PermissionMatrixProps {
  value: PermissionEntry[]
  onChange: (permissions: PermissionEntry[]) => void
}

/* Clés i18n pour les noms de resources / i18n keys for resource names */
const RESOURCE_I18N: Record<string, string> = {
  'dashboard': 'nav.dashboard',
  'countries': 'nav.countries',
  'bases': 'nav.bases',
  'pdvs': 'nav.pdvs',
  'suppliers': 'nav.suppliers',
  'volumes': 'nav.volumes',
  'contracts': 'nav.contracts',
  'distances': 'nav.distances',
  'base-activities': 'nav.baseActivities',
  'parameters': 'nav.parameters',
  'tour-planning': 'nav.tourPlanning',
  'tour-history': 'nav.tourHistory',
  'operations': 'nav.operations',
  'guard-post': 'nav.guardPost',
  'imports-exports': 'nav.importsExports',
  'users': 'nav.users',
  'roles': 'nav.roles',
  'loaders': 'Chargeurs',
  'devices': 'Appareils',
  'tracking': 'Suivi chauffeurs',
  'support-types': 'Types de support',
  'pickup-requests': 'Demandes de reprise',
  'aide-decision': 'Aide à la décision',
  'surcharges': 'Surcharges',
  'surcharge-types': 'Types de surcharge',
}

export function PermissionMatrix({ value, onChange }: PermissionMatrixProps) {
  const { t } = useTranslation()

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

  const toggleCol = (action: string) => {
    const allChecked = RESOURCES.every((r) => has(r, action))
    if (allChecked) {
      onChange(value.filter((p) => p.action !== action))
    } else {
      const without = value.filter((p) => p.action !== action)
      const added = RESOURCES.map((r) => ({ resource: r, action }))
      onChange([...without, ...added])
    }
  }

  const toggleAll = () => {
    const total = RESOURCES.length * ACTIONS.length
    if (value.length >= total) {
      onChange([])
    } else {
      const all: PermissionEntry[] = []
      RESOURCES.forEach((r) => ACTIONS.forEach((a) => all.push({ resource: r, action: a })))
      onChange(all)
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th
              className="text-left px-3 py-2 font-medium"
              style={{ color: 'var(--text-muted)' }}
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
              <th key={action} className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>
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
          {RESOURCES.map((resource) => (
            <tr
              key={resource}
              className="border-t"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleRow(resource)}
                  className="text-xs hover:underline text-left"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t(RESOURCE_I18N[resource] || resource)}
                </button>
              </td>
              {ACTIONS.map((action) => {
                const checked = has(resource, action)
                return (
                  <td key={action} className="px-3 py-2 text-center">
                    <label
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition-all border ${checked ? 'border-orange-500' : ''}`}
                      style={{
                        backgroundColor: checked ? 'rgba(249,115,22,0.15)' : 'var(--bg-tertiary)',
                        borderColor: checked ? 'var(--color-primary)' : 'var(--border-color)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(resource, action)}
                        className="sr-only"
                      />
                      {checked && (
                        <span style={{ color: 'var(--color-primary)' }} className="text-sm font-bold">✓</span>
                      )}
                    </label>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
