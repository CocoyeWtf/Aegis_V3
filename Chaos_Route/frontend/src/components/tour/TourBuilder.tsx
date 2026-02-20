/* Constructeur de tour (Phase Construction) / Tour builder (Construction phase - vehicle type first, no contract) */

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
import { create } from '../../services/api'
import api from '../../services/api'
import type { VehicleType, Volume, PDV, BaseLogistics, Tour, TourStop, DistanceEntry, Contract } from '../../types'
import type { PdvVolumeStatus } from '../map/PdvMarker'
import { VEHICLE_TYPE_DEFAULTS } from '../../types'

interface TourBuilderProps {
  selectedDate: string
  selectedBaseId: number | null
  onDateChange: (date: string) => void
  onBaseChange: (baseId: number | null) => void
}

export function TourBuilder({ selectedDate, selectedBaseId, onDateChange, onBaseChange }: TourBuilderProps) {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()
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
  const [splitDialog, setSplitDialog] = useState<{ volume: Volume; maxEqp: number } | null>(null)
  const [splitEqp, setSplitEqp] = useState(0)
  const [mapResizeSignal, setMapResizeSignal] = useState(0)
  const handlePanelLayout = useCallback(() => setMapResizeSignal((n) => n + 1), [])

  /* Persistence localStorage des tailles / localStorage persistence for panel sizes */
  const outerLayout = useDefaultLayout({ id: 'tour-h' })
  const innerLayout = useDefaultLayout({ id: 'tour-inner' })

  const regionParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: allVolumes, refetch: refetchVolumes } = useApi<Volume>('/volumes', regionParams)
  const volumes = useMemo(() => {
    if (!selectedDate) return allVolumes.filter((v) => !v.tour_id)
    const dateCompact = selectedDate.replace(/-/g, '')
    return allVolumes.filter((v) => (v.date === selectedDate || v.date === dateCompact) && !v.tour_id)
  }, [allVolumes, selectedDate])
  const { data: pdvs } = useApi<PDV>('/pdvs', regionParams)
  const { data: bases } = useApi<BaseLogistics>('/bases', regionParams)
  const { data: distances } = useApi<DistanceEntry>('/distance-matrix')
  const { data: contracts } = useApi<Contract>('/contracts', regionParams)

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

  const filteredVolumes = useMemo(() => {
    if (!selectedBaseId) return volumes
    return volumes.filter((v) => v.base_origin_id === selectedBaseId)
  }, [volumes, selectedBaseId])

  /* Tous les volumes du jour (avec et sans tour_id) filtrés par base / All day's volumes (assigned+unassigned) filtered by base */
  const allDayVolumes = useMemo(() => {
    const dateFiltered = selectedDate
      ? (() => { const dc = selectedDate.replace(/-/g, ''); return allVolumes.filter((v) => v.date === selectedDate || v.date === dc) })()
      : allVolumes
    if (!selectedBaseId) return dateFiltered
    return dateFiltered.filter((v) => v.base_origin_id === selectedBaseId)
  }, [allVolumes, selectedDate, selectedBaseId])

  /* Statut volume par PDV pour la carte / Volume status per PDV for map coloring */
  const pdvVolumeStatusMap = useMemo(() => {
    const m = new Map<number, PdvVolumeStatus>()
    /* D'abord marquer les non-affectés en rouge / First mark unassigned as red */
    for (const v of allDayVolumes) {
      if (!v.tour_id) m.set(v.pdv_id, 'unassigned')
    }
    /* Puis écraser avec vert si affecté à un tour / Then override with green if assigned to a tour */
    for (const v of allDayVolumes) {
      if (v.tour_id) m.set(v.pdv_id, 'assigned')
    }
    /* PDV dans le tour en cours = vert aussi / PDV in current tour = green too */
    for (const id of assignedPdvIds) {
      m.set(id, 'assigned')
    }
    return m
  }, [allDayVolumes, assignedPdvIds])

  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])

  /* Dernier stop pour tri par proximité / Last stop for proximity sorting */
  const lastStopPdvId = useMemo(() => {
    if (currentStops.length === 0) return null
    return currentStops[currentStops.length - 1].pdv_id
  }, [currentStops])

  /* Calcul km estimé (sans temps) / Estimated km (no time) */
  const { totalKm, routeCoords } = useMemo(() => {
    const selectedBase = bases.find((b) => b.id === selectedBaseId)
    let km = 0
    const coords: [number, number][] = []

    if (selectedBase?.latitude && selectedBase?.longitude) {
      coords.push([selectedBase.latitude, selectedBase.longitude])
    }

    let prevType = 'BASE'
    let prevId = selectedBaseId ?? 0
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
    if (currentStops.length > 0 && selectedBaseId) {
      const lastStop = currentStops[currentStops.length - 1]
      const distReturn = getDistance('PDV', lastStop.pdv_id, 'BASE', selectedBaseId)
      if (distReturn) km += distReturn.distance_km
      if (selectedBase?.latitude && selectedBase?.longitude) {
        coords.push([selectedBase.latitude, selectedBase.longitude])
      }
    }

    return { totalKm: Math.round(km * 10) / 10, routeCoords: coords }
  }, [currentStops, bases, selectedBaseId, distanceIndex, pdvMap])

  /* Coût estimé en temps réel / Real-time estimated cost */
  const estimatedCost = useMemo(() => {
    if (totalKm <= 0 || avgCostPerKm <= 0) return 0
    return Math.round((avgFixedCost + totalKm * avgCostPerKm) * 100) / 100
  }, [totalKm, avgCostPerKm, avgFixedCost])

  const remaining = capacityEqp - totalEqp

  const handleSelectVehicleType = (vt: VehicleType, defaultCapacity: number) => {
    setSelectedVehicleType(vt)
    setCapacityEqp(defaultCapacity)
    setCurrentTour({ vehicle_type: vt, date: selectedDate, base_id: selectedBaseId ?? 0, status: 'DRAFT' as const })
  }

  const handleAddVolume = (vol: Volume) => {
    if (assignedPdvIds.has(vol.pdv_id)) return
    if (!selectedBaseId) return
    if (!selectedVehicleType) return
    if (remaining <= 0) return

    if (vol.eqp_count <= remaining) {
      addStop({
        id: 0,
        tour_id: 0,
        pdv_id: vol.pdv_id,
        sequence_order: currentStops.length + 1,
        eqp_count: vol.eqp_count,
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
      addStop({
        id: 0,
        tour_id: 0,
        pdv_id: splitDialog.volume.pdv_id,
        sequence_order: currentStops.length + 1,
        eqp_count: splitEqp,
      })
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
        base_id: selectedBaseId ?? 0,
        status: 'DRAFT',
        total_eqp: totalEqp,
        total_km: totalKm,
        stops: currentStops.map((s, i) => ({
          pdv_id: s.pdv_id,
          sequence_order: i + 1,
          eqp_count: s.eqp_count,
          pickup_cardboard: s.pickup_cardboard ?? false,
          pickup_containers: s.pickup_containers ?? false,
          pickup_returns: s.pickup_returns ?? false,
        })) as TourStop[],
      })
      resetTour()
      setSelectedVehicleType(null)
      setCapacityEqp(0)
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
  }

  return (
    <div className="space-y-4">
      {/* Barre supérieure: date, base, type véhicule / Top bar */}
      <div
        className="rounded-xl border p-4 flex flex-wrap items-end gap-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        {/* Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('common.date')}
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

        {/* Base d'expédition / Dispatch base */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.dispatchBase')}
          </label>
          <select
            value={selectedBaseId ?? ''}
            onChange={(e) => {
              onBaseChange(e.target.value ? Number(e.target.value) : null)
              setSelectedVehicleType(null)
              setCapacityEqp(0)
            }}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">{t('tourPlanning.allBases')}</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </div>

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

        {/* Indicateur volumes / Volumes indicator */}
        <div className="ml-auto text-right">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.availableVolumes')}
          </span>
          <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
            {filteredVolumes.filter((v) => !assignedPdvIds.has(v.pdv_id)).length}
          </p>
        </div>
      </div>

      {/* Avertissement: base manquante / Warning: missing base */}
      {!selectedBaseId && (
        <div
          className="rounded-lg px-4 py-2 text-xs"
          style={{ backgroundColor: 'rgba(234,179,8,0.1)', color: 'var(--color-warning)' }}
        >
          {t('tourPlanning.baseRequired')}
        </div>
      )}

      {/* Sélection type de véhicule / Vehicle type selection */}
      {selectedBaseId && !selectedVehicleType && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('tourPlanning.selectVehicleType')}
          </h3>
          <VehicleSelector
            selectedType={null}
            onSelect={handleSelectVehicleType}
          />
        </div>
      )}

      {/* Layout principal redimensionnable / Main resizable layout: map | volumes | tour+validation */}
      {selectedVehicleType && (
        <>
          {/* Desktop: panneaux redimensionnables / Desktop: resizable panels */}
          <div className="hidden lg:block" style={{ height: 'calc(100vh - 320px)' }}>
            <Group orientation="horizontal" defaultLayout={outerLayout.defaultLayout} onLayoutChange={(...args) => { outerLayout.onLayoutChange(...args); handlePanelLayout() }} onLayoutChanged={outerLayout.onLayoutChanged}>
              {/* Carte / Map */}
              <Panel defaultSize={40} minSize={25}>
                <div className="h-full">
                  <MapView
                    onPdvClick={handlePdvClick}
                    selectedPdvIds={assignedPdvIds}
                    pdvVolumeStatusMap={pdvVolumeStatusMap}
                    routeCoords={routeCoords}
                    height="100%"
                    resizeSignal={mapResizeSignal}
                  />
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
                            onAddVolume={handleAddVolume}
                            vehicleCapacity={capacityEqp}
                            currentEqp={totalEqp}
                            lastStopPdvId={lastStopPdvId}
                            baseId={selectedBaseId}
                            distanceIndex={distanceIndex}
                          />
                        </div>
                      </Panel>

                      <ResizeHandle id="handle-inner" />

                      {/* Résumé + validation / Tour summary + validation */}
                      <Panel defaultSize={50} minSize={25}>
                        <div className="flex flex-col h-full gap-2">
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
                            />
                          </div>
                          <TourValidation
                            stops={currentStops}
                            vehicleType={selectedVehicleType}
                            capacityEqp={capacityEqp}
                            totalEqp={totalEqp}
                            onValidate={handleValidate}
                            onReset={handleReset}
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
          </div>

          {/* Mobile: layout empilé classique / Mobile: stacked fallback */}
          <div className="lg:hidden space-y-4">
            <div className="min-h-[400px]">
              <MapView
                onPdvClick={handlePdvClick}
                selectedPdvIds={assignedPdvIds}
                pdvVolumeStatusMap={pdvVolumeStatusMap}
                routeCoords={routeCoords}
                height="400px"
              />
            </div>
            <VolumePanel
              volumes={filteredVolumes}
              pdvs={pdvs}
              assignedPdvIds={assignedPdvIds}
              onAddVolume={handleAddVolume}
              vehicleCapacity={capacityEqp}
              currentEqp={totalEqp}
              lastStopPdvId={lastStopPdvId}
              baseId={selectedBaseId}
              distanceIndex={distanceIndex}
            />
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
            />
            <TourValidation
              stops={currentStops}
              vehicleType={selectedVehicleType}
              capacityEqp={capacityEqp}
              totalEqp={totalEqp}
              onValidate={handleValidate}
              onReset={handleReset}
            />
            {saving && (
              <p className="text-xs text-center" style={{ color: 'var(--color-primary)' }}>
                {t('common.loading')}
              </p>
            )}
          </div>
        </>
      )}

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
              {t('tourPlanning.splitHint', { total: splitDialog.volume.eqp_count, remaining: splitDialog.maxEqp })}
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
    </div>
  )
}
