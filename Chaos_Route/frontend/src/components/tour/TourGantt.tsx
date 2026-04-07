/* Gantt SVG aligné single-day / Aligned single-day SVG Gantt chart */

import { useRef, useEffect, useState, useMemo } from 'react'
import { parseTime } from '../../utils/tourTimeUtils'

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
  driver_name: string | null
  departure_time: string | null
  return_time: string | null
  total_eqp: number | null
  total_km: number | null
  total_cost: number | null
  total_duration_minutes: number | null
  delivery_date: string | null
  tour_date: string
  status: string
  stops: { id: number; pdv_id: number; pdv_code?: string; sequence_order: number; eqp_count: number; arrival_time: string | null; departure_time: string | null }[]
}

interface TourGanttProps {
  tours: GanttTour[]
  startHour?: number
  endHour?: number
  highlightedTourId: number | null
  onTourClick: (tourId: number) => void
  warningTourIds?: Set<number>
  rowHeights?: number[]
  headerHeight?: number
  expandedTourIds?: Set<number>
  driverSort?: 'asc' | 'desc' | null
}

const ROW_HEIGHT = 40
const DEFAULT_HEADER_HEIGHT = 26
const LABEL_WIDTH = 80
const PADDING_RIGHT = 16
const MIN_PX_PER_HOUR = 50  /* largeur minimum par heure pour lisibilité / min width per hour for readability */
/* Mini-barres stops / Stop mini-bars */
const STOP_BAR_H = 10
const STOP_ROW_H = 16
const STOP_AREA_TOP = 56  /* offset sous la barre principale (2 lignes compactes) / offset below main bar */

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'rgba(249,115,22,0.7)',
  VALIDATED: 'rgba(34,197,94,0.7)',
  IN_PROGRESS: 'rgba(59,130,246,0.7)',
  RETURNING: 'rgba(59,130,246,0.7)',
  COMPLETED: 'rgba(107,114,128,0.6)',
}

export function TourGantt({
  tours,
  startHour = 4,
  endHour = 22,
  highlightedTourId,
  onTourClick,
  warningTourIds,
  rowHeights,
  headerHeight: headerHeightProp,
  expandedTourIds,
  driverSort,
}: TourGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Molette → scroll horizontal (évite de devoir descendre jusqu'au scrollbar) /
     Wheel → horizontal scroll (avoids having to scroll down to reach scrollbar) */
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return  /* pas de scroll H nécessaire / no H scroll needed */
      e.preventDefault()
      el.scrollLeft += e.deltaY || e.deltaX
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const headerH = headerHeightProp ?? DEFAULT_HEADER_HEIGHT

  /* Axe temps — largeur minimum garantie par heure / Time axis — guaranteed min width per hour */
  const startMin = startHour * 60
  const endMin = endHour * 60
  const totalMin = endMin - startMin
  const totalHours = endHour - startHour
  const minChartWidth = totalHours * MIN_PX_PER_HOUR
  const chartWidth = Math.max(containerWidth - LABEL_WIDTH - PADDING_RIGHT, minChartWidth)
  const width = chartWidth + LABEL_WIDTH + PADDING_RIGHT
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
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg width={width} height={Math.max(svgHeight, 60)} style={{ display: 'block' }}>
        {/* Fond / Background */}
        <rect width={width} height={Math.max(svgHeight, 60)} fill="var(--bg-secondary)" rx={8} />

        {/* Grille horaire / Hour grid */}
        {hours.map((h) => {
          const x = toX(h * 60)
          return (
            <g key={h}>
              <line x1={x} y1={headerH} x2={x} y2={svgHeight} stroke="var(--border-color)" strokeWidth={0.5} />
              <text x={x} y={headerH / 2 + 4} textAnchor="middle" fill="var(--text-primary)" fontSize={12} fontWeight="bold" fontFamily="inherit">
                {`${String(h).padStart(2, '0')}h`}
              </text>
            </g>
          )
        })}

        {/* Lignes tours / Tour rows */}
        {tours.map((tour, i) => {
          const y = headerH + rowYs[i]
          const rowH = rowHeights?.[i] ?? ROW_HEIGHT
          const isHighlighted = tour.tour_id === highlightedTourId
          const isExpanded = expandedTourIds?.has(tour.tour_id)
          const hasWarning = warningTourIds?.has(tour.tour_id)
          const color = STATUS_COLORS[tour.status] || STATUS_COLORS.DRAFT

          const depMin = tour.departure_time ? parseTime(tour.departure_time) : null
          const retMin = tour.return_time ? parseTime(tour.return_time) : null

          /* Centrer la barre dans les premiers ROW_HEIGHT pixels / Center bar in top ROW_HEIGHT pixels */
          const barH = Math.min(18, Math.min(rowH, ROW_HEIGHT) - 8)
          const barCenterY = y + Math.min(rowH, ROW_HEIGHT) / 2
          const barY = barCenterY - barH / 2

          /* Stops triés / Sorted stops */
          const sortedStops = [...tour.stops].sort((a, b) => a.sequence_order - b.sequence_order)
          const hasStopTimes = sortedStops.some(s => s.arrival_time)

          return (
            <g key={tour.tour_id} className="cursor-pointer" onClick={() => onTourClick(tour.tour_id)}>
              {/* Fond actif / Active row highlight */}
              {isHighlighted && (
                <rect x={0} y={y} width={width} height={rowH} fill="rgba(249,115,22,0.08)" />
              )}

              {/* Séparateur horizontal / Horizontal separator */}
              {i > 0 && (
                <line x1={0} y1={y} x2={width} y2={y}
                  stroke={driverSort && tours[i - 1].driver_name !== tour.driver_name ? 'var(--color-primary)' : 'var(--border-color)'}
                  strokeWidth={driverSort && tours[i - 1].driver_name !== tour.driver_name ? 1.5 : 0.5}
                  opacity={driverSort && tours[i - 1].driver_name !== tour.driver_name ? 0.6 : 0.3}
                />
              )}

              {/* Code tour + chauffeur / Tour code + driver label */}
              {driverSort && tour.driver_name ? (
                <>
                  {/* Nom chauffeur en en-tête de groupe (première tour uniquement) */}
                  {(i === 0 || tours[i - 1].driver_name !== tour.driver_name) && (
                    <text x={4} y={barCenterY - 2} fill="var(--color-primary)" fontSize={10} fontWeight="bold" fontFamily="inherit">
                      {tour.driver_name}
                    </text>
                  )}
                  {/* Code tour indenté */}
                  <text x={12} y={(i === 0 || tours[i - 1].driver_name !== tour.driver_name) ? barCenterY + 10 : barCenterY + 4} fill={isHighlighted ? 'var(--color-primary)' : 'var(--text-muted)'} fontSize={9} fontFamily="inherit">
                    {tour.code}
                  </text>
                </>
              ) : (
                <>
                  <text x={8} y={tour.driver_name ? barCenterY - 1 : barCenterY + 4} fill={isHighlighted ? 'var(--color-primary)' : 'var(--text-primary)'} fontSize={11} fontWeight="bold" fontFamily="inherit">
                    {tour.code}
                  </text>
                  {tour.driver_name && (
                    <text x={8} y={barCenterY + 11} fill="var(--text-muted)" fontSize={9} fontFamily="inherit">
                      {tour.driver_name}
                    </text>
                  )}
                </>
              )}

              {/* Barre principale / Main bar */}
              {depMin !== null && retMin !== null && (
                <rect
                  x={toX(depMin)} y={barY}
                  width={Math.max(0, toX(retMin < depMin ? retMin + 24 * 60 : retMin) - toX(depMin))} height={barH}
                  rx={3}
                  fill={hasWarning ? 'rgba(239,68,68,0.8)' : color}
                  opacity={isExpanded ? 0.35 : 0.75}
                  stroke={isHighlighted ? 'var(--color-primary)' : hasWarning ? 'var(--color-danger)' : 'none'}
                  strokeWidth={isHighlighted ? 2 : hasWarning ? 1.5 : 0}
                  strokeDasharray={hasWarning && !isHighlighted ? '4 2' : undefined}
                />
              )}

              {/* Marqueurs arrêts sur la barre (quand fermé) / Stop markers on bar (when collapsed) */}
              {!isExpanded && tour.stops.map((stop, si) => {
                const arrMin = stop.arrival_time ? parseTime(stop.arrival_time) : null
                if (arrMin === null) return null
                return (
                  <circle
                    key={si} cx={toX(arrMin)} cy={barCenterY}
                    r={2.5} fill="#fff" stroke={color} strokeWidth={1.5}
                  />
                )
              })}

              {/* === Mini-barres stops (quand déplié) / Stop mini-bars (when expanded) === */}
              {isExpanded && hasStopTimes && sortedStops.map((stop, si) => {
                const arrMin = stop.arrival_time ? parseTime(stop.arrival_time) : null
                if (arrMin === null) return null
                const depStopMin = stop.departure_time ? parseTime(stop.departure_time) : null

                const stopY = y + STOP_AREA_TOP + si * STOP_ROW_H
                const stopBarCenterY = stopY + STOP_ROW_H / 2
                const stopBarY = stopBarCenterY - STOP_BAR_H / 2

                /* S'assurer qu'on reste dans la row / Stay within row bounds */
                if (stopY + STOP_ROW_H > y + rowH) return null

                const x1 = toX(arrMin)
                const barWidth = depStopMin !== null
                  ? Math.max(4, toX(depStopMin) - x1)
                  : 4  /* pas de departure = petit trait / no departure = thin mark */

                return (
                  <g key={`stop-${si}`}>
                    {/* Mini-barre arrivée → départ / Mini-bar arrival → departure */}
                    <rect
                      x={x1} y={stopBarY}
                      width={barWidth} height={STOP_BAR_H}
                      rx={2}
                      fill={color} opacity={0.55}
                    />
                    {/* Marqueur arrivée / Arrival marker */}
                    <circle
                      cx={x1} cy={stopBarCenterY}
                      r={2} fill="#fff" stroke={color} strokeWidth={1.2}
                    />
                    {/* Label PDV / PDV label */}
                    <text
                      x={x1 - 3} y={stopBarCenterY + 3}
                      textAnchor="end"
                      fill="var(--text-muted)" fontSize={8} fontFamily="inherit"
                    >
                      {stop.pdv_code ?? `#${si + 1}`}
                    </text>
                  </g>
                )
              })}

              {/* Ligne de liaison verticale entre stops (quand déplié) / Vertical connection line (when expanded) */}
              {isExpanded && hasStopTimes && (() => {
                const firstWithTime = sortedStops.findIndex(s => s.arrival_time)
                const lastWithTime = sortedStops.reduce((last, s, idx) => s.arrival_time ? idx : last, -1)
                if (firstWithTime < 0 || lastWithTime <= firstWithTime) return null
                const lineY1 = y + STOP_AREA_TOP + firstWithTime * STOP_ROW_H + STOP_ROW_H / 2
                const lineY2 = y + STOP_AREA_TOP + lastWithTime * STOP_ROW_H + STOP_ROW_H / 2
                if (lineY2 > y + rowH) return null
                /* Tracer une ligne verticale à la position du premier arrêt / Draw vertical line at first stop position */
                const firstArr = parseTime(sortedStops[firstWithTime].arrival_time!)
                return (
                  <line
                    x1={toX(firstArr) - 6} y1={lineY1}
                    x2={toX(firstArr) - 6} y2={lineY2}
                    stroke={color} strokeWidth={0.5} opacity={0.3}
                    strokeDasharray="2 2"
                  />
                )
              })()}
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
