/* Panel des volumes disponibles avec tri par proximité / Available volumes panel with proximity sorting */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Volume, PDV, DistanceEntry } from '../../types'

interface VolumePanelProps {
  volumes: Volume[]
  pdvs: PDV[]
  assignedPdvIds: Set<number>
  onAddVolume: (volume: Volume) => void
  vehicleCapacity: number
  currentEqp: number
  /* Pour le tri par proximité / For proximity sorting */
  lastStopPdvId: number | null
  baseId: number | null
  distanceIndex: Map<string, DistanceEntry>
}

export function VolumePanel({
  volumes, pdvs, assignedPdvIds, onAddVolume, vehicleCapacity, currentEqp,
  lastStopPdvId, baseId, distanceIndex,
}: VolumePanelProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])
  const remaining = vehicleCapacity - currentEqp

  /* Fonction lookup distance bidirectionnelle / Bidirectional distance lookup */
  const getDistanceKm = (fromType: string, fromId: number, toType: string, toId: number): number | null => {
    const d = distanceIndex.get(`${fromType}:${fromId}->${toType}:${toId}`)
      || distanceIndex.get(`${toType}:${toId}->${fromType}:${fromId}`)
    return d ? d.distance_km : null
  }

  /* Volumes triés par proximité au dernier stop + filtrés par recherche /
     Volumes sorted by proximity to last stop + filtered by search */
  const sortedVolumes = useMemo(() => {
    const needle = search.trim().toLowerCase()

    /* Filtrer par recherche / Filter by search */
    const filtered = needle
      ? volumes.filter((v) => {
          const pdv = pdvMap.get(v.pdv_id)
          if (!pdv) return false
          return pdv.code.toLowerCase().includes(needle)
            || pdv.name.toLowerCase().includes(needle)
            || (pdv.city?.toLowerCase().includes(needle) ?? false)
        })
      : volumes

    const unassigned = filtered.filter((v) => !assignedPdvIds.has(v.pdv_id))
    const assigned = filtered.filter((v) => assignedPdvIds.has(v.pdv_id))

    if (!lastStopPdvId && !baseId) return [...unassigned, ...assigned]

    const refType = lastStopPdvId ? 'PDV' : 'BASE'
    const refId = lastStopPdvId ?? baseId!

    const withDist = unassigned.map((v) => {
      const km = getDistanceKm(refType, refId, 'PDV', v.pdv_id)
      return { vol: v, km: km ?? 999999 }
    })
    withDist.sort((a, b) => a.km - b.km)

    return [...withDist.map((w) => w.vol), ...assigned]
  }, [volumes, assignedPdvIds, lastStopPdvId, baseId, distanceIndex, search, pdvMap])

  /* Distance affichée par volume / Displayed distance per volume */
  const getDisplayDistance = (pdvId: number): number | null => {
    if (!lastStopPdvId && !baseId) return null
    const refType = lastStopPdvId ? 'PDV' : 'BASE'
    const refId = lastStopPdvId ?? baseId!
    return getDistanceKm(refType, refId, 'PDV', pdvId)
  }

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('tourPlanning.availableVolumes')}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {volumes.filter((v) => !assignedPdvIds.has(v.pdv_id)).length}
          </span>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('tourPlanning.searchPdv')}
          className="w-full rounded-lg border px-3 py-1.5 text-xs"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '500px' }}>
        {sortedVolumes.map((vol) => {
          const pdv = pdvMap.get(vol.pdv_id)
          const assigned = assignedPdvIds.has(vol.pdv_id)
          const overCapacity = vol.eqp_count > remaining
          const dist = !assigned ? getDisplayDistance(vol.pdv_id) : null

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
                {dist != null && (
                  <span className="ml-auto font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {Math.round(dist * 10) / 10} km
                  </span>
                )}
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
