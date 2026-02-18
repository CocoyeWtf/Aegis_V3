/* Fiche détaillée d'un tour (overlay imprimable) / Printable tour detail sheet */

import { useTranslation } from 'react-i18next'

interface TourStop {
  sequence_order: number
  pdv_code: string
  pdv_name: string
  eqp_count: number
  distance_from_previous_km: number
  duration_from_previous_minutes: number
  arrival_time?: string
  departure_time?: string
  pickup_cardboard?: boolean
  pickup_containers?: boolean
  pickup_returns?: boolean
}

interface CostBreakdown {
  fixed_share: number
  fuel_cost: number
  km_tax_total: number
  total_calculated: number
}

interface TimeBreakdown {
  travel_minutes: number
  dock_minutes: number
  unload_minutes: number
  total_minutes: number
}

export interface TourDetailData {
  tour_id: number
  tour_code: string
  date: string
  base_code: string
  base_name: string
  departure_time?: string
  return_time?: string
  total_km: number
  total_eqp: number
  total_duration_minutes: number
  total_cost: number
  status: string
  driver_name?: string
  driver_arrival_time?: string
  loading_end_time?: string
  barrier_exit_time?: string
  barrier_entry_time?: string
  remarks?: string
  cost_breakdown: CostBreakdown
  time_breakdown?: TimeBreakdown
  stops: TourStop[]
  /* Contexte contrat (injecté par la page parent) / Contract context (injected by parent) */
  contract_code?: string
  transporter_name?: string
  vehicle_code?: string
  vehicle_name?: string
}

interface TourDetailSheetProps {
  tour: TourDetailData
  onClose: () => void
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

export function TourDetailSheet({ tour, onClose }: TourDetailSheetProps) {
  const { t } = useTranslation()

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 overflow-auto print-overlay" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Toolbar (masquée à l'impression / hidden on print) */}
      <div
        className="print-hide sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('transporterSummary.tourDetail')} — {tour.tour_code}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
            style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
          >
            {t('transporterSummary.print')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            {t('transporterSummary.close')}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Section 1 — Infos tour / Tour info */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('transporterSummary.tourInfo')}
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <InfoRow label={t('transporterSummary.tourCode')} value={tour.tour_code} />
            <InfoRow label={t('transporterSummary.date')} value={tour.date} />
            <InfoRow label={t('transporterSummary.base')} value={`${tour.base_code} — ${tour.base_name}`} />
            <InfoRow label={t('common.status')} value={tour.status} />
            {tour.contract_code && (
              <InfoRow label={t('transporterSummary.contract')} value={tour.contract_code} />
            )}
            {tour.transporter_name && (
              <InfoRow label={t('transporterSummary.transporter')} value={tour.transporter_name} />
            )}
            {tour.vehicle_code && (
              <InfoRow label={t('transporterSummary.vehicle')} value={`${tour.vehicle_code} — ${tour.vehicle_name || ''}`} />
            )}
            <InfoRow label={t('transporterSummary.departure')} value={tour.departure_time || '—'} />
            <InfoRow label={t('transporterSummary.return')} value={tour.return_time || '—'} />
            <InfoRow label={t('transporterSummary.duration')} value={formatDuration(tour.total_duration_minutes)} />
            <InfoRow label={t('transporterSummary.km')} value={`${tour.total_km.toFixed(1)} km`} />
            <InfoRow label={t('transporterSummary.eqp')} value={String(tour.total_eqp)} />
          </div>
        </section>

        {/* Section 2 — Coût / Cost breakdown */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('transporterSummary.costBreakdown')}
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <InfoRow label={t('transporterSummary.fixedShare')} value={`${tour.cost_breakdown.fixed_share.toFixed(2)} \u20AC`} />
            <InfoRow label={t('transporterSummary.fuelCost')} value={`${tour.cost_breakdown.fuel_cost.toFixed(2)} \u20AC`} />
            <InfoRow label={t('transporterSummary.kmTax')} value={`${tour.cost_breakdown.km_tax_total.toFixed(2)} \u20AC`} />
          </div>
          <div
            className="mt-3 rounded-lg p-3 flex items-center justify-between"
            style={{ backgroundColor: 'rgba(249,115,22,0.08)', borderLeft: '4px solid var(--color-primary)' }}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('transporterSummary.totalCost')}
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              {tour.cost_breakdown.total_calculated.toFixed(2)} &euro;
            </span>
          </div>
        </section>

        {/* Section 2b — Temps / Time breakdown */}
        {tour.time_breakdown && (
          <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('timeBreakdown.title')}
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <InfoRow label={t('timeBreakdown.travelTime')} value={formatDuration(tour.time_breakdown.travel_minutes)} />
              <InfoRow label={t('timeBreakdown.dockTime')} value={formatDuration(tour.time_breakdown.dock_minutes)} />
              <InfoRow label={t('timeBreakdown.unloadTime')} value={formatDuration(tour.time_breakdown.unload_minutes)} />
            </div>
            <div
              className="mt-3 rounded-lg p-3 flex items-center justify-between"
              style={{ backgroundColor: 'rgba(59,130,246,0.08)', borderLeft: '4px solid var(--color-info, #3b82f6)' }}
            >
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('timeBreakdown.totalTime')}
              </span>
              <span className="text-lg font-bold" style={{ color: 'var(--color-info, #3b82f6)' }}>
                {formatDuration(tour.time_breakdown.total_minutes)}
              </span>
            </div>
          </section>
        )}

        {/* Section 3 — Itinéraire / Itinerary */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('transporterSummary.itinerary')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left pb-2 font-medium">{t('transporterSummary.sequence')}</th>
                  <th className="text-left pb-2 font-medium">{t('transporterSummary.pdvCode')}</th>
                  <th className="text-left pb-2 font-medium">{t('transporterSummary.pdvName')}</th>
                  <th className="text-right pb-2 font-medium">{t('transporterSummary.km')}</th>
                  <th className="text-right pb-2 font-medium">{t('transporterSummary.duration')}</th>
                  <th className="text-right pb-2 font-medium">{t('transporterSummary.arrivalTime')}</th>
                  <th className="text-right pb-2 font-medium">{t('transporterSummary.eqp')}</th>
                  <th className="text-center pb-2 font-medium">{t('transporterSummary.pickups')}</th>
                  <th className="text-right pb-2 font-medium">{t('transporterSummary.departureTime')}</th>
                </tr>
              </thead>
              <tbody>
                {tour.stops.map((stop) => (
                  <tr key={stop.sequence_order} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-1.5" style={{ color: 'var(--text-muted)' }}>{stop.sequence_order}</td>
                    <td className="py-1.5 font-mono" style={{ color: 'var(--text-primary)' }}>{stop.pdv_code}</td>
                    <td className="py-1.5" style={{ color: 'var(--text-primary)' }}>{stop.pdv_name}</td>
                    <td className="py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>
                      {stop.distance_from_previous_km.toFixed(1)}
                    </td>
                    <td className="py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>
                      {stop.duration_from_previous_minutes}′
                    </td>
                    <td className="py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                      {stop.arrival_time || '—'}
                    </td>
                    <td className="py-1.5 text-right font-bold" style={{ color: 'var(--text-primary)' }}>
                      {stop.eqp_count}
                    </td>
                    <td className="py-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
                      {[
                        stop.pickup_cardboard && 'C',
                        stop.pickup_containers && 'B',
                        stop.pickup_returns && 'R',
                      ].filter(Boolean).join('/') || '—'}
                    </td>
                    <td className="py-1.5 text-right" style={{ color: 'var(--text-primary)' }}>
                      {stop.departure_time || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 — Opérationnel / Operational */}
        <section className="rounded-xl border p-5" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('transporterSummary.operationalInfo')}
          </h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <InfoRow label={t('transporterSummary.driverName')} value={tour.driver_name || '—'} />
            <InfoRow label={t('transporterSummary.driverArrival')} value={tour.driver_arrival_time || '—'} />
            <InfoRow label={t('transporterSummary.loadingEnd')} value={tour.loading_end_time || '—'} />
            <InfoRow label={t('transporterSummary.barrierExit')} value={tour.barrier_exit_time || '—'} />
            <InfoRow label={t('transporterSummary.barrierEntry')} value={tour.barrier_entry_time || '—'} />
          </div>
          {tour.remarks && (
            <div className="mt-3 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('transporterSummary.remarks')} : </span>
              {tour.remarks}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
