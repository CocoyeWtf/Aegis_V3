/* Panel des PDVs avec reprises en attente / PDVs with pending pickup requests panel */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PDV, DistanceEntry, PdvPickupSummary } from '../../types'

/* Labels courts par type de reprise / Short labels per pickup type */
const PICKUP_TYPE_SHORT: Record<string, string> = {
  CONTAINER: 'Contenants',
  CARDBOARD: 'Cartons',
  MERCHANDISE: 'Marchandise',
  CONSIGNMENT: 'Consignes',
}

/* Lettre badge par type / Badge letter per type */
const PICKUP_TYPE_LETTER: Record<string, string> = {
  CONTAINER: 'C',
  CARDBOARD: 'B',
  MERCHANDISE: 'M',
  CONSIGNMENT: 'K',
}

interface PickupPanelProps {
  pickupSummaries: PdvPickupSummary[]
  pdvs: PDV[]
  assignedPdvIds: Set<number>
  onAddPdv: (pdvId: number) => void
  lastStopPdvId: number | null
  baseId: number | null
  distanceIndex: Map<string, DistanceEntry>
}

export function PickupPanel({
  pickupSummaries, pdvs, assignedPdvIds, onAddPdv,
  lastStopPdvId, baseId, distanceIndex,
}: PickupPanelProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])

  /* Lookup distance bidirectionnel / Bidirectional distance lookup */
  const getDistanceKm = (fromType: string, fromId: number, toType: string, toId: number): number | null => {
    const d = distanceIndex.get(`${fromType}:${fromId}->${toType}:${toId}`)
      || distanceIndex.get(`${toType}:${toId}->${fromType}:${fromId}`)
    return d ? d.distance_km : null
  }

  /* Distance affichee par PDV / Displayed distance per PDV */
  const getDisplayDistance = (pdvId: number): number | null => {
    if (!lastStopPdvId && !baseId) return null
    const refType = lastStopPdvId ? 'PDV' : 'BASE'
    const refId = lastStopPdvId ?? baseId!
    return getDistanceKm(refType, refId, 'PDV', pdvId)
  }

  /* PDVs tries par proximite + filtres par recherche / Sorted by proximity + filtered by search */
  const sortedSummaries = useMemo(() => {
    const needle = search.trim().toLowerCase()

    let filtered = pickupSummaries.filter((s) => s.pending_count > 0)

    if (needle) {
      filtered = filtered.filter((s) => {
        const pdv = pdvMap.get(s.pdv_id)
        if (!pdv) return false
        return pdv.code.toLowerCase().includes(needle)
          || pdv.name.toLowerCase().includes(needle)
          || (pdv.city?.toLowerCase().includes(needle) ?? false)
      })
    }

    const assigned = filtered.filter((s) => assignedPdvIds.has(s.pdv_id))
    const available = filtered.filter((s) => !assignedPdvIds.has(s.pdv_id))

    if (!lastStopPdvId && !baseId) return [...available, ...assigned]

    const refType = lastStopPdvId ? 'PDV' : 'BASE'
    const refId = lastStopPdvId ?? baseId!

    const withDist = available.map((s) => {
      const km = getDistanceKm(refType, refId, 'PDV', s.pdv_id)
      return { summary: s, km: km ?? 999999 }
    })
    withDist.sort((a, b) => a.km - b.km)

    return [...withDist.map((w) => w.summary), ...assigned]
  }, [pickupSummaries, assignedPdvIds, lastStopPdvId, baseId, distanceIndex, search, pdvMap])

  const availableCount = pickupSummaries.filter((s) => s.pending_count > 0 && !assignedPdvIds.has(s.pdv_id)).length

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            PDVs a reprendre
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {availableCount}
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

      <div className="flex-1 overflow-y-auto p-2">
        {sortedSummaries.map((summary) => {
          const pdv = pdvMap.get(summary.pdv_id)
          const isAssigned = assignedPdvIds.has(summary.pdv_id)
          const dist = !isAssigned ? getDisplayDistance(summary.pdv_id) : null

          return (
            <div
              key={summary.pdv_id}
              className={`rounded-lg p-3 mb-2 border transition-all ${isAssigned ? 'opacity-40' : 'cursor-pointer hover:scale-[1.01]'}`}
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: isAssigned ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                borderLeftWidth: '4px',
                borderLeftColor: '#f59e0b',
              }}
              onClick={() => !isAssigned && onAddPdv(summary.pdv_id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium" style={{ color: isAssigned ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {pdv ? `${pdv.code} — ${pdv.name}` : `PDV #${summary.pdv_id}`}
                </span>
                <span className="inline-flex gap-0.5">
                  {summary.requests.map((r) => (
                    <span
                      key={r.id}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: '#f59e0b', color: '#000' }}
                      title={`${PICKUP_TYPE_SHORT[r.pickup_type]}: ${r.quantity}`}
                    >
                      {PICKUP_TYPE_LETTER[r.pickup_type]}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                {pdv?.city && <span>{pdv.city}</span>}
                <span>{summary.pending_count} etiquette{summary.pending_count > 1 ? 's' : ''} pending</span>
                {dist != null && (
                  <span className="ml-auto font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {Math.round(dist * 10) / 10} km
                  </span>
                )}
              </div>
              {isAssigned && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>✓ {t('tourPlanning.assigned')}</div>
              )}
            </div>
          )
        })}

        {sortedSummaries.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            Aucune reprise en attente
          </p>
        )}
      </div>
    </div>
  )
}
