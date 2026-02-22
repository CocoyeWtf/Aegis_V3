/* Gantt interactif 3 jours par contrat / Interactive 3-day Gantt chart per contract */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface GanttTour {
  tour_id: number
  code: string
  contract_id: number | null
  vehicle_type: string | null
  capacity_eqp: number | null
  contract_code: string | null
  vehicle_code: string | null
  vehicle_name: string | null
  transporter_name: string | null
  departure_time: string | null
  return_time: string | null
  total_eqp: number | null
  total_km: number | null
  total_cost: number | null
  total_duration_minutes: number | null
  delivery_date: string | null
  tour_date: string
  status: string
  stops: { id: number; pdv_id: number; sequence_order: number; eqp_count: number; arrival_time: string | null; departure_time: string | null }[]
}

interface TourGanttProps {
  tours: GanttTour[]
  selectedDate: string
  highlightedTourId: number | null
  onTourClick: (tourId: number) => void
  warningTourIds?: Set<number>
}

const LABEL_WIDTH = 100
const VISIBLE_HOURS = 12
const TOTAL_DAYS = 3
const TOTAL_HOURS = TOTAL_DAYS * 24
const MAX_CONTRACT_DAILY_MINUTES = 600

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'rgba(249,115,22,0.7)',
  VALIDATED: 'rgba(34,197,94,0.7)',
  IN_PROGRESS: 'rgba(59,130,246,0.7)',
  RETURNING: 'rgba(59,130,246,0.7)',
  COMPLETED: 'rgba(107,114,128,0.6)',
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function TourGantt({ tours, selectedDate, highlightedTourId, onTourClick, warningTourIds }: TourGanttProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  /* Mesurer la largeur du conteneur / Measure container width */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const obs = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const pxPerHour = containerWidth > 0 ? Math.max(40, (containerWidth - LABEL_WIDTH) / VISIBLE_HOURS) : 60
  const timelineWidth = pxPerHour * TOTAL_HOURS
  const totalWidth = LABEL_WIDTH + timelineWidth

  /* 3 jours: J, J+1, J+2 / 3 days from dispatch date */
  const days = useMemo(() => {
    const base = new Date(selectedDate + 'T00:00:00')
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }, [selectedDate])

  /* Scroll initial à 05:00 du jour J / Auto-scroll to 05:00 of day J */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pxH = Math.max(40, (el.clientWidth - LABEL_WIDTH) / VISIBLE_HOURS)
    el.scrollLeft = 5 * pxH
  }, [selectedDate])

  /* Regrouper par contrat (tours planifiés) / Group by contract (scheduled only) */
  const vehicleRows = useMemo(() => {
    const map = new Map<number, { code: string; name: string; tours: GanttTour[]; dailyMinutes: Map<string, number> }>()
    for (const tour of tours) {
      if (!tour.departure_time || !tour.return_time || tour.contract_id == null) continue
      let entry = map.get(tour.contract_id)
      if (!entry) {
        entry = {
          code: tour.vehicle_code || tour.contract_code || `C${tour.contract_id}`,
          name: tour.vehicle_name || tour.transporter_name || '',
          tours: [],
          dailyMinutes: new Map(),
        }
        map.set(tour.contract_id, entry)
      }
      entry.tours.push(tour)
      const day = tour.tour_date ?? selectedDate
      entry.dailyMinutes.set(day, (entry.dailyMinutes.get(day) ?? 0) + (tour.total_duration_minutes ?? 0))
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => a.code.localeCompare(b.code))
  }, [tours, selectedDate])

  /* Marqueurs d'heures (0..72) / Hour marks */
  const hourMarks = useMemo(
    () =>
      Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => ({
        totalHour: i,
        hourInDay: i % 24,
      })),
    [],
  )

  return (
    <div
      className="rounded-xl border overflow-hidden h-full flex flex-col"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      {/* En-tête / Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('tourPlanning.timeline')}
        </h3>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-danger)' }} />
            {t('tourPlanning.legendOver10h')}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.8)', border: '1px dashed var(--color-danger)' }} />
            {t('tourPlanning.legendWindowViolation')}
          </span>
        </div>
      </div>

      {/* Zone scrollable horizontalement (12h visibles) / Horizontally scrollable area (12h viewport) */}
      <div ref={scrollRef} className="flex-1 overflow-auto py-2">
        {vehicleRows.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.noToursToday')}
          </p>
        ) : (
          <div style={{ width: totalWidth, minWidth: totalWidth }}>
            {/* En-têtes des jours / Day headers */}
            <div className="flex" style={{ height: 22 }}>
              <div
                style={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  position: 'sticky',
                  left: 0,
                  zIndex: 20,
                  background: 'var(--bg-secondary)',
                }}
              />
              {days.map((day, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center text-[11px] font-bold"
                  style={{
                    width: pxPerHour * 24,
                    color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderLeft: '2px solid var(--border-color)',
                  }}
                >
                  {day.slice(8, 10)}/{day.slice(5, 7)} {i === 0 ? '(J)' : `(J+${i})`}
                </div>
              ))}
            </div>

            {/* Axe des heures / Hour axis */}
            <div className="flex mb-1" style={{ height: 16 }}>
              <div
                style={{
                  width: LABEL_WIDTH,
                  flexShrink: 0,
                  position: 'sticky',
                  left: 0,
                  zIndex: 20,
                  background: 'var(--bg-secondary)',
                }}
              />
              <div className="relative" style={{ width: timelineWidth }}>
                {hourMarks
                  .filter((h) => h.totalHour < TOTAL_HOURS && h.hourInDay % 2 === 0)
                  .map(({ totalHour, hourInDay }) => (
                    <span
                      key={totalHour}
                      className="absolute text-[10px]"
                      style={{ left: totalHour * pxPerHour, transform: 'translateX(-50%)', color: 'var(--text-muted)' }}
                    >
                      {String(hourInDay).padStart(2, '0')}h
                    </span>
                  ))}
              </div>
            </div>

            {/* Lignes véhicules / Vehicle rows */}
            {vehicleRows.map(([contractId, { code, name, tours: vTours, dailyMinutes }]) => {
              const isOver10h = Array.from(dailyMinutes.values()).some((m) => m > MAX_CONTRACT_DAILY_MINUTES)
              return (
                <div key={contractId} className="flex items-center mb-1" style={{ minHeight: 32 }}>
                  {/* Label contrat (sticky gauche) / Contract label (sticky left) */}
                  <div
                    className="shrink-0 text-xs font-medium truncate pr-2"
                    style={{
                      width: LABEL_WIDTH,
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      background: 'var(--bg-secondary)',
                      color: isOver10h ? 'var(--color-danger)' : 'var(--text-primary)',
                    }}
                    title={`${code} — ${name}${isOver10h ? ' (>10h/jour)' : ''}`}
                  >
                    {code}
                    {isOver10h ? ' !' : ''}
                  </div>

                  {/* Barre timeline / Timeline bar */}
                  <div
                    className="relative rounded"
                    style={{
                      width: timelineWidth,
                      height: 26,
                      backgroundColor: isOver10h ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)',
                    }}
                  >
                    {/* Gridlines — trait épais à minuit, fin chaque heure / Thick at midnight, thin every hour */}
                    {hourMarks.map(({ totalHour, hourInDay }) => (
                      <div
                        key={totalHour}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: totalHour * pxPerHour,
                          width: hourInDay === 0 ? 2 : 1,
                          backgroundColor: hourInDay === 0 ? 'var(--text-muted)' : 'var(--border-color)',
                          opacity: hourInDay === 0 ? 0.5 : 0.2,
                        }}
                      />
                    ))}

                    {/* Barres des tours / Tour bars */}
                    {vTours.map((tour) => {
                      if (!tour.departure_time || !tour.return_time) return null
                      const dayIdx = days.indexOf(tour.tour_date)
                      if (dayIdx < 0) return null

                      const depMin = dayIdx * 24 * 60 + timeToMinutes(tour.departure_time)
                      let retMin = dayIdx * 24 * 60 + timeToMinutes(tour.return_time)
                      if (retMin <= depMin) retMin += 24 * 60 // tour passe minuit / crosses midnight

                      const leftPx = (depMin / 60) * pxPerHour
                      const widthPx = Math.max(((retMin - depMin) / 60) * pxPerHour, 8)
                      const color = STATUS_COLORS[tour.status] || STATUS_COLORS.DRAFT
                      const isHighlighted = tour.tour_id === highlightedTourId
                      const hasWindowViolation = warningTourIds?.has(tour.tour_id)

                      return (
                        <div
                          key={tour.tour_id}
                          className="absolute top-0.5 bottom-0.5 rounded flex items-center justify-center text-[9px] font-semibold cursor-pointer transition-all"
                          style={{
                            left: leftPx,
                            width: widthPx,
                            backgroundColor: hasWindowViolation ? 'rgba(239,68,68,0.8)' : color,
                            color: '#fff',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            outline: isHighlighted
                              ? '2px solid var(--color-primary)'
                              : hasWindowViolation
                                ? '2px dashed var(--color-danger)'
                                : 'none',
                            outlineOffset: '1px',
                            opacity: isHighlighted ? 1 : 0.85,
                            zIndex: isHighlighted ? 10 : 1,
                          }}
                          title={`${tour.code}${tour.delivery_date ? ` | Livr: ${tour.delivery_date}` : ''} | ${tour.departure_time} → ${tour.return_time} | ${tour.total_eqp ?? 0} EQC${hasWindowViolation ? ' ⚠' : ''}`}
                          onClick={() => onTourClick(tour.tour_id)}
                        >
                          {widthPx > 60 && (
                            <span className="px-1 truncate">
                              {hasWindowViolation && '⚠ '}
                              {tour.code} {tour.departure_time}–{tour.return_time}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
