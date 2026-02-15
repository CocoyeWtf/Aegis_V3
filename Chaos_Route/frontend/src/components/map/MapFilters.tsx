/* Filtres de la carte / Map filter checkboxes */

import { useTranslation } from 'react-i18next'
import { useMapStore } from '../../stores/useMapStore'

export function MapFilters() {
  const { t } = useTranslation()
  const { showBases, showPdvs, showSuppliers, showRoutes, toggleLayer } = useMapStore()

  const filters = [
    { key: 'showBases' as const, label: t('nav.bases'), checked: showBases, color: '#f97316' },
    { key: 'showPdvs' as const, label: t('nav.pdvs'), checked: showPdvs, color: '#22c55e' },
    { key: 'showSuppliers' as const, label: t('nav.suppliers'), checked: showSuppliers, color: '#8b5cf6' },
    { key: 'showRoutes' as const, label: 'Routes', checked: showRoutes, color: '#ef4444' },
  ]

  return (
    <div
      className="absolute top-3 right-3 z-[1000] rounded-lg p-3 shadow-lg"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', border: '1px solid var(--border-color)' }}
    >
      {filters.map((f) => (
        <label key={f.key} className="flex items-center gap-2 cursor-pointer mb-1 last:mb-0">
          <input
            type="checkbox"
            checked={f.checked}
            onChange={() => toggleLayer(f.key)}
            className="w-3.5 h-3.5 rounded accent-orange-500"
          />
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: f.color }}
          />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
        </label>
      ))}
    </div>
  )
}
