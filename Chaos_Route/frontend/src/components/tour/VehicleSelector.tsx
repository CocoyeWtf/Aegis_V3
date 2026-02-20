/* Sélecteur de type de véhicule (phase construction) / Vehicle type selector (construction phase) */

import type { VehicleType } from '../../types'
import { VEHICLE_TYPE_DEFAULTS } from '../../types'

interface VehicleSelectorProps {
  selectedType: VehicleType | null
  onSelect: (type: VehicleType, capacityEqp: number) => void
}

const VEHICLE_TYPES = Object.keys(VEHICLE_TYPE_DEFAULTS) as VehicleType[]

export function VehicleSelector({ selectedType, onSelect }: VehicleSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {VEHICLE_TYPES.map((vt) => {
        const info = VEHICLE_TYPE_DEFAULTS[vt]
        const selected = vt === selectedType
        return (
          <button
            key={vt}
            className={`rounded-lg px-4 py-2.5 border text-sm font-medium transition-all hover:scale-[1.02] ${selected ? 'ring-2 ring-[var(--color-primary)]' : ''}`}
            style={{
              borderColor: selected ? 'var(--color-primary)' : 'var(--border-color)',
              backgroundColor: selected ? 'rgba(249,115,22,0.08)' : 'var(--bg-primary)',
              color: selected ? 'var(--color-primary)' : 'var(--text-primary)',
            }}
            onClick={() => onSelect(vt, info.capacity_eqp)}
          >
            <span className="block font-semibold">{info.label}</span>
            <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {info.capacity_eqp} EQC
            </span>
          </button>
        )
      })}
    </div>
  )
}
