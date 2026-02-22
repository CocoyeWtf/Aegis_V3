/* Timeline du jour : barres horizontales par véhicule / Day timeline: horizontal bars per vehicle */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'

interface TimelineTour {
  tour_id: number
  code: string
  contract_id: number
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
  status: string
  stops: { id: number; pdv_id: number; sequence_order: number; eqp_count: number; arrival_time: string | null; departure_time: string | null }[]
}

interface TourTimelineProps {
  date: string
  baseId: number
}

/* Plage horaire affichée / Displayed time range */
const HOUR_START = 5
const HOUR_END = 23
const TOTAL_HOURS = HOUR_END - HOUR_START

/* Couleurs par statut / Colors by status */
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'rgba(249,115,22,0.6)',
  VALIDATED: 'rgba(34,197,94,0.6)',
  IN_PROGRESS: 'rgba(59,130,246,0.6)',
  RETURNING: 'rgba(59,130,246,0.6)',
  COMPLETED: 'rgba(107,114,128,0.5)',
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function TourTimeline({ date, baseId }: TourTimelineProps) {
  const { t } = useTranslation()
  const [tours, setTours] = useState<TimelineTour[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data } = await api.get<TimelineTour[]>('/tours/timeline', {
          params: { date, base_id: baseId },
        })
        if (!cancelled) setTours(data)
      } catch {
        if (!cancelled) setTours([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [date, baseId])

  /* Regrouper par contrat / Group by contract */
  const vehicleRows = useMemo(() => {
    const map = new Map<number, { code: string; name: string; tours: TimelineTour[] }>()
    for (const tour of tours) {
      if (!tour.departure_time || !tour.return_time) continue
      let entry = map.get(tour.contract_id)
      if (!entry) {
        entry = {
          code: tour.vehicle_code || tour.contract_code || `C${tour.contract_id}`,
          name: tour.vehicle_name || tour.transporter_name || '',
          tours: [],
        }
        map.set(tour.contract_id, entry)
      }
      entry.tours.push(tour)
    }
    return Array.from(map.entries()).sort(([, a], [, b]) => a.code.localeCompare(b.code))
  }, [tours])

  if (tours.length === 0) {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-xs"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
      >
        {t('tourPlanning.timeline')} — {t('tourPlanning.noToursToday')}
      </div>
    )
  }

  const startMin = HOUR_START * 60
  const endMin = HOUR_END * 60
  const rangeMin = endMin - startMin

  /* Graduations d'heures / Hour marks */
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => HOUR_START + i)

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      {/* En-tête / Header */}
      <div
        className="px-4 py-2 flex items-center justify-between border-b cursor-pointer"
        style={{ borderColor: 'var(--border-color)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('tourPlanning.timeline')}
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
            ({tours.length} tour{tours.length > 1 ? 's' : ''})
          </span>
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 overflow-x-auto">
          {/* Axe des heures / Hour axis */}
          <div className="flex items-end mb-1 ml-[100px]" style={{ position: 'relative', height: '16px' }}>
            {hours.map((h) => {
              const pct = ((h * 60 - startMin) / rangeMin) * 100
              return (
                <span
                  key={h}
                  className="text-[10px] absolute"
                  style={{ left: `${pct}%`, color: 'var(--text-muted)', transform: 'translateX(-50%)' }}
                >
                  {String(h).padStart(2, '0')}h
                </span>
              )
            })}
          </div>

          {/* Lignes véhicules / Vehicle rows */}
          {vehicleRows.map(([vehicleId, { code, name, tours: vTours }]) => (
            <div key={vehicleId} className="flex items-center mb-1" style={{ minHeight: '28px' }}>
              {/* Label véhicule / Vehicle label */}
              <div
                className="w-[100px] shrink-0 text-xs font-medium truncate pr-2"
                style={{ color: 'var(--text-primary)' }}
                title={`${code} — ${name}`}
              >
                {code}
              </div>

              {/* Barre / Bar area */}
              <div
                className="flex-1 relative rounded"
                style={{ backgroundColor: 'var(--bg-tertiary)', height: '22px' }}
              >
                {/* Lignes verticales des heures / Hour gridlines */}
                {hours.map((h) => {
                  const pct = ((h * 60 - startMin) / rangeMin) * 100
                  return (
                    <div
                      key={h}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: `${pct}%`,
                        width: '1px',
                        backgroundColor: 'var(--border-color)',
                        opacity: 0.3,
                      }}
                    />
                  )
                })}

                {/* Tours / Tour bars */}
                {vTours.map((tour) => {
                  if (!tour.departure_time || !tour.return_time) return null
                  const depMin = timeToMinutes(tour.departure_time)
                  const retMin = timeToMinutes(tour.return_time)
                  const left = Math.max(0, ((depMin - startMin) / rangeMin) * 100)
                  const width = Math.min(100 - left, ((retMin - depMin) / rangeMin) * 100)
                  const color = STATUS_COLORS[tour.status] || STATUS_COLORS.DRAFT

                  return (
                    <div
                      key={tour.tour_id}
                      className="absolute top-0.5 bottom-0.5 rounded flex items-center justify-center text-[9px] font-semibold"
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 1)}%`,
                        backgroundColor: color,
                        color: '#fff',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                      title={`${tour.code} | ${tour.departure_time} → ${tour.return_time} | ${tour.total_eqp ?? 0} EQC`}
                    >
                      {width > 5 && (
                        <span className="px-1 truncate">
                          {tour.departure_time}–{tour.return_time}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
