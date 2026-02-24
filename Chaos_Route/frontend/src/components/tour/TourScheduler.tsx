/* Ordonnancement des tours — vue postier / Tour scheduling — postman-style view */

import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { TourGantt, type GanttTour } from './TourGantt'
import { TourPrintPlan } from './TourPrintPlan'
import { formatDuration, parseTime, formatTime, formatDate, DEFAULT_DOCK_TIME, DEFAULT_UNLOAD_PER_EQP } from '../../utils/tourTimeUtils'
import { VEHICLE_TYPE_DEFAULTS, TEMPERATURE_TYPE_LABELS } from '../../types'
import api from '../../services/api'
import { CostBreakdown } from './CostBreakdown'
import type { Tour, BaseLogistics, Contract, DistanceEntry, PDV, VehicleType, TemperatureType, Volume } from '../../types'

/* Filtres activité / Activity filter options */
const ACTIVITY_FILTERS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'SEC', label: 'Sec' },
  { key: 'FRAIS', label: 'Frais' },
  { key: 'GEL', label: 'Gel' },
  { key: 'BI_TEMP', label: 'Bi-temp' },
  { key: 'TRI_TEMP', label: 'Tri-temp' },
]

/* --- Préférences persistées / Persisted preferences --- */

const PREFS_KEY = 'scheduler-prefs'

interface SchedulerPrefs { leftWidth: number }

function loadPrefs(): SchedulerPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.leftWidth) return parsed
    }
  } catch { /* ignore */ }
  return { leftWidth: 440 }
}

function savePrefs(p: SchedulerPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p))
}

/* --- Composant principal / Main component --- */

interface TourSchedulerProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

export function TourScheduler({ selectedDate, onDateChange }: TourSchedulerProps) {
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
  const [scheduleInputs, setScheduleInputs] = useState<Record<number, { time: string; contractId: number | null; deliveryDate: string }>>({})
  const [scheduling, setScheduling] = useState<number | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [costTourId, setCostTourId] = useState<number | null>(null)
  const [showPrintPlan, setShowPrintPlan] = useState(false)
  /* Contrats disponibles par tour (chargés selon vehicle_type) / Available contracts per tour */
  const [availableContractsMap, setAvailableContractsMap] = useState<Record<number, Contract[]>>({})

  /* Filtre activité / Activity filter */
  const [activityFilter, setActivityFilter] = useState('ALL')

  /* Expansion boites / Box expansion */
  const [expandedTourId, setExpandedTourId] = useState<number | null>(null)

  /* Split prefs */
  const [prefs, setPrefs] = useState<SchedulerPrefs>(loadPrefs)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  /* Refs mesure hauteurs / Height measurement refs */
  const boxContainerRef = useRef<HTMLDivElement>(null)
  const [measuredRowHeights, setMeasuredRowHeights] = useState<number[]>([])
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(0)

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
    if (!selectedDate) {
      setTours([])
      setTimeline([])
      return
    }
    try {
      const [toursRes, timelineRes] = await Promise.all([
        api.get<Tour[]>('/tours/', { params: { date: selectedDate } }),
        api.get<GanttTour[]>('/tours/timeline', { params: { date: selectedDate } }),
      ])
      setTours(toursRes.data)
      setTimeline(timelineRes.data)
    } catch {
      setTours([])
      setTimeline([])
    }
  }, [selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  /* Charger contrats disponibles pour chaque tour non planifié / Load available contracts per unscheduled tour */
  const loadContractsForTour = useCallback(async (tour: Tour, deliveryDate?: string) => {
    if (!tour.base_id || !tour.vehicle_type) return
    const checkDate = deliveryDate || tour.delivery_date || selectedDate
    if (!checkDate) return
    try {
      const { data } = await api.get<Contract[]>('/tours/available-contracts', {
        params: {
          date: checkDate,
          base_id: tour.base_id,
          vehicle_type: tour.vehicle_type,
          temperature_type: tour.temperature_type || undefined,
          tour_id: tour.id,
        },
      })
      setAvailableContractsMap((prev) => ({ ...prev, [tour.id]: data }))
    } catch {
      setAvailableContractsMap((prev) => ({ ...prev, [tour.id]: [] }))
    }
  }, [selectedDate])

  /* Calculer la date de livraison par défaut (dispatch_date + 1 jour le plus fréquent) /
     Compute default delivery date (most frequent dispatch_date + 1 day) */
  const computeDefaultDeliveryDate = useCallback((tour: Tour): string => {
    const tourVolumes = allVolumes.filter((v) => v.tour_id === tour.id && v.dispatch_date)
    if (tourVolumes.length === 0) return ''
    const freq = new Map<string, number>()
    tourVolumes.forEach((v) => {
      const d = v.dispatch_date!
      freq.set(d, (freq.get(d) ?? 0) + 1)
    })
    let best = ''
    let bestCount = 0
    freq.forEach((count, d) => { if (count > bestCount) { best = d; bestCount = count } })
    if (!best) return ''
    const dt = new Date(best)
    dt.setDate(dt.getDate() + 1)
    return dt.toISOString().slice(0, 10)
  }, [allVolumes])

  /* Charger contrats pour tous les tours non planifiés / Load contracts for all unscheduled tours */
  useEffect(() => {
    const unscheduled = tours.filter((t) => !t.departure_time && !t.contract_id)
    unscheduled.forEach((tour) => {
      const dd = scheduleInputs[tour.id]?.deliveryDate || computeDefaultDeliveryDate(tour)
      loadContractsForTour(tour, dd)
    })
  }, [tours, loadContractsForTour])

  /* Auto-init deliveryDate pour les tours non-planifiés / Auto-init deliveryDate for unscheduled tours */
  useEffect(() => {
    const unscheduled = tours.filter((t) => !t.departure_time && !t.contract_id)
    setScheduleInputs((prev) => {
      const next = { ...prev }
      for (const tour of unscheduled) {
        if (!next[tour.id]?.deliveryDate) {
          next[tour.id] = {
            time: next[tour.id]?.time ?? '',
            contractId: next[tour.id]?.contractId ?? null,
            deliveryDate: computeDefaultDeliveryDate(tour),
          }
        }
      }
      return next
    })
  }, [tours, computeDefaultDeliveryDate])

  /* Séparer tours planifiés et non-planifiés / Split scheduled vs unscheduled */
  const unscheduledTours = useMemo(() => tours.filter((t) => !t.departure_time), [tours])
  const scheduledTours = useMemo(() => tours.filter((t) => t.departure_time), [tours])

  /* Filtrer par activité / Filter by activity (temperature_type) */
  const filteredTours = useMemo(() => {
    if (activityFilter === 'ALL') return tours
    return tours.filter(t => t.temperature_type === activityFilter)
  }, [tours, activityFilter])

  /* Liste unique triée: planifiés d'abord par heure départ, puis non-planifiés /
     Unified sorted list: scheduled first by departure time, then unscheduled */
  const sortedTours = useMemo(() => {
    const scheduled = filteredTours.filter(t => t.departure_time)
      .sort((a, b) => parseTime(a.departure_time!) - parseTime(b.departure_time!))
    const unscheduled = filteredTours.filter(t => !t.departure_time)
      .sort((a, b) => a.id - b.id)
    return [...scheduled, ...unscheduled]
  }, [filteredTours])

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
        delivery_date: input.deliveryDate || null,
      }, { params: force ? { force: true } : undefined })
      await loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string }; status?: number } }
      const detail = err?.response?.data?.detail
      const status = err?.response?.status
      if (status === 422 && detail?.startsWith('OVER_10H:')) {
        const totalTime = detail.replace('OVER_10H:', '')
        const confirmed = window.confirm(
          t('tourPlanning.over10hWarning', { total: totalTime })
        )
        if (confirmed) {
          setScheduling(null)
          return handleSchedule(tourId, true)
        }
      } else if (status === 422 && detail?.startsWith('DOCK_TAILGATE:')) {
        const violations = detail.replace('DOCK_TAILGATE:', '')
        alert(t('tourPlanning.dockTailgateError') + '\n\n' + violations.split(' | ').map((v: string) => {
          if (v.startsWith('DOCK_NO_TAILGATE:')) return t('tourPlanning.noDockNeedsTailgate', { pdv: v.replace('DOCK_NO_TAILGATE:', '') })
          if (v.startsWith('DOCK_NO_NICHE_FOLDABLE:')) return t('tourPlanning.noDockNicheNoFoldable', { pdv: v.replace('DOCK_NO_NICHE_FOLDABLE:', '') })
          return v
        }).join('\n'))
      } else if (status === 422 && detail?.startsWith('DELIVERY_WINDOW:')) {
        const violations = detail.replace('DELIVERY_WINDOW:', '')
        const confirmed = window.confirm(
          t('tourPlanning.deliveryWindowWarning', { violations })
        )
        if (confirmed) {
          setScheduling(null)
          return handleSchedule(tourId, true)
        }
      } else if (status === 422 && detail?.startsWith('CONTRACT_UNAVAILABLE:')) {
        const unavailDate = detail.replace('CONTRACT_UNAVAILABLE:', '')
        alert(`Contrat indisponible le ${unavailDate}`)
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

  /* Valider un tour / Validate a tour */
  const handleValidate = async (tourId: number) => {
    setScheduling(tourId)
    try {
      await api.put(`/tours/${tourId}/validate`)
      await loadData()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(detail || 'Erreur validation')
    } finally {
      setScheduling(null)
    }
  }

  /* Remettre en DRAFT / Revert to DRAFT */
  const handleRevertDraft = async (tourId: number) => {
    setScheduling(tourId)
    try {
      await api.put(`/tours/${tourId}/revert-draft`)
      await loadData()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (detail) alert(detail)
      else console.error('Failed to revert tour', e)
    } finally {
      setScheduling(null)
    }
  }

  /* Valider tous les tours DRAFT / Validate all DRAFT tours */
  const [validatingBatch, setValidatingBatch] = useState(false)
  const handleValidateBatch = async () => {
    if (!selectedDate) return
    setValidatingBatch(true)
    try {
      const { data } = await api.post<{ validated: number }>('/tours/validate-batch', null, {
        params: { date: selectedDate },
      })
      await loadData()
      alert(`${data.validated} tour(s) valide(s)`)
    } catch (e) {
      console.error('Failed to validate batch', e)
    } finally {
      setValidatingBatch(false)
    }
  }

  /* Nombre de tours DRAFT planifiés / Count of scheduled DRAFT tours */
  const draftScheduledCount = useMemo(
    () => scheduledTours.filter((t) => t.status === 'DRAFT').length,
    [scheduledTours]
  )

  /* Recalculer les coûts / Recalculate costs */
  const handleRecalculate = async () => {
    if (!selectedDate) return
    setRecalculating(true)
    try {
      const { data } = await api.post<{ total: number; updated: number }>('/tours/recalculate', null, {
        params: { date: selectedDate },
      })
      await loadData()
      alert(t('tourPlanning.recalculateResult', { total: data.total, updated: data.updated }))
    } catch (e) {
      console.error('Failed to recalculate', e)
    } finally {
      setRecalculating(false)
    }
  }

  const updateInput = (tourId: number, field: 'time' | 'contractId' | 'deliveryDate', value: string | number | null) => {
    setScheduleInputs((prev) => ({
      ...prev,
      [tourId]: {
        time: field === 'time' ? (value as string) : (prev[tourId]?.time ?? ''),
        contractId: field === 'deliveryDate' ? null : (field === 'contractId' ? (value as number | null) : (prev[tourId]?.contractId ?? null)),
        deliveryDate: field === 'deliveryDate' ? (value as string) : (prev[tourId]?.deliveryDate ?? ''),
      },
    }))
    // Recharger contrats si la date de livraison change / Reload contracts when delivery date changes
    if (field === 'deliveryDate' && value) {
      const tour = tours.find(t => t.id === tourId)
      if (tour) loadContractsForTour(tour, value as string)
    }
  }

  const getVehicleLabel = (tour: Tour): string => {
    const vt = tour.vehicle_type as VehicleType | undefined
    if (vt && VEHICLE_TYPE_DEFAULTS[vt]) return VEHICLE_TYPE_DEFAULTS[vt].label
    return tour.vehicle_type ?? '—'
  }

  /* Liste des stops d'un tour avec badges reprises + dispatch info / Stop list with pickup badges + dispatch info */
  const renderStopList = (tour: Tour) => {
    const sortedStops = [...(tour.stops ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
    if (sortedStops.length === 0) return null
    return (
      <div className="mt-1 mb-2 space-y-0.5">
        {sortedStops.map((stop, idx) => {
          const pdv = pdvMap.get(stop.pdv_id)
          const hasPickup = stop.pickup_cardboard || stop.pickup_containers || stop.pickup_returns || stop.pickup_consignment
          /* Dispatch info des volumes liés au stop / Dispatch info from volumes linked to this stop */
          const stopVolumes = allVolumes.filter((v) => v.tour_id === tour.id && v.pdv_id === stop.pdv_id)
          const dispatchInfo = stopVolumes.find((v) => v.dispatch_date)
          return (
            <div key={stop.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] pl-2" style={{ color: 'var(--text-muted)' }}>
              <span className="w-4 text-right font-mono shrink-0" style={{ color: 'var(--text-primary)' }}>{idx + 1}</span>
              <span className="font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
                {pdv?.code ?? `#${stop.pdv_id}`}
              </span>
              <span className="truncate max-w-[120px]">— {pdv?.name ?? ''}</span>
              {/* Heures arrivée → départ / Arrival → departure times */}
              {stop.arrival_time && (
                <span className="font-mono text-[10px] shrink-0" style={{ color: 'var(--color-primary)' }}>
                  {stop.arrival_time}{stop.departure_time ? ` → ${stop.departure_time}` : ''}
                </span>
              )}
              <span className="font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
                {stop.eqp_count} EQC
              </span>
              {dispatchInfo && (
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {t('tourPlanning.dispatchInfo')} {formatDate(dispatchInfo.dispatch_date)}{dispatchInfo.dispatch_time ? ` ${dispatchInfo.dispatch_time}` : ''}
                </span>
              )}
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
                  {stop.pickup_consignment && (
                    <span className="px-1 rounded text-[10px] font-semibold" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                      Consignes
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

  /* Gantt data triée dans le même ordre que sortedTours / Gantt data sorted same as sortedTours */
  const ganttData = useMemo(() => {
    const timelineMap = new Map(timeline.map(t => [t.tour_id, t]))
    return sortedTours.map(tour =>
      timelineMap.get(tour.id) ?? {
        tour_id: tour.id,
        code: tour.code,
        contract_id: tour.contract_id ?? null,
        vehicle_type: tour.vehicle_type ?? null,
        capacity_eqp: tour.capacity_eqp ?? null,
        contract_code: null,
        vehicle_code: null,
        vehicle_name: null,
        transporter_name: null,
        departure_time: tour.departure_time ?? null,
        return_time: tour.return_time ?? null,
        total_eqp: tour.total_eqp ?? null,
        total_km: tour.total_km ?? null,
        total_cost: tour.total_cost ?? null,
        total_duration_minutes: tour.total_duration_minutes ?? null,
        delivery_date: tour.delivery_date ?? null,
        tour_date: selectedDate,
        status: tour.status ?? 'DRAFT',
        stops: tour.stops?.map(s => ({
          id: s.id,
          pdv_id: s.pdv_id,
          pdv_code: pdvMap.get(s.pdv_id)?.code,
          sequence_order: s.sequence_order,
          eqp_count: s.eqp_count,
          arrival_time: s.arrival_time ?? null,
          departure_time: s.departure_time ?? null,
        })) ?? [],
      }
    )
  }, [sortedTours, timeline, selectedDate, pdvMap])

  /* Redimensionnement split par pixels / Split resize in pixels */
  const handleSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = splitContainerRef.current
    if (!container) return

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const px = Math.max(320, Math.min(rect.width * 0.6, ev.clientX - rect.left))
      setPrefs((prev) => {
        const next = { ...prev, leftWidth: Math.round(px) }
        savePrefs(next)
        return next
      })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  /* Mesurer les hauteurs de chaque boite / Measure each box height for Gantt alignment */
  useLayoutEffect(() => {
    const container = boxContainerRef.current
    if (!container) return
    const boxes = container.querySelectorAll<HTMLElement>('[data-tour-id]')
    const heights: number[] = []
    boxes.forEach(box => heights.push(box.getBoundingClientRect().height))
    setMeasuredRowHeights(heights)
    /* Mesurer header (espace avant la première boite) / Measure header offset */
    const headerEl = container.querySelector<HTMLElement>('[data-gantt-header]')
    setMeasuredHeaderHeight(headerEl ? headerEl.getBoundingClientRect().height : 0)
  }, [sortedTours, expandedTourId, scheduleInputs])

  /* Scroll-to-view quand highlight depuis Gantt / Scroll into view on Gantt click */
  useEffect(() => {
    if (highlightedTourId == null) return
    const el = boxContainerRef.current?.querySelector<HTMLElement>(`[data-tour-id="${highlightedTourId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [highlightedTourId])

  /* Inline PDV summary for collapsed box */
  const pdvSummary = (tour: Tour): string => {
    const stops = [...(tour.stops ?? [])].sort((a, b) => a.sequence_order - b.sequence_order)
    return stops.map(s => {
      const pdv = pdvMap.get(s.pdv_id)
      return `${pdv?.code ?? `#${s.pdv_id}`}(${s.eqp_count})`
    }).join(' ')
  }

  return (
    <div className="space-y-4">
      {/* Barre supérieure: date + filtre activité / Top bar: date + activity filter */}
      <div
        className="rounded-xl border p-4 flex flex-wrap items-end gap-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Date de répartition
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Filtre activité / Activity filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Activité
          </label>
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f.key}
                className="px-3 py-2 text-xs font-medium transition-all"
                style={{
                  backgroundColor: activityFilter === f.key ? 'var(--color-primary)' : 'var(--bg-primary)',
                  color: activityFilter === f.key ? '#fff' : 'var(--text-secondary)',
                }}
                onClick={() => setActivityFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
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
              {draftScheduledCount > 0 && (
                <button
                  onClick={handleValidateBatch}
                  disabled={validatingBatch}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                >
                  {validatingBatch ? '...' : `Valider tout (${draftScheduledCount})`}
                </button>
              )}
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

      {/* Layout split redimensionnable / Resizable split layout */}
      <div ref={splitContainerRef} className="flex" style={{ alignItems: 'flex-start', minHeight: 'calc(100vh - 280px)' }}>
        {/* Panneau gauche — Boites collapsibles / Left panel — Collapsible boxes */}
        <div className="overflow-y-auto flex-shrink-0" style={{ width: `${prefs.leftWidth}px`, maxHeight: 'calc(100vh - 300px)' }}>
          <div ref={boxContainerRef}>
            {/* Header invisible pour alignement Gantt / Invisible header for Gantt alignment */}
            <div data-gantt-header style={{ height: 0 }} />

            {sortedTours.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('tourPlanning.noToursToday')}
                </p>
              </div>
            ) : (
              sortedTours.map((tour) => {
                const isScheduled = !!tour.departure_time
                const isExpanded = expandedTourId === tour.id
                const isHighlighted = highlightedTourId === tour.id
                const windowViolations = deliveryWindowViolations.get(tour.id)
                const tourContract = tour.contract_id ? contractMap.get(tour.contract_id) : null

                /* Inputs pour les non-planifiés / Inputs for unscheduled */
                const input = scheduleInputs[tour.id] ?? { time: '', contractId: null, deliveryDate: '' }
                const contracts = availableContractsMap[tour.id] ?? []
                const selectedContract = contracts.find((c) => c.id === input.contractId)
                const estReturn = !isScheduled && input.time && input.contractId ? estimateReturn(tour, input.time) : null
                const overlap = !isScheduled && input.time && input.contractId ? detectOverlap(tour, input.time, input.contractId) : null

                return (
                  <div
                    key={tour.id}
                    data-tour-id={tour.id}
                    className="rounded-lg border mb-1 transition-all"
                    style={{
                      backgroundColor: windowViolations
                        ? 'rgba(239,68,68,0.05)'
                        : isHighlighted
                          ? 'rgba(249,115,22,0.05)'
                          : 'var(--bg-secondary)',
                      borderColor: windowViolations
                        ? 'var(--color-danger)'
                        : isHighlighted
                          ? 'var(--color-primary)'
                          : 'var(--border-color)',
                    }}
                    onClick={() => setHighlightedTourId(tour.id)}
                  >
                    {/* === Ligne 1 — Résumé compact / Line 1 — Compact summary === */}
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      {/* Flèche expand */}
                      <button
                        className="text-xs shrink-0 w-4 text-center"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={(e) => { e.stopPropagation(); setExpandedTourId(isExpanded ? null : tour.id) }}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>

                      {/* Code tour */}
                      <span className="text-sm font-bold shrink-0" style={{ color: 'var(--color-primary)' }}>
                        {tour.code}
                      </span>

                      {/* Badge véhicule */}
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'var(--color-primary)' }}
                      >
                        {getVehicleLabel(tour)}({tour.capacity_eqp ?? 0})
                      </span>

                      {/* Badge activité / Activity badge */}
                      {tour.temperature_type && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            backgroundColor: tour.temperature_type === 'GEL' ? 'rgba(30,64,175,0.15)'
                              : tour.temperature_type === 'FRAIS' ? 'rgba(59,130,246,0.15)'
                              : 'rgba(249,115,22,0.15)',
                            color: tour.temperature_type === 'GEL' ? '#1e40af'
                              : tour.temperature_type === 'FRAIS' ? '#3b82f6'
                              : 'var(--color-primary)',
                          }}
                        >
                          {TEMPERATURE_TYPE_LABELS[tour.temperature_type as TemperatureType] ?? tour.temperature_type}
                        </span>
                      )}

                      {/* PDVs inline (tronqué) */}
                      <span className="text-[10px] truncate min-w-0" style={{ color: 'var(--text-muted)', maxWidth: '120px' }}>
                        {pdvSummary(tour)}
                      </span>

                      {/* Total EQC + km */}
                      <span className="ml-auto text-xs font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
                        = {tour.total_eqp ?? 0} EQC
                      </span>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {tour.total_km ?? 0} km
                      </span>

                      {/* Badge statut pour planifiés / Status badge for scheduled */}
                      {isScheduled && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0"
                          style={{
                            backgroundColor: tour.status === 'VALIDATED' ? 'rgba(34,197,94,0.15)' : 'rgba(249,115,22,0.15)',
                            color: tour.status === 'VALIDATED' ? 'var(--color-success)' : 'var(--color-warning)',
                          }}
                        >
                          {tour.status === 'VALIDATED' ? 'Valide' : 'Brouillon'}
                        </span>
                      )}

                      {/* Indicateur violation fenêtre / Delivery window violation dot */}
                      {windowViolations && (
                        <span
                          className="shrink-0 w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-danger)' }}
                          title={windowViolations.join(' | ')}
                        />
                      )}
                    </div>

                    {/* === Ligne 2 — Actions inline (no wrap) / Line 2 — Inline actions (no wrap) === */}
                    <div className="flex items-center gap-2 px-3 pb-1.5 overflow-hidden">
                      {!isScheduled ? (
                        /* --- Non planifié: contrat + date + heure + bouton planifier --- */
                        <>
                          <select
                            value={input.contractId ?? ''}
                            onChange={(e) => updateInput(tour.id, 'contractId', e.target.value ? Number(e.target.value) : null)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border px-1.5 py-1 text-[11px] min-w-0"
                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', maxWidth: '150px' }}
                          >
                            <option value="">{t('tourPlanning.selectContract')}</option>
                            {contracts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} — {c.transporter_name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={input.deliveryDate}
                            onChange={(e) => updateInput(tour.id, 'deliveryDate', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border px-1.5 py-1 text-[11px] w-[120px]"
                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          />
                          <input
                            type="time"
                            value={input.time}
                            onChange={(e) => updateInput(tour.id, 'time', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border px-1.5 py-1 text-[11px] w-[90px]"
                            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                          />
                          <button
                            className="px-2 py-1 rounded text-[11px] font-semibold transition-all disabled:opacity-40"
                            style={{
                              backgroundColor: input.time && input.contractId && !overlap ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                              color: input.time && input.contractId && !overlap ? '#fff' : 'var(--text-muted)',
                            }}
                            disabled={!input.time || !input.contractId || !!overlap || scheduling === tour.id}
                            onClick={(e) => { e.stopPropagation(); handleSchedule(tour.id) }}
                          >
                            {scheduling === tour.id ? '...' : 'Planifier'}
                          </button>
                          {/* Retour estimé inline / Inline estimated return */}
                          {estReturn && (
                            <span className="text-[10px]" style={{ color: estReturn > '22:00' ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                              Ret: <span className="font-bold">{estReturn}</span>
                            </span>
                          )}
                          {overlap && (
                            <span className="text-[10px] font-bold" style={{ color: 'var(--color-danger)' }}>
                              Chevauche {overlap.code}
                            </span>
                          )}
                        </>
                      ) : tour.departure_signal_time ? (
                        /* --- Verrouillé (top départ validé) --- */
                        <>
                          {tourContract && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}>
                              {tourContract.code}
                            </span>
                          )}
                          <span className="text-[11px] font-mono" style={{ color: 'var(--text-primary)' }}>
                            {tour.departure_time} → {tour.return_time}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}>
                            Top depart valide
                          </span>
                        </>
                      ) : (
                        /* --- Planifié DRAFT ou VALIDATED --- */
                        <>
                          {tourContract && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}>
                              {tourContract.code}
                            </span>
                          )}
                          <span className="text-[11px] font-mono" style={{ color: 'var(--text-primary)' }}>
                            {tour.departure_time} → {tour.return_time}
                          </span>
                          {tour.total_duration_minutes != null && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {formatDuration(tour.total_duration_minutes)}
                              {tour.total_cost != null && (
                                <span
                                  className="ml-1 cursor-pointer underline decoration-dotted hover:opacity-80"
                                  style={{ color: 'var(--color-primary)' }}
                                  onClick={(e) => { e.stopPropagation(); setCostTourId(tour.id) }}
                                  title="Détail coûts"
                                >
                                  {tour.total_cost}€
                                </span>
                              )}
                            </span>
                          )}
                          {tour.delivery_date && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              Livr: {formatDate(tour.delivery_date)}
                            </span>
                          )}
                          <span className="ml-auto" />
                          {tour.status === 'DRAFT' ? (
                            <button
                              className="px-2 py-0.5 rounded text-[11px] font-semibold border transition-all hover:opacity-80"
                              style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                              disabled={scheduling === tour.id}
                              onClick={(e) => { e.stopPropagation(); handleValidate(tour.id) }}
                            >
                              {scheduling === tour.id ? '...' : 'Valider'}
                            </button>
                          ) : (
                            <button
                              className="px-2 py-0.5 rounded text-[11px] border transition-all hover:opacity-80"
                              style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                              disabled={scheduling === tour.id}
                              onClick={(e) => { e.stopPropagation(); handleRevertDraft(tour.id) }}
                            >
                              {scheduling === tour.id ? '...' : 'Defaire'}
                            </button>
                          )}
                          <button
                            className="px-2 py-0.5 rounded text-[11px] border transition-all hover:opacity-80"
                            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                            disabled={scheduling === tour.id}
                            onClick={(e) => { e.stopPropagation(); handleUnschedule(tour.id) }}
                          >
                            {scheduling === tour.id ? '...' : 'Retirer'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* === Zone expanded / Expanded area === */}
                    {isExpanded && (
                      <div className="px-3 pb-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        {/* Avertissement fenêtre livraison / Delivery window warning */}
                        {windowViolations && (
                          <div className="mt-1 mb-1 text-[10px] font-bold" style={{ color: 'var(--color-danger)' }}>
                            {windowViolations.map((v, i) => (
                              <span key={i}>{i > 0 && ' | '}{v}</span>
                            ))}
                          </div>
                        )}

                        {/* Stops détaillés / Detailed stops */}
                        {renderStopList(tour)}

                        {/* Info contrat pour non-planifié / Contract info for unscheduled */}
                        {!isScheduled && selectedContract && (
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {selectedContract.transporter_name} — {selectedContract.vehicle_code ?? selectedContract.code}
                            {selectedContract.fixed_daily_cost != null && ` | ${selectedContract.fixed_daily_cost}€/j`}
                            {selectedContract.cost_per_km != null && ` + ${selectedContract.cost_per_km}€/km`}
                          </div>
                        )}

                        {/* Info contrat pour planifié / Contract info for scheduled */}
                        {isScheduled && tourContract && (
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {tourContract.transporter_name} — {tourContract.vehicle_code ?? tourContract.code}
                            {tourContract.vehicle_name && ` (${tourContract.vehicle_name})`}
                          </div>
                        )}

                        {/* Retour estimé détaillé pour non-planifié / Detailed estimated return for unscheduled */}
                        {!isScheduled && estReturn && (
                          <div className="mt-1 text-xs" style={{ color: estReturn > '22:00' ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                            {t('tourPlanning.estimatedReturn')}: <span className="font-bold">{estReturn}</span>
                            {input.time && (
                              <span className="ml-2">
                                ({formatDuration(parseTime(estReturn) - parseTime(input.time) + (parseTime(estReturn) < parseTime(input.time) ? 24 * 60 : 0))})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Avertissement chevauchement détaillé / Detailed overlap warning */}
                        {!isScheduled && overlap && (
                          <div
                            className="mt-1 rounded px-2 py-1 text-xs flex items-center gap-2"
                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
                          >
                            <span className="font-bold">!</span>
                            {t('tourPlanning.overlapWarning', { code: overlap.code, from: overlap.departure_time, to: overlap.return_time })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Séparateur redimensionnable / Draggable split handle */}
        <div
          className="flex-shrink-0 cursor-col-resize flex items-center justify-center group"
          style={{ width: '12px' }}
          onMouseDown={handleSplitResize}
        >
          <div className="w-1 h-12 rounded-full transition-colors group-hover:bg-orange-500/50" style={{ backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* Panneau droit — Gantt SVG / Right panel — SVG Gantt */}
        <div className="min-w-[200px] flex-1">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
            <TourGantt
              tours={ganttData}
              highlightedTourId={highlightedTourId}
              onTourClick={setHighlightedTourId}
              warningTourIds={new Set(deliveryWindowViolations.keys())}
              rowHeights={measuredRowHeights}
              headerHeight={measuredHeaderHeight}
              expandedTourId={expandedTourId}
            />
          </div>
        </div>
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
