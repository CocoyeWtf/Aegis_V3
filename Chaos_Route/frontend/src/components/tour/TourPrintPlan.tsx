/* Plan de tour imprimable + export Excel / Printable tour plan + Excel export */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { VEHICLE_TYPE_DEFAULTS } from '../../types'
import { formatDuration, parseTime, formatTime, DEFAULT_DOCK_TIME, DEFAULT_UNLOAD_PER_EQP } from '../../utils/tourTimeUtils'
import type { Tour, PDV, Contract, DistanceEntry, VehicleType, BaseLogistics, Volume } from '../../types'

interface TourPrintPlanProps {
  tours: Tour[]
  pdvs: PDV[]
  contracts: Contract[]
  bases: BaseLogistics[]
  distances: DistanceEntry[]
  volumes: Volume[]
  date: string
  onClose: () => void
}

interface StopDetail {
  sequence: number
  pdvCode: string
  pdvName: string
  city: string
  arrivalTime: string
  departureTime: string
  travelMinutes: number
  distanceKm: number
  unloadMinutes: number
  eqpCount: number
  activity: string
  pickupCardboard: boolean
  pickupContainers: boolean
  pickupReturns: boolean
}

interface TourDetail {
  tour: Tour
  contractCode: string
  transporterName: string
  vehicleCode: string
  vehicleLabel: string
  baseName: string
  baseCode: string
  departureTime: string
  returnTime: string
  totalDuration: number
  totalKm: number
  totalEqp: number
  totalCost: number
  stops: StopDetail[]
}

/* Calcul des détails de tous les tours / Compute all tour details */
function computeTourDetails(
  tours: Tour[],
  pdvMap: Map<number, PDV>,
  contractMap: Map<number, Contract>,
  baseMap: Map<number, BaseLogistics>,
  volumesByPdvTour: Map<string, Volume>,
  getDistance: (ft: string, fi: number, tt: string, ti: number) => DistanceEntry | undefined,
): TourDetail[] {
  return tours
    .filter((tour) => tour.departure_time)
    .sort((a, b) => (a.departure_time ?? '').localeCompare(b.departure_time ?? ''))
    .map((tour) => {
      const contract = tour.contract_id ? contractMap.get(tour.contract_id) : null
      const base = baseMap.get(tour.base_id)
      const vt = tour.vehicle_type as VehicleType | undefined
      const vehicleLabel = vt && VEHICLE_TYPE_DEFAULTS[vt] ? VEHICLE_TYPE_DEFAULTS[vt].label : tour.vehicle_type ?? '—'

      const sortedStops = [...(tour.stops ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)

      let currentMin = parseTime(tour.departure_time!)
      let prevType = 'BASE'
      let prevId = tour.base_id
      const stops: StopDetail[] = []

      for (const stop of sortedStops) {
        const dist = getDistance(prevType, prevId, 'PDV', stop.pdv_id)
        const travelMin = dist?.duration_minutes ?? 0
        const distKm = dist?.distance_km ?? 0
        currentMin += travelMin
        const arrivalTime = formatTime(currentMin)

        const pdv = pdvMap.get(stop.pdv_id)
        const dockTime = pdv?.dock_time_minutes ?? DEFAULT_DOCK_TIME
        const unloadPerEqp = pdv?.unload_time_per_eqp_minutes ?? DEFAULT_UNLOAD_PER_EQP
        const unloadMin = dockTime + stop.eqp_count * unloadPerEqp
        currentMin += unloadMin
        const departureTime = formatTime(currentMin)

        /* Activité = classe température du volume / Activity = volume temperature class */
        const vol = volumesByPdvTour.get(`${stop.pdv_id}:${tour.id}`)
        const activity = vol?.temperature_class ?? ''

        stops.push({
          sequence: stop.sequence_order,
          pdvCode: pdv?.code ?? `#${stop.pdv_id}`,
          pdvName: pdv?.name ?? '',
          city: pdv?.city ?? '',
          arrivalTime,
          departureTime,
          travelMinutes: travelMin,
          distanceKm: Math.round(distKm * 10) / 10,
          unloadMinutes: unloadMin,
          eqpCount: stop.eqp_count,
          activity,
          pickupCardboard: !!stop.pickup_cardboard,
          pickupContainers: !!stop.pickup_containers,
          pickupReturns: !!stop.pickup_returns,
        })

        prevType = 'PDV'
        prevId = stop.pdv_id
      }

      /* Retour base / Return to base */
      const lastStop = sortedStops[sortedStops.length - 1]
      if (lastStop) {
        const retDist = getDistance('PDV', lastStop.pdv_id, 'BASE', tour.base_id)
        currentMin += retDist?.duration_minutes ?? 0
      }

      const returnTime = formatTime(currentMin)
      const totalDuration = currentMin - parseTime(tour.departure_time!)

      return {
        tour,
        contractCode: contract?.code ?? '—',
        transporterName: contract?.transporter_name ?? '—',
        vehicleCode: contract?.vehicle_code ?? '',
        vehicleLabel,
        baseName: base ? `${base.code} — ${base.name}` : `Base #${tour.base_id}`,
        baseCode: base?.code ?? '',
        departureTime: tour.departure_time!,
        returnTime,
        totalDuration,
        totalKm: tour.total_km ?? 0,
        totalEqp: tour.total_eqp ?? 0,
        totalCost: tour.total_cost ?? 0,
        stops,
      }
    })
}

/* Export Excel — une ligne par PDV, recherchable / One row per PDV, Ctrl+F friendly */
function exportToExcel(tourDetails: TourDetail[], date: string, t: (key: string) => string) {
  const wb = XLSX.utils.book_new()
  const rows: Record<string, string | number>[] = []

  for (const d of tourDetails) {
    for (const stop of d.stops) {
      rows.push({
        [t('tourPlanning.printPlan.tourCode')]: d.tour.code,
        [t('tourPlanning.printPlan.contract')]: d.contractCode,
        [t('tourPlanning.printPlan.transporter')]: d.transporterName,
        [t('tourPlanning.printPlan.vehicle')]: d.vehicleLabel,
        [t('tourPlanning.printPlan.base')]: d.baseCode,
        '#': stop.sequence,
        [t('tourPlanning.printPlan.pdvCode')]: stop.pdvCode,
        [t('tourPlanning.printPlan.pdvName')]: stop.pdvName,
        [t('tourPlanning.printPlan.cityCol')]: stop.city,
        [t('tourPlanning.printPlan.activity')]: stop.activity,
        'EQP': stop.eqpCount,
        [t('tourPlanning.pickupCardboard')]: stop.pickupCardboard ? '✓' : '',
        [t('tourPlanning.pickupContainers')]: stop.pickupContainers ? '✓' : '',
        [t('tourPlanning.pickupReturns')]: stop.pickupReturns ? '✓' : '',
        [`${t('tourPlanning.printPlan.travel')} (min)`]: stop.travelMinutes,
        [`${t('tourPlanning.printPlan.travel')} (km)`]: stop.distanceKm,
        [t('tourPlanning.arrivalAt')]: stop.arrivalTime,
        [`${t('tourPlanning.unloadTime')} (min)`]: stop.unloadMinutes,
        [t('tourPlanning.departureAt')]: stop.departureTime,
        [t('tourPlanning.printPlan.tourDeparture')]: d.departureTime,
        [t('tourPlanning.printPlan.tourReturn')]: d.returnTime,
      })
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 10 },
    { wch: 4 }, { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 8 },
    { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
    { wch: 8 }, { wch: 8 }, { wch: 8 },
  ]
  /* Figer la première ligne / Freeze header row */
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  /* Filtre auto / Autofilter */
  if (rows.length > 0) {
    const colCount = Object.keys(rows[0]).length
    ws['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + colCount)}${rows.length + 1}` }
  }
  XLSX.utils.book_append_sheet(wb, ws, t('tourPlanning.printPlan.detailSheet'))

  XLSX.writeFile(wb, `plan_tours_${date}.xlsx`)
}

export function TourPrintPlan({ tours, pdvs, contracts, bases, distances, volumes, date, onClose }: TourPrintPlanProps) {
  const { t } = useTranslation()

  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])
  const contractMap = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts])
  const baseMap = useMemo(() => new Map(bases.map((b) => [b.id, b])), [bases])

  /* Index volume par pdv_id:tour_id / Volume index by pdv_id:tour_id */
  const volumesByPdvTour = useMemo(() => {
    const m = new Map<string, Volume>()
    volumes.forEach((v) => {
      if (v.tour_id) m.set(`${v.pdv_id}:${v.tour_id}`, v)
    })
    return m
  }, [volumes])

  const distanceIndex = useMemo(() => {
    const idx = new Map<string, DistanceEntry>()
    distances.forEach((d) => {
      idx.set(`${d.origin_type}:${d.origin_id}->${d.destination_type}:${d.destination_id}`, d)
    })
    return idx
  }, [distances])

  const getDistance = (fromType: string, fromId: number, toType: string, toId: number): DistanceEntry | undefined => {
    return distanceIndex.get(`${fromType}:${fromId}->${toType}:${toId}`)
      || distanceIndex.get(`${toType}:${toId}->${fromType}:${fromId}`)
  }

  const tourDetails = useMemo(
    () => computeTourDetails(tours, pdvMap, contractMap, baseMap, volumesByPdvTour, getDistance),
    [tours, pdvMap, contractMap, baseMap, volumesByPdvTour, distanceIndex],
  )

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Barre d'outils (masquée à l'impression) / Toolbar (hidden on print) */}
      <div
        className="print-hide flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('tourPlanning.printPlan.title')}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => exportToExcel(tourDetails, date, t)}
            className="px-4 py-2 rounded-lg text-sm font-semibold border transition-all hover:opacity-80"
            style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
          >
            {t('tourPlanning.printPlan.exportExcel')}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          >
            {t('tourPlanning.printPlan.print')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            {t('tourPlanning.printPlan.close')}
          </button>
        </div>
      </div>

      {/* Contenu imprimable — layout simple table / Printable content — simple table layout */}
      <div className="flex-1 overflow-y-auto p-6 print-content">
        {/* En-tête / Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
            {t('tourPlanning.printPlan.planTitle')}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {formattedDate} — {tourDetails.length} {t('tourPlanning.printPlan.tours')}
          </p>
        </div>

        {tourDetails.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('tourPlanning.printPlan.noScheduledTours')}
          </p>
        ) : (
          tourDetails.map((detail, idx) => (
            <div key={detail.tour.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
              {/* En-tête tour — simple table / Tour header — simple table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                }}
              >
                {/* Ligne titre tour / Tour title row */}
                <thead>
                  <tr className="print-tour-header" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <th
                      colSpan={10}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {idx + 1}. {detail.tour.code}
                      <span style={{ fontWeight: 'normal', fontSize: '12px', marginLeft: '12px' }}>
                        {detail.vehicleLabel}
                      </span>
                      <span style={{ fontWeight: 'normal', fontSize: '12px', marginLeft: '12px' }}>
                        {detail.departureTime} → {detail.returnTime} ({formatDuration(detail.totalDuration)})
                      </span>
                    </th>
                  </tr>
                  {/* Ligne infos contrat / Contract info row */}
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <td
                      colSpan={10}
                      style={{
                        padding: '4px 12px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      <strong style={{ color: 'var(--text-primary)' }}>{t('tourPlanning.printPlan.contract')}:</strong>{' '}
                      {detail.contractCode} — {detail.transporterName}
                      {detail.vehicleCode && ` (${detail.vehicleCode})`}
                      <span style={{ marginLeft: '16px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{t('tourPlanning.printPlan.base')}:</strong>{' '}
                        {detail.baseName}
                      </span>
                      <span style={{ marginLeft: '16px' }}>
                        {detail.stops.length} {t('tourPlanning.stops')} | {detail.totalEqp} EQP | {detail.totalKm} km
                        {detail.totalCost > 0 && ` | ${detail.totalCost}€`}
                      </span>
                    </td>
                  </tr>
                  {/* En-têtes colonnes / Column headers */}
                  <tr className="print-thead" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ ...thStyle, width: '30px' }}>#</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>PDV</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>{t('tourPlanning.printPlan.cityCol')}</th>
                    <th style={thStyle}>{t('tourPlanning.printPlan.activity')}</th>
                    <th style={thStyle}>EQP</th>
                    <th style={thStyle}>{t('tourPlanning.pickups')}</th>
                    <th style={thStyle}>{t('tourPlanning.printPlan.travel')}</th>
                    <th style={thStyle}>{t('tourPlanning.arrivalAt')}</th>
                    <th style={thStyle}>{t('tourPlanning.unloadTime')}</th>
                    <th style={thStyle}>{t('tourPlanning.departureAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Départ base / Base departure */}
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'center' }}>B</td>
                    <td colSpan={6} style={{ ...tdStyle, fontStyle: 'italic' }}>
                      {t('tourPlanning.printPlan.departureBase')} — {detail.baseName}
                    </td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                      {detail.departureTime}
                    </td>
                  </tr>

                  {/* Arrêts / Stops */}
                  {detail.stops.map((stop, sIdx) => (
                    <tr
                      key={sIdx}
                      className={sIdx % 2 === 1 ? 'print-row-alt' : ''}
                    >
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{sIdx + 1}</td>
                      <td style={{ ...tdStyle, textAlign: 'left' }}>
                        <strong>{stop.pdvCode}</strong>
                        {stop.pdvName && ` — ${stop.pdvName}`}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-muted)' }}>{stop.city}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{stop.activity}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{stop.eqpCount}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {[
                          stop.pickupCardboard && t('tourPlanning.pickupCardboard'),
                          stop.pickupContainers && t('tourPlanning.pickupContainers'),
                          stop.pickupReturns && t('tourPlanning.pickupReturns'),
                        ].filter(Boolean).join(', ')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {stop.travelMinutes}′ / {stop.distanceKm}km
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{stop.arrivalTime}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {stop.unloadMinutes}′
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{stop.departureTime}</td>
                    </tr>
                  ))}

                  {/* Retour base / Return to base */}
                  <tr>
                    <td style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'center' }}>B</td>
                    <td colSpan={6} style={{ ...tdStyle, fontStyle: 'italic' }}>
                      {t('tourPlanning.printPlan.returnBase')} — {detail.baseName}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>
                      {detail.returnTime}
                    </td>
                    <td style={tdStyle} />
                    <td style={tdStyle} />
                  </tr>

                  {/* Ligne totaux / Totals row */}
                  <tr className="print-tour-header" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <td colSpan={5} style={{ ...tdStyle, fontWeight: 'bold', textAlign: 'right' }}>
                      {t('tourPlanning.totalDuration')}: {formatDuration(detail.totalDuration)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{detail.totalEqp}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{detail.totalKm} km</td>
                    <td colSpan={3} style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>
                      {detail.totalCost > 0 ? `${detail.totalCost}€` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))
        )}

        {/* Pied de page récapitulatif / Summary footer */}
        {tourDetails.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)', fontSize: '12px' }}>
            <tbody>
              <tr className="print-tour-header" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                  {t('tourPlanning.printPlan.totalLabel')}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <strong>{tourDetails.length}</strong> {t('tourPlanning.printPlan.tours')}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <strong>{tourDetails.reduce((s, d) => s + d.stops.length, 0)}</strong> {t('tourPlanning.stops')}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <strong>{tourDetails.reduce((s, d) => s + d.totalEqp, 0)}</strong> EQP
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <strong>{tourDetails.reduce((s, d) => s + d.totalKm, 0)}</strong> km
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <strong>{tourDetails.reduce((s, d) => s + d.totalCost, 0)}€</strong>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* Styles inline réutilisables / Reusable inline styles */
const thStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '11px',
  fontWeight: 600,
  textAlign: 'center',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-color)',
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '11px',
  borderTop: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
}
