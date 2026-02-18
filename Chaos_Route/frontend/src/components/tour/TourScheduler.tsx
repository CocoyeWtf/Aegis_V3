/* Ordonnancement des tours (Phase 2) / Tour scheduling with contract assignment + Gantt */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { TourGantt, type GanttTour } from './TourGantt'
import { TourPrintPlan } from './TourPrintPlan'
import { formatDuration, parseTime, formatTime, DEFAULT_DOCK_TIME, DEFAULT_UNLOAD_PER_EQP } from '../../utils/tourTimeUtils'
import { VEHICLE_TYPE_DEFAULTS } from '../../types'
import api from '../../services/api'
import { CostBreakdown } from './CostBreakdown'
import type { Tour, BaseLogistics, Contract, DistanceEntry, PDV, VehicleType, Volume } from '../../types'

interface TourSchedulerProps {
  selectedDate: string
  selectedBaseId: number | null
  onDateChange: (date: string) => void
  onBaseChange: (baseId: number | null) => void
}

export function TourScheduler({ selectedDate, selectedBaseId, onDateChange, onBaseChange }: TourSchedulerProps) {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()

  const regionParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: bases } = useApi<BaseLogistics>('/bases', regionParams)
  const { data: allContracts } = useApi<Contract>('/contracts', regionParams)
  const { data: distances } = useApi<DistanceEntry>('/distance-matrix')
  const { data: pdvs } = useApi<PDV>('/pdvs', regionParams)
  const { data: allVolumes } = useApi<Volume>('/volumes', regionParams)

  const contractMap = useMemo(() => new Map(allContracts.map((c) => [c.id, c])), [allContracts])

  const [tours, setTours] = useState<Tour[]>([])
  const [timeline, setTimeline] = useState<GanttTour[]>([])
  const [highlightedTourId, setHighlightedTourId] = useState<number | null>(null)
  const [scheduleInputs, setScheduleInputs] = useState<Record<number, { time: string; contractId: number | null }>>({})
  const [scheduling, setScheduling] = useState<number | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [costTourId, setCostTourId] = useState<number | null>(null)
  const [showPrintPlan, setShowPrintPlan] = useState(false)
  /* Contrats disponibles par tour (chargés selon vehicle_type) / Available contracts per tour */
  const [availableContractsMap, setAvailableContractsMap] = useState<Record<number, Contract[]>>({})

  /* Index des distances / Distance index */
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

  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])

  /* Charger les tours et la timeline / Load tours and timeline */
  const loadData = useCallback(async () => {
    if (!selectedDate || !selectedBaseId) {
      setTours([])
      setTimeline([])
      return
    }
    try {
      const [toursRes, timelineRes] = await Promise.all([
        api.get<Tour[]>('/tours/', { params: { date: selectedDate, base_id: selectedBaseId } }),
        api.get<GanttTour[]>('/tours/timeline', { params: { date: selectedDate, base_id: selectedBaseId } }),
      ])
      setTours(toursRes.data)
      setTimeline(timelineRes.data)
    } catch {
      setTours([])
      setTimeline([])
    }
  }, [selectedDate, selectedBaseId])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* Charger contrats disponibles pour chaque tour non planifié / Load available contracts per unscheduled tour */
  const loadContractsForTour = useCallback(async (tour: Tour) => {
    if (!selectedBaseId || !selectedDate || !tour.vehicle_type) return
    try {
      const { data } = await api.get<Contract[]>('/tours/available-contracts', {
        params: {
          date: selectedDate,
          base_id: selectedBaseId,
          vehicle_type: tour.vehicle_type,
          tour_id: tour.id,
        },
      })
      setAvailableContractsMap((prev) => ({ ...prev, [tour.id]: data }))
    } catch {
      setAvailableContractsMap((prev) => ({ ...prev, [tour.id]: [] }))
    }
  }, [selectedDate, selectedBaseId])

  /* Charger contrats pour tous les tours non planifiés / Load contracts for all unscheduled tours */
  useEffect(() => {
    const unscheduled = tours.filter((t) => !t.departure_time && !t.contract_id)
    unscheduled.forEach((tour) => loadContractsForTour(tour))
  }, [tours, loadContractsForTour])

  /* Séparer tours planifiés et non-planifiés / Split scheduled vs unscheduled */
  const unscheduledTours = useMemo(() => tours.filter((t) => !t.departure_time), [tours])
  const scheduledTours = useMemo(() => tours.filter((t) => t.departure_time), [tours])

  /* Détecter les tours avec violation de fenêtre de livraison / Detect delivery window violations */
  const deliveryWindowViolations = useMemo(() => {
    const violations = new Map<number, string[]>()
    for (const tour of scheduledTours) {
      if (!tour.stops) continue
      const tourViolations: string[] = []
      for (const stop of tour.stops) {
        if (!stop.arrival_time) continue
        const pdv = pdvMap.get(stop.pdv_id)
        if (!pdv) continue
        if (pdv.delivery_window_start && stop.arrival_time < pdv.delivery_window_start) {
          tourViolations.push(`${pdv.code} ${pdv.name}: ${stop.arrival_time} < ${pdv.delivery_window_start}`)
        }
        if (pdv.delivery_window_end && stop.arrival_time > pdv.delivery_window_end) {
          tourViolations.push(`${pdv.code} ${pdv.name}: ${stop.arrival_time} > ${pdv.delivery_window_end}`)
        }
      }
      if (tourViolations.length > 0) {
        violations.set(tour.id, tourViolations)
      }
    }
    return violations
  }, [scheduledTours, pdvMap])

  /* Estimation retour client-side / Client-side return estimation */
  const estimateReturn = (tour: Tour, departureTime: string): string | null => {
    if (!departureTime || !tour.stops || tour.stops.length === 0) return null
    let currentMin = parseTime(departureTime)
    let prevType = 'BASE'
    let prevId = tour.base_id

    const sortedStops = [...tour.stops].sort((a, b) => a.sequence_order - b.sequence_order)

    for (const stop of sortedStops) {
      const dist = getDistance(prevType, prevId, 'PDV', stop.pdv_id)
      const travelMin = dist?.duration_minutes ?? 0
      currentMin += travelMin

      const pdv = pdvMap.get(stop.pdv_id)
      const dockTime = pdv?.dock_time_minutes ?? DEFAULT_DOCK_TIME
      const unloadPerEqp = pdv?.unload_time_per_eqp_minutes ?? DEFAULT_UNLOAD_PER_EQP
      currentMin += dockTime + stop.eqp_count * unloadPerEqp

      prevType = 'PDV'
      prevId = stop.pdv_id
    }

    /* Retour base / Return to base */
    const lastStop = sortedStops[sortedStops.length - 1]
    const retDist = getDistance('PDV', lastStop.pdv_id, 'BASE', tour.base_id)
    currentMin += retDist?.duration_minutes ?? 0

    return formatTime(currentMin)
  }

  /* Détection chevauchement client-side / Client-side overlap detection */
  const detectOverlap = (tour: Tour, departureTime: string, contractId: number): GanttTour | null => {
    const estReturn = estimateReturn(tour, departureTime)
    if (!estReturn) return null
    for (const tl of timeline) {
      if (tl.contract_id !== contractId) continue
      if (tl.tour_id === tour.id) continue
      if (!tl.departure_time || !tl.return_time) continue
      if (departureTime < tl.return_time && estReturn > tl.departure_time) {
        return tl
      }
    }
    return null
  }

  /* Planifier un tour / Schedule a tour */
  const handleSchedule = async (tourId: number, force = false) => {
    const input = scheduleInputs[tourId]
    if (!input?.time || !input?.contractId) return
    setScheduling(tourId)
    try {
      await api.put(`/tours/${tourId}/schedule`, {
        contract_id: input.contractId,
        departure_time: input.time,
      }, { params: force ? { force: true } : undefined })
      await loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string }; status?: number } }
      const detail = err?.response?.data?.detail
      const status = err?.response?.status
      // Dépassement 10h : demander confirmation / Over 10h: ask confirmation
      if (status === 422 && detail?.startsWith('OVER_10H:')) {
        const totalTime = detail.replace('OVER_10H:', '')
        const confirmed = window.confirm(
          t('tourPlanning.over10hWarning', { total: totalTime })
        )
        if (confirmed) {
          setScheduling(null)
          return handleSchedule(tourId, true)
        }
      // Incompatibilité quai/hayon (blocage dur) / Dock/tailgate incompatibility (hard block)
      } else if (status === 422 && detail?.startsWith('DOCK_TAILGATE:')) {
        const violations = detail.replace('DOCK_TAILGATE:', '')
        alert(t('tourPlanning.dockTailgateError') + '\n\n' + violations.split(' | ').map((v: string) => {
          if (v.startsWith('DOCK_NO_TAILGATE:')) return t('tourPlanning.noDockNeedsTailgate', { pdv: v.replace('DOCK_NO_TAILGATE:', '') })
          if (v.startsWith('DOCK_NO_NICHE_FOLDABLE:')) return t('tourPlanning.noDockNicheNoFoldable', { pdv: v.replace('DOCK_NO_NICHE_FOLDABLE:', '') })
          return v
        }).join('\n'))
      // Hors fenêtre livraison / Outside delivery window
      } else if (status === 422 && detail?.startsWith('DELIVERY_WINDOW:')) {
        const violations = detail.replace('DELIVERY_WINDOW:', '')
        const confirmed = window.confirm(
          t('tourPlanning.deliveryWindowWarning', { violations })
        )
        if (confirmed) {
          setScheduling(null)
          return handleSchedule(tourId, true)
        }
      } else if (detail) {
        alert(detail)
      } else {
        console.error('Failed to schedule tour', e)
      }
    } finally {
      setScheduling(null)
    }
  }

  /* Retirer la planification / Unschedule a tour */
  const handleUnschedule = async (tourId: number) => {
    setScheduling(tourId)
    try {
      await api.delete(`/tours/${tourId}/schedule`)
      await loadData()
    } catch (e) {
      console.error('Failed to unschedule tour', e)
    } finally {
      setScheduling(null)
    }
  }

  /* Recalculer les coûts / Recalculate costs */
  const handleRecalculate = async () => {
    if (!selectedDate || !selectedBaseId) return
    setRecalculating(true)
    try {
      const { data } = await api.post<{ total: number; updated: number }>('/tours/recalculate', null, {
        params: { date: selectedDate, base_id: selectedBaseId },
      })
      await loadData()
      alert(t('tourPlanning.recalculateResult', { total: data.total, updated: data.updated }))
    } catch (e) {
      console.error('Failed to recalculate', e)
    } finally {
      setRecalculating(false)
    }
  }

  const updateInput = (tourId: number, field: 'time' | 'contractId', value: string | number | null) => {
    setScheduleInputs((prev) => ({
      ...prev,
      [tourId]: {
        time: field === 'time' ? (value as string) : (prev[tourId]?.time ?? ''),
        contractId: field === 'contractId' ? (value as number | null) : (prev[tourId]?.contractId ?? null),
      },
    }))
  }

  const getVehicleLabel = (tour: Tour): string => {
    const vt = tour.vehicle_type as VehicleType | undefined
    if (vt && VEHICLE_TYPE_DEFAULTS[vt]) return VEHICLE_TYPE_DEFAULTS[vt].label
    return tour.vehicle_type ?? '—'
  }

  /* Liste des stops d'un tour avec badges reprises / Stop list with pickup badges */
  const renderStopList = (tour: Tour) => {
    const sortedStops = [...(tour.stops ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
    if (sortedStops.length === 0) return null
    return (
      <div className="mt-1 mb-2 space-y-0.5">
        {sortedStops.map((stop, idx) => {
          const pdv = pdvMap.get(stop.pdv_id)
          const hasPickup = stop.pickup_cardboard || stop.pickup_containers || stop.pickup_returns
          return (
            <div key={stop.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] pl-2" style={{ color: 'var(--text-muted)' }}>
              <span className="w-4 text-right font-mono shrink-0" style={{ color: 'var(--text-primary)' }}>{idx + 1}</span>
              <span className="font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                {pdv?.code ?? `#${stop.pdv_id}`}
              </span>
              <span className="truncate max-w-[120px]">— {pdv?.name ?? ''}</span>
              <span className="font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
                {stop.eqp_count} EQP
              </span>
              {hasPickup && (
                <span className="flex items-center gap-1 ml-auto shrink-0">
                  {stop.pickup_cardboard && (
                    <span className="px-1 rounded text-[10px] font-semibold" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'var(--color-primary)' }}>
                      {t('tourPlanning.pickupCardboard')}
                    </span>
                  )}
                  {stop.pickup_containers && (
                    <span className="px-1 rounded text-[10px] font-semibold" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                      {t('tourPlanning.pickupContainers')}
                    </span>
                  )}
                  {stop.pickup_returns && (
                    <span className="px-1 rounded text-[10px] font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'var(--color-danger)' }}>
                      {t('tourPlanning.pickupReturns')}
                    </span>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Barre supérieure: date + base / Top bar */}
      <div
        className="rounded-xl border p-4 flex flex-wrap items-end gap-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('common.date')}
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.dispatchBase')}
          </label>
          <select
            value={selectedBaseId ?? ''}
            onChange={(e) => onBaseChange(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">{t('tourPlanning.allBases')}</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-4 text-right">
          <div>
            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>{t('tourPlanning.unscheduledTours')}</span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{unscheduledTours.length}</span>
          </div>
          <div>
            <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>{t('tourPlanning.scheduledTours')}</span>
            <span className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>{scheduledTours.length}</span>
          </div>
          {scheduledTours.length > 0 && (
            <>
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="px-3 py-2 rounded-lg text-xs font-semibold border transition-all hover:opacity-80 disabled:opacity-40"
                style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                title={t('tourPlanning.recalculateCosts')}
              >
                {recalculating ? '...' : t('tourPlanning.recalculateCosts')}
              </button>
              <button
                onClick={() => setShowPrintPlan(true)}
                className="px-3 py-2 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                title={t('tourPlanning.printPlan.title')}
              >
                {t('tourPlanning.printPlan.print')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Layout split: liste tours (gauche) + Gantt (droite) / Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: 'calc(100vh - 280px)' }}>
        {/* Liste des tours / Tour list */}
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {/* Tours non planifiés / Unscheduled tours */}
          {unscheduledTours.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-warning)' }}>
                {t('tourPlanning.unscheduledTours')} ({unscheduledTours.length})
              </h4>
              {unscheduledTours.map((tour) => {
                const input = scheduleInputs[tour.id] ?? { time: '', contractId: null }
                const estReturn = input.time && input.contractId ? estimateReturn(tour, input.time) : null
                const overlap = input.time && input.contractId ? detectOverlap(tour, input.time, input.contractId) : null
                const contracts = availableContractsMap[tour.id] ?? []
                const selectedContract = contracts.find((c) => c.id === input.contractId)

                return (
                  <div
                    key={tour.id}
                    className="rounded-xl border p-4 mb-2 transition-all"
                    style={{
                      backgroundColor: highlightedTourId === tour.id ? 'rgba(249,115,22,0.05)' : 'var(--bg-secondary)',
                      borderColor: highlightedTourId === tour.id ? 'var(--color-primary)' : 'var(--border-color)',
                    }}
                    onClick={() => setHighlightedTourId(tour.id)}
                  >
                    {/* En-tête tour / Tour header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{tour.code}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                          {tour.stops?.length ?? 0} {t('tourPlanning.stops')} | {tour.total_eqp ?? 0} EQP | {tour.total_km ?? 0} km
                        </span>
                      </div>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'var(--color-primary)' }}
                      >
                        {getVehicleLabel(tour)} ({tour.capacity_eqp ?? 0} EQP)
                      </span>
                    </div>

                    {/* Liste des stops / Stop list */}
                    {renderStopList(tour)}

                    {/* Sélection contrat / Contract selection */}
                    <div className="flex flex-col gap-1 mb-2">
                      <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {t('tourPlanning.assignContract')}
                        <span className="ml-1" style={{ color: 'var(--color-primary)' }}>
                          ({contracts.length} {t('tourPlanning.available')})
                        </span>
                      </label>
                      <select
                        value={input.contractId ?? ''}
                        onChange={(e) => updateInput(tour.id, 'contractId', e.target.value ? Number(e.target.value) : null)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border px-2 py-1.5 text-sm"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      >
                        <option value="">{t('tourPlanning.selectContract')}</option>
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.transporter_name} ({c.vehicle_code ?? c.vehicle_name ?? ''})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Heure de départ / Departure time */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {t('tourPlanning.departureTime')}
                      </label>
                      <input
                        type="time"
                        value={input.time}
                        onChange={(e) => updateInput(tour.id, 'time', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border px-2 py-1.5 text-sm w-40"
                        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    {/* Info contrat sélectionné / Selected contract info */}
                    {selectedContract && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {selectedContract.transporter_name} — {selectedContract.vehicle_code ?? selectedContract.code}
                        {selectedContract.fixed_daily_cost != null && ` | ${selectedContract.fixed_daily_cost}€/j`}
                        {selectedContract.cost_per_km != null && ` + ${selectedContract.cost_per_km}€/km`}
                      </div>
                    )}

                    {/* Retour estimé / Estimated return */}
                    {estReturn && (
                      <div className="mt-2 text-xs" style={{ color: estReturn > '22:00' ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                        {t('tourPlanning.estimatedReturn')}: <span className="font-bold">{estReturn}</span>
                        {input.time && (
                          <span className="ml-2">
                            ({formatDuration(parseTime(estReturn) - parseTime(input.time) + (parseTime(estReturn) < parseTime(input.time) ? 24 * 60 : 0))})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Avertissement chevauchement / Overlap warning */}
                    {overlap && (
                      <div
                        className="mt-2 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2"
                        style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                      >
                        <span className="font-bold">⚠</span>
                        {t('tourPlanning.overlapWarning', { code: overlap.code, from: overlap.departure_time, to: overlap.return_time })}
                      </div>
                    )}

                    {/* Bouton planifier / Schedule button */}
                    <div className="mt-3 flex gap-2">
                      <button
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                        style={{
                          backgroundColor: input.time && input.contractId && !overlap ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                          color: input.time && input.contractId && !overlap ? '#fff' : 'var(--text-muted)',
                        }}
                        disabled={!input.time || !input.contractId || !!overlap || scheduling === tour.id}
                        onClick={(e) => { e.stopPropagation(); handleSchedule(tour.id) }}
                      >
                        {scheduling === tour.id ? '...' : t('tourPlanning.scheduleTour')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tours planifiés / Scheduled tours */}
          {scheduledTours.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--color-success)' }}>
                {t('tourPlanning.scheduledTours')} ({scheduledTours.length})
              </h4>
              {scheduledTours.map((tour) => {
                const tourContract = tour.contract_id ? contractMap.get(tour.contract_id) : null
                const windowViolations = deliveryWindowViolations.get(tour.id)
                return (
                <div
                  key={tour.id}
                  className="rounded-xl border p-4 mb-2 cursor-pointer transition-all"
                  style={{
                    backgroundColor: windowViolations ? 'rgba(239,68,68,0.05)' : highlightedTourId === tour.id ? 'rgba(34,197,94,0.05)' : 'var(--bg-secondary)',
                    borderColor: windowViolations ? 'var(--color-danger)' : highlightedTourId === tour.id ? 'var(--color-success)' : 'var(--border-color)',
                  }}
                  onClick={() => setHighlightedTourId(tour.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{tour.code}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                        {tour.stops?.length ?? 0} {t('tourPlanning.stops')} | {tour.total_eqp ?? 0} EQP | {tour.total_km ?? 0} km
                      </span>
                      <span className="text-xs ml-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {getVehicleLabel(tour)}
                      </span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        {tour.departure_time} → {tour.return_time}
                      </span>
                      {tour.total_duration_minutes != null && (
                        <span className="block" style={{ color: 'var(--text-muted)' }}>
                          {formatDuration(tour.total_duration_minutes)}
                          {tour.total_cost != null && (
                            <span
                              className="ml-1 cursor-pointer underline decoration-dotted hover:opacity-80"
                              style={{ color: 'var(--color-primary)' }}
                              onClick={(e) => { e.stopPropagation(); setCostTourId(tour.id) }}
                              title={t('costBreakdown.title')}
                            >
                              {tour.total_cost}€
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contrat assigné / Assigned contract */}
                  {tourContract && (
                    <div className="mt-2 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span className="font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}>
                        {tourContract.code}
                      </span>
                      <span>{tourContract.transporter_name}</span>
                      {tourContract.vehicle_code && <span>— {tourContract.vehicle_code}</span>}
                    </div>
                  )}

                  {/* Avertissement fenêtre de livraison / Delivery window warning */}
                  {windowViolations && (
                    <div
                      className="mt-2 rounded-lg px-3 py-1.5 text-xs"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                    >
                      <span className="font-bold">⚠</span>{' '}
                      {windowViolations.map((v, i) => (
                        <span key={i}>{i > 0 && ' | '}{v}</span>
                      ))}
                    </div>
                  )}

                  {/* Liste des stops / Stop list */}
                  {renderStopList(tour)}

                  <div className="mt-2 flex justify-end">
                    <button
                      className="px-3 py-1 rounded-lg text-xs border transition-all hover:opacity-80"
                      style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                      disabled={scheduling === tour.id}
                      onClick={(e) => { e.stopPropagation(); handleUnschedule(tour.id) }}
                    >
                      {scheduling === tour.id ? '...' : t('tourPlanning.unscheduleTour')}
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}

          {/* Aucun tour / No tours */}
          {tours.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {t('tourPlanning.noToursToday')}
              </p>
            </div>
          )}
        </div>

        {/* Gantt / Gantt chart */}
        <TourGantt
          tours={timeline}
          highlightedTourId={highlightedTourId}
          onTourClick={setHighlightedTourId}
          warningTourIds={new Set(deliveryWindowViolations.keys())}
        />
      </div>

      {/* Plan de tour imprimable / Printable tour plan */}
      {showPrintPlan && (
        <TourPrintPlan
          tours={tours}
          pdvs={pdvs}
          contracts={allContracts}
          bases={bases}
          distances={distances}
          volumes={allVolumes}
          date={selectedDate}
          onClose={() => setShowPrintPlan(false)}
        />
      )}

      {costTourId && (
        <CostBreakdown tourId={costTourId} onClose={() => setCostTourId(null)} />
      )}
    </div>
  )
}
