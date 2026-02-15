/* Sélecteur de véhicule pour un tour / Vehicle selector for tour creation */

import { useTranslation } from 'react-i18next'
import type { Vehicle } from '../../types'

interface VehicleSelectorProps {
  vehicles: Vehicle[]
  selectedVehicleId: number | null
  onSelect: (vehicle: Vehicle) => void
}

export function VehicleSelector({ vehicles, selectedVehicleId, onSelect }: VehicleSelectorProps) {
  const { t } = useTranslation()

  if (vehicles.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        {t('tourPlanning.noVehicles')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {vehicles.map((v) => {
        const selected = v.id === selectedVehicleId
        return (
          <div
            key={v.id}
            className={`rounded-lg p-3 border cursor-pointer transition-all hover:scale-[1.01] ${selected ? 'ring-2' : ''}`}
            style={{
              borderColor: selected ? 'var(--color-primary)' : 'var(--border-color)',
              backgroundColor: selected ? 'rgba(249,115,22,0.08)' : 'var(--bg-primary)',
              ringColor: 'var(--color-primary)',
            }}
            onClick={() => onSelect(v)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {v.code} — {v.name}
              </span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'var(--color-primary)' }}
              >
                {v.capacity_eqp} EQP
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{v.temperature_type}</span>
              <span>{v.vehicle_type}</span>
              {v.capacity_weight_kg && <span>{v.capacity_weight_kg} kg</span>}
              {v.has_tailgate && <span>🔽 {t('vehicles.hasTailgate')}</span>}
            </div>
            {v.fixed_cost != null && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('vehicles.fixedCost')}: {v.fixed_cost}€ | {t('vehicles.costPerKm')}: {v.cost_per_km ?? 0}€
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
