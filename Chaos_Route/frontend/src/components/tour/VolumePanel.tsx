/* Panel des volumes disponibles / Available volumes panel (right side) */

import { useTranslation } from 'react-i18next'
import type { Volume, PDV } from '../../types'

interface VolumePanelProps {
  volumes: Volume[]
  pdvs: PDV[]
  assignedPdvIds: Set<number>
  onAddVolume: (volume: Volume) => void
  vehicleCapacity: number
  currentEqp: number
}

export function VolumePanel({ volumes, pdvs, assignedPdvIds, onAddVolume, vehicleCapacity, currentEqp }: VolumePanelProps) {
  const { t } = useTranslation()

  const pdvMap = new Map(pdvs.map((p) => [p.id, p]))
  const remaining = vehicleCapacity - currentEqp

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('tourPlanning.availableVolumes')}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
          {volumes.filter((v) => !assignedPdvIds.has(v.pdv_id)).length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '500px' }}>
        {volumes.map((vol) => {
          const pdv = pdvMap.get(vol.pdv_id)
          const assigned = assignedPdvIds.has(vol.pdv_id)
          const overCapacity = vol.eqp_count > remaining

          return (
            <div
              key={vol.id}
              className={`rounded-lg p-3 mb-2 border transition-all ${assigned ? 'opacity-40' : 'cursor-pointer hover:scale-[1.01]'}`}
              style={{
                borderColor: assigned ? 'var(--border-color)' : overCapacity ? 'var(--color-danger)' : 'var(--border-color)',
                backgroundColor: assigned ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
              }}
              onClick={() => !assigned && onAddVolume(vol)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: assigned ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {pdv ? `${pdv.code} — ${pdv.name}` : `PDV #${vol.pdv_id}`}
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: overCapacity && !assigned ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
                    color: overCapacity && !assigned ? 'var(--color-danger)' : 'var(--color-primary)',
                  }}
                >
                  {vol.eqp_count} EQP
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {pdv?.city && <span>{pdv.city}</span>}
                <span>{vol.temperature_class}</span>
                {vol.weight_kg && <span>{vol.weight_kg} kg</span>}
              </div>
              {assigned && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>✓ {t('tourPlanning.assigned')}</div>
              )}
            </div>
          )
        })}

        {volumes.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {t('common.noData')}
          </p>
        )}
      </div>
    </div>
  )
}
