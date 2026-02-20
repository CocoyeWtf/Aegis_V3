/* Gantt horizontal tours / Horizontal tour Gantt chart */

import { useRef, useEffect, useState, useMemo } from 'react'
import type { TourWithDelay } from '../../utils/tourDelay'
import { DELAY_COLORS } from '../../utils/tourDelay'
import { parseTime } from '../../utils/tourTimeUtils'

interface TourGanttProps {
  tours: TourWithDelay[]
  startHour?: number
  endHour?: number
  onTourClick?: (tourId: number) => void
  activeTourId?: number | null
  /** Hauteurs mesurées de chaque ligne du tableau / Measured row heights from table */
  rowHeights?: number[]
  /** Hauteur de l'en-tête du tableau / Table header height for alignment */
  headerHeight?: number
}

const ROW_HEIGHT = 32
const DEFAULT_HEADER_HEIGHT = 26
const LABEL_WIDTH = 76
const PADDING_RIGHT = 50

export function TourGantt({
  tours,
  startHour = 4,
  endHour = 20,
  onTourClick,
  activeTourId,
  rowHeights,
  headerHeight: headerHeightProp,
}: TourGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const headerH = headerHeightProp ?? DEFAULT_HEADER_HEIGHT

  /* Axe temps / Time axis */
  const startMin = startHour * 60
  const endMin = endHour * 60
  const totalMin = endMin - startMin
  const chartWidth = width - LABEL_WIDTH - PADDING_RIGHT
  const toX = (minutes: number) => LABEL_WIDTH + ((minutes - startMin) / totalMin) * chartWidth

  /* Heure actuelle / Current time */
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  /* Heures repères / Hour markers */
  const hours = useMemo(() => {
    const h: number[] = []
    for (let i = startHour; i <= endHour; i++) h.push(i)
    return h
  }, [startHour, endHour])

  /* Positions Y cumulées / Cumulative Y positions per row */
  const { rowYs, totalBodyHeight } = useMemo(() => {
    const ys: number[] = []
    let cum = 0
    for (let i = 0; i < tours.length; i++) {
      ys.push(cum)
      cum += (rowHeights?.[i] ?? ROW_HEIGHT)
    }
    return { rowYs: ys, totalBodyHeight: cum }
  }, [tours.length, rowHeights])

  const svgHeight = headerH + totalBodyHeight + 4

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <svg width={width} height={Math.max(svgHeight, 60)} style={{ display: 'block' }}>
        {/* Fond / Background */}
        <rect width={width} height={Math.max(svgHeight, 60)} fill="var(--bg-secondary)" rx={8} />

        {/* Grille horaire / Hour grid */}
        {hours.map((h) => {
          const x = toX(h * 60)
          return (
            <g key={h}>
              <line x1={x} y1={headerH} x2={x} y2={svgHeight} stroke="var(--border-color)" strokeWidth={0.5} />
              <text x={x} y={headerH / 2 + 4} textAnchor="middle" fill="var(--text-muted)" fontSize={10} fontFamily="inherit">
                {`${String(h).padStart(2, '0')}h`}
              </text>
            </g>
          )
        })}

        {/* Lignes tours / Tour rows */}
        {tours.map((tour, i) => {
          const y = headerH + rowYs[i]
          const rowH = rowHeights?.[i] ?? ROW_HEIGHT
          const isActive = activeTourId === tour.id
          const color = DELAY_COLORS[tour.delay_level]

          const plannedStart = tour.departure_time ? parseTime(tour.departure_time) : null
          const plannedEnd = tour.return_time ? parseTime(tour.return_time) : null
          const actualStart = tour.actual_departure ? parseTime(tour.actual_departure) : null
          const estimatedEnd = tour.estimated_return ? parseTime(tour.estimated_return) : null

          /* Barre à afficher / Bar to display */
          const barStart = actualStart ?? plannedStart
          const barEnd = estimatedEnd ?? plannedEnd

          /* Centrer la barre dans les premiers ROW_HEIGHT pixels / Center bar in top ROW_HEIGHT pixels */
          const barH = Math.min(18, Math.min(rowH, ROW_HEIGHT) - 8)
          const barCenterY = y + Math.min(rowH, ROW_HEIGHT) / 2
          const barY = barCenterY - barH / 2

          return (
            <g key={tour.id} className="cursor-pointer" onClick={() => onTourClick?.(tour.id)}>
              {/* Fond actif / Active row highlight */}
              {isActive && (
                <rect x={0} y={y} width={width} height={rowH} fill="rgba(249,115,22,0.08)" />
              )}

              {/* Séparateur horizontal / Horizontal separator */}
              {i > 0 && (
                <line x1={0} y1={y} x2={width} y2={y} stroke="var(--border-color)" strokeWidth={0.5} opacity={0.3} />
              )}

              {/* Code tour / Tour code label */}
              <text x={8} y={barCenterY + 4} fill={isActive ? 'var(--color-primary)' : 'var(--text-primary)'} fontSize={11} fontWeight="bold" fontFamily="inherit">
                {tour.code}
              </text>

              {/* Barre fantôme planifiée (si retard) / Ghost planned bar (if delayed) */}
              {tour.delay_minutes > 0 && plannedStart !== null && plannedEnd !== null && (
                <rect
                  x={toX(plannedStart)} y={barY}
                  width={Math.max(0, toX(plannedEnd) - toX(plannedStart))} height={barH}
                  rx={3} fill="none" stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 2" opacity={0.35}
                />
              )}

              {/* Barre principale / Main bar */}
              {barStart !== null && barEnd !== null && (
                <rect
                  x={toX(barStart)} y={barY}
                  width={Math.max(0, toX(barEnd) - toX(barStart))} height={barH}
                  rx={3} fill={color} opacity={0.75}
                />
              )}

              {/* Marqueurs arrêts / Stop markers */}
              {tour.estimated_stops.map((stop, si) => {
                const arrMin = stop.estimated_arrival ? parseTime(stop.estimated_arrival) : null
                if (arrMin === null) return null
                return (
                  <circle
                    key={si} cx={toX(arrMin)} cy={barCenterY}
                    r={2.5} fill="#fff" stroke={color} strokeWidth={1.5}
                  />
                )
              })}

              {/* Label retard / Delay label */}
              {tour.delay_minutes > 0 && barEnd !== null && (
                <text
                  x={toX(barEnd) + 4} y={barCenterY + 4}
                  fill={color} fontSize={10} fontWeight="bold" fontFamily="inherit"
                >
                  +{tour.delay_minutes}′
                </text>
              )}
            </g>
          )
        })}

        {/* Ligne "maintenant" / "Now" line */}
        {nowMin >= startMin && nowMin <= endMin && (
          <>
            <line
              x1={toX(nowMin)} y1={headerH - 2}
              x2={toX(nowMin)} y2={svgHeight}
              stroke="var(--color-danger)" strokeWidth={1.5} strokeDasharray="4 3"
            />
            <polygon
              points={`${toX(nowMin) - 4},${headerH - 2} ${toX(nowMin) + 4},${headerH - 2} ${toX(nowMin)},${headerH + 4}`}
              fill="var(--color-danger)"
            />
          </>
        )}
      </svg>
    </div>
  )
}
