/* Résumé du tour en cours / Current tour summary panel */

import { useTranslation } from 'react-i18next'
import type { TourStop, PDV, Vehicle } from '../../types'

interface TourSummaryProps {
  stops: TourStop[]
  pdvs: PDV[]
  vehicle: Vehicle | null
  totalEqp: number
  onRemoveStop: (pdvId: number) => void
  onReorderStops: (stops: TourStop[]) => void
}

export function TourSummary({ stops, pdvs, vehicle, totalEqp, onRemoveStop }: TourSummaryProps) {
  const { t } = useTranslation()
  const pdvMap = new Map(pdvs.map((p) => [p.id, p]))

  const capacityPct = vehicle ? Math.round((totalEqp / vehicle.capacity_eqp) * 100) : 0
  const capacityColor =
    capacityPct > 100 ? 'var(--color-danger)' : capacityPct > 80 ? 'var(--color-warning)' : 'var(--color-success)'

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      {/* En-tête avec jauge capacité / Header with capacity gauge */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('tourPlanning.currentTour')}
          </h3>
          <span className="text-xs font-bold" style={{ color: capacityColor }}>
            {totalEqp} / {vehicle?.capacity_eqp ?? '—'} EQP ({capacityPct}%)
          </span>
        </div>
        {/* Barre de progression / Progress bar */}
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(capacityPct, 100)}%`, backgroundColor: capacityColor }}
          />
        </div>
      </div>

      {/* Liste des arrêts / Stops list */}
      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: '400px' }}>
        {stops.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.addVolumesHint')}
          </p>
        ) : (
          stops.map((stop, idx) => {
            const pdv = pdvMap.get(stop.pdv_id)
            return (
              <div
                key={stop.pdv_id}
                className="rounded-lg p-3 mb-2 border flex items-center gap-3 group"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              >
                {/* Numéro de séquence / Sequence number */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {pdv ? `${pdv.code} — ${pdv.name}` : `PDV #${stop.pdv_id}`}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {pdv?.city && <span>{pdv.city}</span>}
                    <span>{stop.eqp_count} EQP</span>
                    {stop.arrival_time && <span>↦ {stop.arrival_time}</span>}
                  </div>
                </div>

                {/* Bouton supprimer / Remove button */}
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--color-danger)', backgroundColor: 'rgba(239,68,68,0.1)' }}
                  onClick={() => onRemoveStop(stop.pdv_id)}
                  title={t('common.delete')}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Résumé bas / Bottom summary */}
      {stops.length > 0 && (
        <div className="px-4 py-3 border-t text-xs grid grid-cols-3 gap-2" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          <div>
            <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>{stops.length}</span>
            {t('tourPlanning.stops')}
          </div>
          <div>
            <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>{totalEqp}</span>
            EQP
          </div>
          <div>
            <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>
              {vehicle ? `${Math.round((totalEqp / vehicle.capacity_eqp) * 100)}%` : '—'}
            </span>
            {t('tourPlanning.fillRate')}
          </div>
        </div>
      )}
    </div>
  )
}
