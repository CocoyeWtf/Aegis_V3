/* Constructeur de tour (Phase Construction) / Tour builder (Construction phase — PDV first, vehicle after) */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../hooks/useApi'
import { useTour } from '../../hooks/useTour'
import { useAppStore } from '../../stores/useAppStore'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import { VehicleSelector } from './VehicleSelector'
import { VolumePanel } from './VolumePanel'
import { TourSummary } from './TourSummary'
import { TourValidation } from './TourValidation'
import { ResizeHandle } from './ResizeHandle'
import { MapView } from '../map/MapView'
import { useDetachedMap } from '../../hooks/useDetachedMap'
import { create } from '../../services/api'
import api from '../../services/api'
import type { VehicleType, TemperatureType, TemperatureClass, Volume, PDV, BaseLogistics, Tour, TourStop, DistanceEntry, Contract, PdvPickupSummary } from '../../types'
import type { PdvVolumeStatus } from '../map/PdvMarker'
import { VEHICLE_TYPE_DEFAULTS, TEMPERATURE_TYPE_LABELS } from '../../types'
import { getRequiredTemperatureType, checkTemperatureCompatibility } from '../../utils/temperatureUtils'

interface TourBuilderProps {
  selectedDate: string
  selectedBaseId: number | null
  onDateChange: (date: string) => void
  onBaseChange: (baseId: number | null) => void
}

export function TourBuilder({ selectedDate, selectedBaseId, onDateChange, onBaseChange }: TourBuilderProps) {
  const { t } = useTranslation()
  const { selectedRegionId, theme } = useAppStore()
  const {
    currentStops,
    setCurrentTour,
    addStop,
    removeStop,
    reorderStops,
    updateStop,
    resetTour,
    totalEqp,
  } = useTour()

  const [selectedVehicleType, setSelectedVehicleType] = useState<VehicleType | null>(null)
  const [capacityEqp, setCapacityEqp] = useState(0)
  const [saving, setSaving] = useState(false)
  const [splitDialog, setSplitDialog] = useState<{ volume: Volume; maxEqp: number; existingStop?: boolean } | null>(null)
  const [splitEqp, setSplitEqp] = useState(0)
  const [mapResizeSignal, setMapResizeSignal] = useState(0)
  const handlePanelLayout = useCallback(() => setMapResizeSignal((n) => n + 1), [])

  /* Température / Temperature state */
  const [selectedTemperatureType, setSelectedTemperatureType] = useState<TemperatureType | null>(null)
  const [tempUpgradeDialog, setTempUpgradeDialog] = useState<{ volume: Volume; upgradeTo: TemperatureType } | null>(null)
  /* Filtre température pour carte + liste volumes / Temperature filter for map + volume list */
  const [tempFilters, setTempFilters] = useState<Set<TemperatureClass>>(new Set())

  /* Persistence localStorage des tailles / localStorage persistence for panel sizes */
  const outerLayout = useDefaultLayout({ id: 'tour-h' })
  const innerLayout = useDefaultLayout({ id: 'tour-inner' })

  const regionParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: allVolumes, refetch: refetchVolumes } = useApi<Volume>('/volumes', regionParams)
  const volumes = useMemo(() => {
    if (!selectedDate) return allVolumes.filter((v) => !v.tour_id)
    return allVolumes.filter((v) => v.dispatch_date === selectedDate && !v.tour_id)
  }, [allVolumes, selectedDate])
  const { data: pdvs } = useApi<PDV>('/pdvs', regionParams)
  const { data: bases } = useApi<BaseLogistics>('/bases', regionParams)
  const { data: distances } = useApi<DistanceEntry>('/distance-matrix')
  const { data: contracts } = useApi<Contract>('/contracts', regionParams)
  const { data: pickupSummaries } = useApi<PdvPickupSummary>('/pickup-requests/by-pdv/pending')

  /* Index pickup par PDV / Pickup index by PDV */
  const pickupByPdv = useMemo(() => {
    const m = new Map<number, PdvPickupSummary>()
    pickupSummaries.forEach((s) => m.set(s.pdv_id, s))
    return m
  }, [pickupSummaries])

  /* Flags reprise auto-cochés / Auto-checked pickup flags per PDV */
  const getPickupFlags = useCallback((pdvId: number) => {
    const summary = pickupByPdv.get(pdvId)
    if (!summary) return {}
    const flags: Record<string, boolean> = {}
    for (const req of summary.requests) {
      if (req.pickup_type === 'CONTAINER') flags.pickup_containers = true
      if (req.pickup_type === 'CARDBOARD') flags.pickup_cardboard = true
      if (req.pickup_type === 'MERCHANDISE') flags.pickup_returns = true
      if (req.pickup_type === 'CONSIGNMENT') flags.pickup_consignment = true
    }
    return flags
  }, [pickupByPdv])

  /* Coût moyen/km par type de véhicule / Average cost/km for vehicle type */
  const avgCostPerKm = useMemo(() => {
    if (!selectedVehicleType || contracts.length === 0) return 0
    const matching = contracts.filter((c) => c.vehicle_type === selectedVehicleType && c.cost_per_km)
    if (matching.length === 0) return 0
    const sum = matching.reduce((acc, c) => acc + (c.cost_per_km ?? 0), 0)
    return sum / matching.length
  }, [contracts, selectedVehicleType])

  const avgFixedCost = useMemo(() => {
    if (!selectedVehicleType || contracts.length === 0) return 0
    const matching = contracts.filter((c) => c.vehicle_type === selectedVehicleType && c.fixed_daily_cost)
    if (matching.length === 0) return 0
    const sum = matching.reduce((acc, c) => acc + (c.fixed_daily_cost ?? 0), 0)
    return sum / matching.length
  }, [contracts, selectedVehicleType])

  /* Index des distances / Distance index for fast lookup */
  const distanceIndex = useMemo(() => {
    const idx = new Map<string, DistanceEntry>()
    distances.forEach((d) => {
      idx.set(`${d.origin_type}:${d.origin_id}->${d.destination_type}:${d.destination_id}`, d)
    })
    return idx
  }, [distances])

  const getDistance = (
    fromType: string, fromId: number,
    toType: string, toId: number
  ): DistanceEntry | undefined => {
    return distanceIndex.get(`${fromType}:${fromId}->${toType}:${toId}`)
      || distanceIndex.get(`${toType}:${toId}->${fromType}:${fromId}`)
  }

  const assignedPdvIds = useMemo(() => new Set(currentStops.map((s) => s.pdv_id)), [currentStops])

  /* IDs des volumes consommés par les stops du tour en construction /
     Volume IDs consumed by stops of the tour being built */
  const consumedVolumeIds = useMemo(() => {
    const ids = new Set<number>()
    for (const stop of currentStops) {
      let remaining = stop.eqp_count
      const pdvVols = volumes
        .filter(v => v.pdv_id === stop.pdv_id)
        .sort((a, b) => {
          /* Préférer le match exact / Prefer exact match */
          if (a.eqp_count === remaining && b.eqp_count !== remaining) return -1
          if (b.eqp_count === remaining && a.eqp_count !== remaining) return 1
          return b.eqp_count - a.eqp_count
        })
      for (const vol of pdvVols) {
        if (remaining <= 0) break
        if (vol.eqp_count <= remaining) {
          ids.add(vol.id)
          remaining -= vol.eqp_count
        }
      }
    }
    return ids
  }, [currentStops, volumes])

  /* Pas de filtrage par base — tous les volumes du jour / No base filtering — all volumes for the day */
  const filteredVolumes = volumes

  /* Tous les volumes du jour (avec et sans tour_id) / All day's volumes (assigned+unassigned) */
  const allDayVolumes = useMemo(() => {
    return selectedDate
      ? allVolumes.filter((v) => v.dispatch_date === selectedDate)
      : allVolumes
  }, [allVolumes, selectedDate])

  /* Base auto-détectée depuis les volumes ajoutés / Auto-detected base from added volumes */
  const autoBaseId = useMemo(() => {
    if (currentStops.length === 0) return null
    const firstStopPdvId = currentStops[0].pdv_id
    const vol = volumes.find((v) => v.pdv_id === firstStopPdvId) || allVolumes.find((v) => v.pdv_id === firstStopPdvId)
    return vol?.base_origin_id ?? null
  }, [currentStops, volumes, allVolumes])

  /* Utiliser autoBaseId comme base effective / Use autoBaseId as effective base */
  const effectiveBaseId = autoBaseId ?? selectedBaseId

  /* Températures des volumes dans le tour / Temperature classes of volumes in tour */
  const tourTemperatures = useMemo(() => {
    const temps = new Set<TemperatureClass>()
    for (const stop of currentStops) {
      const vol = volumes.find((v) => v.pdv_id === stop.pdv_id) || allVolumes.find((v) => v.pdv_id === stop.pdv_id)
      if (vol) temps.add(vol.temperature_class)
    }
    return temps
  }, [currentStops, volumes, allVolumes])

  /* Température suggérée / Suggested temperature */
  const suggestedTemperature = useMemo(
    () => getRequiredTemperatureType(tourTemperatures),
    [tourTemperatures],
  )

  /* Statut volume par PDV pour la carte, filtré par température / Volume status per PDV for map, filtered by temperature */
  const pdvVolumeStatusMap = useMemo(() => {
    const m = new Map<number, PdvVolumeStatus>()
    for (const v of allDayVolumes) {
      if (tempFilters.size > 0 && !tempFilters.has(v.temperature_class)) continue
      if (!v.tour_id) m.set(v.pdv_id, 'unassigned')
    }
    for (const v of allDayVolumes) {
      if (tempFilters.size > 0 && !tempFilters.has(v.temperature_class)) continue
      if (v.tour_id) m.set(v.pdv_id, 'assigned')
    }
    for (const id of assignedPdvIds) {
      m.set(id, 'assigned')
    }
    return m
  }, [allDayVolumes, assignedPdvIds, tempFilters])

  /* EQC par PDV ventilé par température, filtré par chips température /
     EQC per PDV broken down by temperature class, filtered by temperature chips */
  const pdvEqpMap = useMemo(() => {
    const m = new Map<number, Record<string, number>>()
    for (const v of allDayVolumes) {
      if (tempFilters.size > 0 && !tempFilters.has(v.temperature_class)) continue
      const existing = m.get(v.pdv_id) || {}
      existing[v.temperature_class] = (existing[v.temperature_class] || 0) + v.eqp_count
      m.set(v.pdv_id, existing)
    }
    return m
  }, [allDayVolumes, tempFilters])

  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])

  /* Dernier stop pour tri par proximité / Last stop for proximity sorting */
  const lastStopPdvId = useMemo(() => {
    if (currentStops.length === 0) return null
    return currentStops[currentStops.length - 1].pdv_id
  }, [currentStops])

  /* Calcul km estimé (sans temps) / Estimated km (no time) */
  const { totalKm, routeCoords } = useMemo(() => {
    const selectedBase = bases.find((b) => b.id === effectiveBaseId)
    let km = 0
    const coords: [number, number][] = []

    if (selectedBase?.latitude && selectedBase?.longitude) {
      coords.push([selectedBase.latitude, selectedBase.longitude])
    }

    let prevType = 'BASE'
    let prevId = effectiveBaseId ?? 0
    for (const stop of currentStops) {
      const dist = getDistance(prevType, prevId, 'PDV', stop.pdv_id)
      km += dist?.distance_km ?? 0
      const pdv = pdvMap.get(stop.pdv_id)
      if (pdv?.latitude && pdv?.longitude) {
        coords.push([pdv.latitude, pdv.longitude])
      }
      prevType = 'PDV'
      prevId = stop.pdv_id
    }

    /* Retour base / Return to base */
    if (currentStops.length > 0 && effectiveBaseId) {
      const lastStop = currentStops[currentStops.length - 1]
      const distReturn = getDistance('PDV', lastStop.pdv_id, 'BASE', effectiveBaseId)
      if (distReturn) km += distReturn.distance_km
      if (selectedBase?.latitude && selectedBase?.longitude) {
        coords.push([selectedBase.latitude, selectedBase.longitude])
      }
    }

    return { totalKm: Math.round(km * 10) / 10, routeCoords: coords }
  }, [currentStops, bases, effectiveBaseId, distanceIndex, pdvMap])

  /* Coût estimé en temps réel / Real-time estimated cost */
  const estimatedCost = useMemo(() => {
    if (totalKm <= 0 || avgCostPerKm <= 0) return 0
    return Math.round((avgFixedCost + totalKm * avgCostPerKm) * 100) / 100
  }, [totalKm, avgCostPerKm, avgFixedCost])

  const remaining = selectedVehicleType ? (capacityEqp - totalEqp) : Infinity

  /* Nom de la base auto-détectée / Auto-detected base name */
  const autoBaseName = useMemo(() => {
    if (!effectiveBaseId) return null
    const b = bases.find((b) => b.id === effectiveBaseId)
    return b ? `${b.code} — ${b.name}` : null
  }, [effectiveBaseId, bases])

  const handleSelectVehicleType = (vt: VehicleType, defaultCapacity: number) => {
    setSelectedVehicleType(vt)
    setCapacityEqp(defaultCapacity)
    setCurrentTour({ vehicle_type: vt, date: selectedDate, base_id: effectiveBaseId ?? 0, status: 'DRAFT' as const })
    /* Auto-set température si pas encore choisie / Auto-set temperature if not chosen yet */
    if (!selectedTemperatureType) {
      setSelectedTemperatureType(suggestedTemperature)
    }

    /* Détecter dépassement capacité sur les stops existants → proposer split /
       Detect capacity overage on existing stops → offer split */
    if (totalEqp > defaultCapacity) {
      const otherStopsEqp = (pid: number) => currentStops.reduce((s, st) => s + (st.pdv_id === pid ? 0 : st.eqp_count), 0)
      const sorted = [...currentStops].sort((a, b) => b.eqp_count - a.eqp_count)
      for (const stop of sorted) {
        const maxKeep = defaultCapacity - otherStopsEqp(stop.pdv_id)
        if (maxKeep > 0 && stop.eqp_count > maxKeep) {
          const vol = allVolumes.find(v => v.pdv_id === stop.pdv_id && v.dispatch_date === selectedDate && !v.tour_id)
          if (vol) {
            setSplitDialog({ volume: vol, maxEqp: maxKeep, existingStop: true })
            setSplitEqp(maxKeep)
            break
          }
        }
      }
    }
  }

  /* Ajouter un volume — phase A (sans véhicule) ou C (avec véhicule) /
     Add volume — phase A (no vehicle) or phase C (with vehicle) */
  const handleAddVolume = (vol: Volume) => {
    if (assignedPdvIds.has(vol.pdv_id)) return

    /* Phase A : pas de véhicule → ajout libre / Phase A: no vehicle → free add */
    if (!selectedVehicleType) {
      addStop({
        id: 0,
        tour_id: 0,
        pdv_id: vol.pdv_id,
        sequence_order: currentStops.length + 1,
        eqp_count: vol.eqp_count,
        ...getPickupFlags(vol.pdv_id),
      })
      /* Auto-set base depuis le volume / Auto-set base from volume */
      if (!autoBaseId) {
        onBaseChange(vol.base_origin_id)
      }
      return
    }

    /* Phase C : véhicule sélectionné → check température + capacité /
       Phase C: vehicle selected → check temperature + capacity */
    if (selectedTemperatureType) {
      const compat = checkTemperatureCompatibility(vol.temperature_class, selectedTemperatureType, tourTemperatures)
      if (!compat.compatible) {
        setTempUpgradeDialog({ volume: vol, upgradeTo: compat.upgradeTo })
        return
      }
    }

    if (remaining <= 0) return

    if (vol.eqp_count <= remaining) {
      addStop({
        id: 0,
        tour_id: 0,
        pdv_id: vol.pdv_id,
        sequence_order: currentStops.length + 1,
        eqp_count: vol.eqp_count,
        ...getPickupFlags(vol.pdv_id),
      })
    } else {
      setSplitDialog({ volume: vol, maxEqp: remaining })
      setSplitEqp(remaining)
    }
  }

  /* Confirmer upgrade température / Confirm temperature upgrade */
  const handleConfirmTempUpgrade = () => {
    if (!tempUpgradeDialog) return
    setSelectedTemperatureType(tempUpgradeDialog.upgradeTo)
    const vol = tempUpgradeDialog.volume
    setTempUpgradeDialog(null)
    /* Re-add le volume maintenant compatible / Re-add the now-compatible volume */
    if (remaining <= 0 && selectedVehicleType) return
    if (!selectedVehicleType || vol.eqp_count <= remaining) {
      addStop({
        id: 0,
        tour_id: 0,
        pdv_id: vol.pdv_id,
        sequence_order: currentStops.length + 1,
        eqp_count: vol.eqp_count,
        ...getPickupFlags(vol.pdv_id),
      })
    } else {
      setSplitDialog({ volume: vol, maxEqp: remaining })
      setSplitEqp(remaining)
    }
  }

  const handleConfirmSplit = async () => {
    if (!splitDialog || splitEqp <= 0) return
    try {
      await api.post(`/volumes/${splitDialog.volume.id}/split`, { eqp_count: splitEqp })
      if (splitDialog.existingStop) {
        /* Stop déjà dans le tour → mettre à jour son EQP / Existing stop → update its EQP */
        updateStop(splitDialog.volume.pdv_id, { eqp_count: splitEqp })
      } else {
        /* Nouveau stop / New stop */
        addStop({
          id: 0,
          tour_id: 0,
          pdv_id: splitDialog.volume.pdv_id,
          sequence_order: currentStops.length + 1,
          eqp_count: splitEqp,
          ...getPickupFlags(splitDialog.volume.pdv_id),
        })
      }
      refetchVolumes()
    } catch (e) {
      console.error('Failed to split volume', e)
    }
    setSplitDialog(null)
  }

  const handlePdvClick = (pdv: PDV) => {
    if (assignedPdvIds.has(pdv.id)) return
    const vol = filteredVolumes.find((v) => v.pdv_id === pdv.id)
    if (!vol) return
    handleAddVolume(vol)
  }

  /* Carte détachable / Detachable map */
  const { isDetached, detach, attach } = useDetachedMap({
    selectedPdvIds: assignedPdvIds,
    pdvVolumeStatusMap,
    pdvEqpMap,
    routeCoords,
    pickupByPdv,
    theme,
    regionId: selectedRegionId,
    onPdvClick: handlePdvClick,
  })

  /* Sauvegarder comme brouillon (sans contrat) / Save as draft (no contract) */
  const handleValidate = async () => {
    if (!selectedVehicleType || currentStops.length === 0) return
    setSaving(true)
    try {
      await create<Tour>('/tours', {
        date: selectedDate,
        code: `T-${Date.now()}`,
        vehicle_type: selectedVehicleType,
        capacity_eqp: capacityEqp,
        base_id: effectiveBaseId ?? 0,
        status: 'DRAFT',
        total_eqp: totalEqp,
        total_km: totalKm,
        temperature_type: selectedTemperatureType ?? undefined,
        stops: currentStops.map((s, i) => ({
          pdv_id: s.pdv_id,
          sequence_order: i + 1,
          eqp_count: s.eqp_count,
          pickup_cardboard: s.pickup_cardboard ?? false,
          pickup_containers: s.pickup_containers ?? false,
          pickup_returns: s.pickup_returns ?? false,
          pickup_consignment: s.pickup_consignment ?? false,
        })) as TourStop[],
      })
      resetTour()
      setSelectedVehicleType(null)
      setCapacityEqp(0)
      setSelectedTemperatureType(null)
      refetchVolumes()
    } catch (e) {
      console.error('Failed to save tour', e)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    resetTour()
    setSelectedVehicleType(null)
    setCapacityEqp(0)
    setSelectedTemperatureType(null)
  }

  /* Bandeau véhicule inline / Inline vehicle banner — shown after first stop, before vehicle selection */
  const vehicleBanner = currentStops.length > 0 && !selectedVehicleType ? (
    <div
      className="rounded-xl border-2 p-4"
      style={{ borderColor: 'var(--color-primary)', backgroundColor: 'rgba(249,115,22,0.05)' }}
    >
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Sélectionnez la température puis le véhicule
      </h3>
      {autoBaseName && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          Base détectée: <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{autoBaseName}</span>
        </p>
      )}
      <VehicleSelector
        selectedType={null}
        onSelect={handleSelectVehicleType}
        selectedTemperature={selectedTemperatureType}
        onTemperatureSelect={setSelectedTemperatureType}
        suggestedTemperature={suggestedTemperature}
        tourTemperatures={tourTemperatures}
      />
    </div>
  ) : null

  return (
    <div className="space-y-4">
      {/* Barre supérieure: date + info véhicule/température / Top bar */}
      <div
        className="rounded-xl border p-4 flex flex-wrap items-end gap-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        {/* Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Date de répartition
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Base auto-détectée / Auto-detected base */}
        {autoBaseName && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Base (auto)
            </label>
            <span className="text-sm font-semibold px-3 py-2" style={{ color: 'var(--color-primary)' }}>
              {autoBaseName}
            </span>
          </div>
        )}

        {/* Type de véhicule sélectionné / Selected vehicle type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.vehicleType')}
          </label>
          <span className="text-sm font-semibold px-3 py-2" style={{ color: selectedVehicleType ? 'var(--color-primary)' : 'var(--text-muted)' }}>
            {selectedVehicleType
              ? `${VEHICLE_TYPE_DEFAULTS[selectedVehicleType].label} (${capacityEqp} EQC)`
              : t('tourPlanning.selectVehicleType')}
          </span>
        </div>

        {/* Badge température / Temperature badge */}
        {selectedTemperatureType && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Température
            </label>
            <span className="text-sm font-semibold px-3 py-2" style={{ color: 'var(--text-primary)' }}>
              {TEMPERATURE_TYPE_LABELS[selectedTemperatureType]}
            </span>
          </div>
        )}

        {/* Indicateur volumes + reset / Volumes indicator + reset */}
        <div className="ml-auto flex items-end gap-3">
          {(currentStops.length > 0 || selectedVehicleType || selectedTemperatureType) && (
            <button
              className="px-3 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
              style={{
                borderColor: 'var(--color-danger)',
                color: 'var(--color-danger)',
                backgroundColor: 'rgba(239,68,68,0.08)',
              }}
              onClick={handleReset}
            >
              {t('tourPlanning.resetTour')}
            </button>
          )}
          <div className="text-right">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('tourPlanning.availableVolumes')}
            </span>
            <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
              {filteredVolumes.filter((v) => !consumedVolumeIds.has(v.id)).length}
            </p>
          </div>
        </div>
      </div>

      {/* Layout principal — toujours visible dès que la date est sélectionnée /
          Main layout — always visible once date is selected */}
      <>
        {/* Desktop: panneaux redimensionnables / Desktop: resizable panels */}
        <div className="hidden lg:block" style={{ height: 'calc(100vh - 320px)' }}>
          {isDetached ? (
            /* Carte détachée → panneaux data pleine largeur / Map detached → full-width data panels */
            <div className="flex flex-col h-full gap-2">
              <div className="flex justify-start py-1">
                <button
                  onClick={attach}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'rgba(234,179,8,0.15)',
                    borderColor: 'var(--color-warning)',
                    color: 'var(--color-warning)',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Rattacher la carte
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <Group orientation="horizontal" defaultLayout={innerLayout.defaultLayout} onLayoutChanged={innerLayout.onLayoutChanged}>
                  <Panel defaultSize={50} minSize={25}>
                    <div className="h-full overflow-y-auto">
                      <VolumePanel
                        volumes={filteredVolumes}
                        pdvs={pdvs}
                        assignedPdvIds={assignedPdvIds}
                        consumedVolumeIds={consumedVolumeIds}
                        onAddVolume={handleAddVolume}
                        vehicleCapacity={capacityEqp}
                        currentEqp={totalEqp}
                        lastStopPdvId={lastStopPdvId}
                        baseId={effectiveBaseId}
                        distanceIndex={distanceIndex}
                        pickupSummaries={pickupSummaries}
                        tempFilters={tempFilters}
                        onTempFiltersChange={setTempFilters}
                      />
                    </div>
                  </Panel>

                  <ResizeHandle id="handle-inner" />

                  <Panel defaultSize={50} minSize={25}>
                    <div className="flex flex-col h-full gap-2 overflow-y-auto">
                      {vehicleBanner}
                      <div className="flex-1 min-h-0 overflow-y-auto">
                        <TourSummary
                          stops={currentStops}
                          pdvs={pdvs}
                          vehicleType={selectedVehicleType}
                          capacityEqp={capacityEqp}
                          totalEqp={totalEqp}
                          totalKm={totalKm}
                          totalCost={estimatedCost}
                          onRemoveStop={removeStop}
                          onReorderStops={reorderStops}
                          onUpdateStop={updateStop}
                          temperatureType={selectedTemperatureType}
                          tourTemperatures={tourTemperatures}
                        />
                      </div>
                      <TourValidation
                        stops={currentStops}
                        vehicleType={selectedVehicleType}
                        capacityEqp={capacityEqp}
                        totalEqp={totalEqp}
                        onValidate={handleValidate}
                        onReset={handleReset}
                        temperatureType={selectedTemperatureType}
                      />
                      {saving && (
                        <p className="text-xs text-center" style={{ color: 'var(--color-primary)' }}>
                          {t('common.loading')}
                        </p>
                      )}
                    </div>
                  </Panel>
                </Group>
              </div>
            </div>
          ) : (
            /* Carte inline → layout normal / Map inline → normal layout */
            <Group orientation="horizontal" defaultLayout={outerLayout.defaultLayout} onLayoutChange={(...args) => { outerLayout.onLayoutChange(...args); handlePanelLayout() }} onLayoutChanged={outerLayout.onLayoutChanged}>
              {/* Carte / Map */}
              <Panel defaultSize={40} minSize={25}>
                <div className="h-full flex flex-col">
                  <div className="flex justify-end py-1 px-1">
                    <button
                      onClick={detach}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border transition-all hover:opacity-80"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Détacher la carte
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                  <MapView
                    onPdvClick={handlePdvClick}
                    selectedPdvIds={assignedPdvIds}
                    pdvVolumeStatusMap={pdvVolumeStatusMap}
                    pdvEqpMap={pdvEqpMap}
                    pickupByPdv={pickupByPdv}
                    routeCoords={routeCoords}
                    height="100%"
                    resizeSignal={mapResizeSignal}
                  />
                  </div>
                </div>
              </Panel>

              <ResizeHandle id="handle-map" />

              {/* Panneaux droits / Right panels */}
              <Panel defaultSize={60} minSize={30}>
                <div className="flex flex-col h-full gap-2">
                  <div className="flex-1 min-h-0">
                    <Group orientation="horizontal" defaultLayout={innerLayout.defaultLayout} onLayoutChanged={innerLayout.onLayoutChanged}>
                      {/* Volumes disponibles / Available volumes */}
                      <Panel defaultSize={50} minSize={25}>
                        <div className="h-full overflow-y-auto">
                          <VolumePanel
                            volumes={filteredVolumes}
                            pdvs={pdvs}
                            assignedPdvIds={assignedPdvIds}
                            consumedVolumeIds={consumedVolumeIds}
                            onAddVolume={handleAddVolume}
                            vehicleCapacity={capacityEqp}
                            currentEqp={totalEqp}
                            lastStopPdvId={lastStopPdvId}
                            baseId={effectiveBaseId}
                            distanceIndex={distanceIndex}
                            pickupSummaries={pickupSummaries}
                            tempFilters={tempFilters}
                            onTempFiltersChange={setTempFilters}
                          />
                        </div>
                      </Panel>

                      <ResizeHandle id="handle-inner" />

                      {/* Résumé + validation / Tour summary + validation */}
                      <Panel defaultSize={50} minSize={25}>
                        <div className="flex flex-col h-full gap-2 overflow-y-auto">
                          {vehicleBanner}
                          <div className="flex-1 min-h-0 overflow-y-auto">
                            <TourSummary
                              stops={currentStops}
                              pdvs={pdvs}
                              vehicleType={selectedVehicleType}
                              capacityEqp={capacityEqp}
                              totalEqp={totalEqp}
                              totalKm={totalKm}
                              totalCost={estimatedCost}
                              onRemoveStop={removeStop}
                              onReorderStops={reorderStops}
                              onUpdateStop={updateStop}
                              temperatureType={selectedTemperatureType}
                              tourTemperatures={tourTemperatures}
                            />
                          </div>
                          <TourValidation
                            stops={currentStops}
                            vehicleType={selectedVehicleType}
                            capacityEqp={capacityEqp}
                            totalEqp={totalEqp}
                            onValidate={handleValidate}
                            onReset={handleReset}
                            temperatureType={selectedTemperatureType}
                          />
                          {saving && (
                            <p className="text-xs text-center" style={{ color: 'var(--color-primary)' }}>
                              {t('common.loading')}
                            </p>
                          )}
                        </div>
                      </Panel>
                    </Group>
                  </div>
                </div>
              </Panel>
            </Group>
          )}
        </div>

        {/* Mobile: layout empilé classique / Mobile: stacked fallback */}
        <div className="lg:hidden space-y-4">
          <div className="min-h-[400px]">
            <MapView
              onPdvClick={handlePdvClick}
              selectedPdvIds={assignedPdvIds}
              pdvVolumeStatusMap={pdvVolumeStatusMap}
              pdvEqpMap={pdvEqpMap}
              pickupByPdv={pickupByPdv}
              routeCoords={routeCoords}
              height="400px"
            />
          </div>
          <VolumePanel
            volumes={filteredVolumes}
            pdvs={pdvs}
            assignedPdvIds={assignedPdvIds}
            consumedVolumeIds={consumedVolumeIds}
            onAddVolume={handleAddVolume}
            vehicleCapacity={capacityEqp}
            currentEqp={totalEqp}
            lastStopPdvId={lastStopPdvId}
            baseId={effectiveBaseId}
            distanceIndex={distanceIndex}
            pickupSummaries={pickupSummaries}
            tempFilters={tempFilters}
            onTempFiltersChange={setTempFilters}
          />
          {vehicleBanner}
          <TourSummary
            stops={currentStops}
            pdvs={pdvs}
            vehicleType={selectedVehicleType}
            capacityEqp={capacityEqp}
            totalEqp={totalEqp}
            totalKm={totalKm}
            totalCost={estimatedCost}
            onRemoveStop={removeStop}
            onReorderStops={reorderStops}
            onUpdateStop={updateStop}
            temperatureType={selectedTemperatureType}
            tourTemperatures={tourTemperatures}
          />
          <TourValidation
            stops={currentStops}
            vehicleType={selectedVehicleType}
            capacityEqp={capacityEqp}
            totalEqp={totalEqp}
            onValidate={handleValidate}
            onReset={handleReset}
            temperatureType={selectedTemperatureType}
          />
          {saving && (
            <p className="text-xs text-center" style={{ color: 'var(--color-primary)' }}>
              {t('common.loading')}
            </p>
          )}
        </div>
      </>

      {/* Dialog de fractionnement / Split volume dialog */}
      {splitDialog && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div
            className="rounded-xl border shadow-2xl p-6 w-[380px] space-y-4"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('tourPlanning.splitVolume')}
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {splitDialog.existingStop
                ? `Ce volume fait ${splitDialog.volume.eqp_count} EQC mais la capacité restante est ${splitDialog.maxEqp} EQC. Choisissez combien garder dans ce tour.`
                : t('tourPlanning.splitHint', { total: splitDialog.volume.eqp_count, remaining: splitDialog.maxEqp })}
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('tourPlanning.eqpToLoad')}
              </label>
              <input
                type="number"
                min={1}
                max={splitDialog.maxEqp}
                value={splitEqp}
                onChange={(e) => setSplitEqp(Math.min(Math.max(1, Number(e.target.value)), splitDialog.maxEqp))}
                className="rounded-lg border px-3 py-2 text-sm w-full"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                → {splitDialog.volume.eqp_count - splitEqp} EQC {t('tourPlanning.splitRemainder')}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                onClick={handleConfirmSplit}
              >
                {t('common.confirm')}
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onClick={() => setSplitDialog(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog upgrade température / Temperature upgrade dialog */}
      {tempUpgradeDialog && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div
            className="rounded-xl border shadow-2xl p-6 w-[380px] space-y-4"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Changement de température
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ce volume est <strong>{tempUpgradeDialog.volume.temperature_class}</strong>, le tour est <strong>{selectedTemperatureType && TEMPERATURE_TYPE_LABELS[selectedTemperatureType]}</strong>.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Passer en <strong>{TEMPERATURE_TYPE_LABELS[tempUpgradeDialog.upgradeTo]}</strong> ?
            </p>

            <div className="flex gap-2">
              <button
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                onClick={handleConfirmTempUpgrade}
              >
                {t('common.confirm')}
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                onClick={() => setTempUpgradeDialog(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
