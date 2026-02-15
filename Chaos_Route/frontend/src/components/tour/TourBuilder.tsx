/* Constructeur de tour principal / Main tour builder interface (Mode 1 Chaos Builder) */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../hooks/useApi'
import { useTour } from '../../hooks/useTour'
import { useAppStore } from '../../stores/useAppStore'
import { VehicleSelector } from './VehicleSelector'
import { VolumePanel } from './VolumePanel'
import { TourSummary } from './TourSummary'
import { TourValidation } from './TourValidation'
import { MapView } from '../map/MapView'
import { create } from '../../services/api'
import type { Vehicle, Volume, PDV, BaseLogistics, Tour } from '../../types'

export function TourBuilder() {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()
  const {
    currentTour,
    currentStops,
    setCurrentTour,
    addStop,
    removeStop,
    reorderStops,
    resetTour,
    totalEqp,
  } = useTour()

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [saving, setSaving] = useState(false)
  const [showVehiclePanel, setShowVehiclePanel] = useState(false)

  const regionParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: vehicles } = useApi<Vehicle>('/vehicles', regionParams)
  const { data: volumes } = useApi<Volume>('/volumes', { date: selectedDate, ...regionParams })
  const { data: pdvs } = useApi<PDV>('/pdvs', regionParams)
  const { data: bases } = useApi<BaseLogistics>('/bases', regionParams)

  /* PDV déjà affectés à ce tour / PDVs already assigned to this tour */
  const assignedPdvIds = useMemo(() => new Set(currentStops.map((s) => s.pdv_id)), [currentStops])

  /* Volumes filtrés par base sélectionnée / Volumes filtered by selected base */
  const filteredVolumes = useMemo(() => {
    if (!selectedBaseId) return volumes
    return volumes.filter((v) => v.base_origin_id === selectedBaseId)
  }, [volumes, selectedBaseId])

  /* Ajouter un volume au tour / Add a volume to the tour */
  const handleAddVolume = (vol: Volume) => {
    if (assignedPdvIds.has(vol.pdv_id)) return
    addStop({
      id: 0,
      tour_id: 0,
      pdv_id: vol.pdv_id,
      sequence_order: currentStops.length + 1,
      eqp_count: vol.eqp_count,
    })
  }

  /* Clic PDV sur la carte (Mode 1bis) / PDV click on map (Chaos Liner) */
  const handlePdvClick = (pdv: PDV) => {
    if (assignedPdvIds.has(pdv.id)) return
    const vol = volumes.find((v) => v.pdv_id === pdv.id)
    if (!vol) return
    handleAddVolume(vol)
  }

  /* Sélection véhicule / Vehicle selection */
  const handleVehicleSelect = (v: Vehicle) => {
    setSelectedVehicle(v)
    setCurrentTour({ vehicle_id: v.id, date: selectedDate, base_id: selectedBaseId ?? 0, status: 'DRAFT' as const })
    setShowVehiclePanel(false)
  }

  /* Valider et sauvegarder le tour / Validate and save tour */
  const handleValidate = async () => {
    if (!selectedVehicle || currentStops.length === 0) return
    setSaving(true)
    try {
      await create<Tour>('/tours', {
        date: selectedDate,
        code: `T-${Date.now()}`,
        vehicle_id: selectedVehicle.id,
        base_id: selectedBaseId ?? 0,
        status: 'DRAFT',
        total_eqp: totalEqp,
        stops: currentStops.map((s, i) => ({
          pdv_id: s.pdv_id,
          sequence_order: i + 1,
          eqp_count: s.eqp_count,
        })),
      })
      resetTour()
      setSelectedVehicle(null)
      setShowVehiclePanel(false)
    } catch (e) {
      console.error('Failed to save tour', e)
    } finally {
      setSaving(false)
    }
  }

  /* Reset complet / Full reset */
  const handleReset = () => {
    resetTour()
    setSelectedVehicle(null)
    setShowVehiclePanel(false)
  }

  return (
    <div className="space-y-4">
      {/* Barre supérieure: date, base, véhicule / Top bar: date, base, vehicle */}
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
            onChange={(e) => setSelectedDate(e.target.value)}
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
            onChange={(e) => setSelectedBaseId(e.target.value ? Number(e.target.value) : null)}
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

        {/* Véhicule sélectionné / Selected vehicle */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {t('tourPlanning.vehicle')}
          </label>
          <button
            className="rounded-lg border px-4 py-2 text-sm text-left min-w-[200px] transition-all hover:opacity-80"
            style={{
              backgroundColor: selectedVehicle ? 'rgba(249,115,22,0.08)' : 'var(--bg-primary)',
              borderColor: selectedVehicle ? 'var(--color-primary)' : 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            onClick={() => setShowVehiclePanel(!showVehiclePanel)}
          >
            {selectedVehicle
              ? `${selectedVehicle.code} (${selectedVehicle.capacity_eqp} EQP)`
              : t('tourPlanning.selectVehicle')}
          </button>
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

      {/* Panel sélection véhicule / Vehicle selection panel */}
      {showVehiclePanel && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            {t('tourPlanning.selectVehicle')}
          </h3>
          <VehicleSelector
            vehicles={vehicles}
            selectedVehicleId={selectedVehicle?.id ?? null}
            onSelect={handleVehicleSelect}
          />
        </div>
      )}

      {/* Layout principal: carte + panneau volumes + résumé / Main layout: map + volumes + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Carte / Map */}
        <div className="lg:col-span-5">
          <MapView
            onPdvClick={handlePdvClick}
            selectedPdvIds={assignedPdvIds}
            height="500px"
          />
        </div>

        {/* Volumes disponibles / Available volumes */}
        <div className="lg:col-span-3">
          <VolumePanel
            volumes={filteredVolumes}
            pdvs={pdvs}
            assignedPdvIds={assignedPdvIds}
            onAddVolume={handleAddVolume}
            vehicleCapacity={selectedVehicle?.capacity_eqp ?? 99999}
            currentEqp={totalEqp}
          />
        </div>

        {/* Résumé du tour + validation / Tour summary + validation */}
        <div className="lg:col-span-4 space-y-4">
          <TourSummary
            stops={currentStops}
            pdvs={pdvs}
            vehicle={selectedVehicle}
            totalEqp={totalEqp}
            onRemoveStop={removeStop}
            onReorderStops={reorderStops}
          />
          <TourValidation
            stops={currentStops}
            vehicle={selectedVehicle}
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
      </div>
    </div>
  )
}
