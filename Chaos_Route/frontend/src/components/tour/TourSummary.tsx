/* Résumé du tour en cours avec drag & drop / Current tour summary panel with DnD reordering */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TourStop, PDV, VehicleType } from '../../types'
import { VEHICLE_TYPE_DEFAULTS } from '../../types'
import type { StopTimeline } from '../../utils/tourTimeUtils'
import { formatDuration } from '../../utils/tourTimeUtils'

interface TourSummaryProps {
  stops: TourStop[]
  pdvs: PDV[]
  vehicleType: VehicleType | null
  capacityEqp: number
  totalEqp: number
  totalKm: number
  totalCost: number
  onRemoveStop: (pdvId: number) => void
  onReorderStops: (stops: TourStop[]) => void
  stopTimelines?: StopTimeline[]
  returnTime?: string
  departureTime?: string
  totalDurationMinutes?: number
}

/* Ligne d'arrêt glissable / Sortable stop row */
function SortableStopRow({
  stop,
  idx,
  pdv,
  timeline,
  onRemove,
  t,
}: {
  stop: TourStop
  idx: number
  pdv: PDV | undefined
  timeline: StopTimeline | undefined
  onRemove: (pdvId: number) => void
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `stop-${stop.pdv_id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderColor: isDragging ? 'var(--color-primary)' : 'var(--border-color)',
    backgroundColor: isDragging ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg p-3 mb-2 border group"
    >
      <div className="flex items-center gap-3">
        {/* Poignée de drag / Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-sm shrink-0 select-none"
          style={{ color: 'var(--text-muted)' }}
          title="Drag"
        >
          ⠿
        </div>

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
          </div>
        </div>

        {/* Bouton supprimer / Remove button */}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded"
          style={{ color: 'var(--color-danger)', backgroundColor: 'rgba(239,68,68,0.1)' }}
          onClick={() => onRemove(stop.pdv_id)}
          title={t('common.delete')}
        >
          ✕
        </button>
      </div>

      {/* Timeline du stop / Stop timeline details */}
      {timeline && (
        <div className="mt-2 ml-10 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <div>
            <span style={{ color: 'var(--color-primary)' }}>{t('tourPlanning.arrivalAt')}:</span>{' '}
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{timeline.arrival_time}</span>
          </div>
          <div>
            <span style={{ color: 'var(--color-primary)' }}>{t('tourPlanning.departureAt')}:</span>{' '}
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{timeline.departure_time}</span>
          </div>
          <div>
            {t('tourPlanning.travelTime')}: {timeline.travel_minutes}min ({timeline.distance_km}km)
          </div>
          <div>
            {t('tourPlanning.unloadTime')}: {timeline.unload_minutes}min
          </div>
        </div>
      )}
    </div>
  )
}

export function TourSummary({
  stops, pdvs, vehicleType, capacityEqp, totalEqp, totalKm, totalCost, onRemoveStop, onReorderStops,
  stopTimelines = [], returnTime, departureTime, totalDurationMinutes = 0,
}: TourSummaryProps) {
  const { t } = useTranslation()
  const pdvMap = new Map(pdvs.map((p) => [p.id, p]))
  const timelineMap = new Map(stopTimelines.map((st) => [st.pdv_id, st]))

  const capacityPct = capacityEqp > 0 ? Math.round((totalEqp / capacityEqp) * 100) : 0
  const capacityColor =
    capacityPct > 100 ? 'var(--color-danger)' : capacityPct > 80 ? 'var(--color-warning)' : 'var(--color-success)'

  const vehicleLabel = vehicleType ? VEHICLE_TYPE_DEFAULTS[vehicleType]?.label ?? vehicleType : '—'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortableIds = stops.map((s) => `stop-${s.pdv_id}`)

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortableIds.indexOf(active.id as string)
    const newIndex = sortableIds.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove([...stops], oldIndex, newIndex).map((s, i) => ({
      ...s,
      sequence_order: i + 1,
    }))
    onReorderStops(reordered)
  }, [stops, sortableIds, onReorderStops])

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
            {vehicleType && (
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-primary)' }}>
                {vehicleLabel}
              </span>
            )}
          </h3>
          <span className="text-xs font-bold" style={{ color: capacityColor }}>
            {totalEqp} / {capacityEqp > 0 ? capacityEqp : '—'} EQP ({capacityPct}%)
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

      {/* Heure de départ / Departure time */}
      {departureTime && stops.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
          >
            B
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('tourPlanning.departureTime')}: {departureTime}
          </span>
        </div>
      )}

      {/* Liste des arrêts avec DnD / Stops list with drag and drop */}
      <div className="flex-1 overflow-y-auto p-2">
        {stops.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.addVolumesHint')}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {stops.map((stop, idx) => (
                <SortableStopRow
                  key={stop.pdv_id}
                  stop={stop}
                  idx={idx}
                  pdv={pdvMap.get(stop.pdv_id)}
                  timeline={timelineMap.get(stop.pdv_id)}
                  onRemove={onRemoveStop}
                  t={t}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Retour base / Return to base */}
      {returnTime && stops.length > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
            style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
          >
            B
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('tourPlanning.returnBase')}: {returnTime}
          </span>
          {totalDurationMinutes > 0 && (
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {t('tourPlanning.totalDuration')}: {formatDuration(totalDurationMinutes)}
            </span>
          )}
        </div>
      )}

      {/* Résumé bas / Bottom summary */}
      {stops.length > 0 && (
        <div className="px-4 py-3 border-t text-xs grid grid-cols-5 gap-2" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
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
              {capacityEqp > 0 ? `${Math.round((totalEqp / capacityEqp) * 100)}%` : '—'}
            </span>
            {t('tourPlanning.fillRate')}
          </div>
          <div>
            <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>
              {totalKm > 0 ? `${totalKm}` : '—'}
            </span>
            km
          </div>
          <div>
            <span className="block font-semibold" style={{ color: 'var(--text-primary)' }}>
              {totalCost > 0 ? `~${totalCost}€` : '—'}
            </span>
            {t('tourHistory.cost')}
          </div>
        </div>
      )}
    </div>
  )
}
