/* Carte Leaflet principale / Main Leaflet map component */

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../../stores/useMapStore'
import { useApi } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { PdvMarker, type PdvVolumeStatus } from './PdvMarker'
import { BaseMarker } from './BaseMarker'
import { SupplierMarker } from './SupplierMarker'
import { MapFilters } from './MapFilters'
import type { PDV, BaseLogistics, Supplier, PdvPickupSummary } from '../../types'
import 'leaflet/dist/leaflet.css'

/* Composant interne pour synchroniser le centre / Internal component to sync map center
   Ne s'applique que quand le store change depuis l'extérieur (pas après fitBounds) */
function MapSync() {
  const map = useMap()
  const { center, zoom } = useMapStore()
  const initialized = useRef(false)

  useEffect(() => {
    /* Ignorer le premier render — laisser RegionFitBounds gérer le positionnement initial */
    if (!initialized.current) {
      initialized.current = true
      return
    }
    map.setView(center, zoom)
  }, [map, center, zoom])

  return null
}

/* Auto-centrage sur les entités de la région / Auto-fit to region entities */
function RegionFitBounds({ pdvs, bases }: { pdvs: PDV[]; bases: BaseLogistics[] }) {
  const map = useMap()
  const { setCenter, setZoom } = useMapStore()
  const lastFitKey = useRef('')

  useEffect(() => {
    const points: [number, number][] = []
    for (const b of bases) {
      if (b.latitude && b.longitude) points.push([b.latitude, b.longitude])
    }
    for (const p of pdvs) {
      if (p.latitude && p.longitude) points.push([p.latitude, p.longitude])
    }
    if (points.length === 0) return

    /* Clé unique pour éviter les re-fit inutiles / Unique key to avoid unnecessary re-fits */
    const key = `${points.length}-${points[0][0].toFixed(3)}-${points[points.length - 1][0].toFixed(3)}`
    if (key === lastFitKey.current) return
    lastFitKey.current = key

    /* Sync store une fois l'animation terminée / Sync store after animation completes */
    const syncStore = () => {
      const c = map.getCenter()
      setCenter([c.lat, c.lng])
      setZoom(map.getZoom())
    }

    if (points.length === 1) {
      map.once('moveend', syncStore)
      map.setView(points[0], 12)
    } else {
      const bounds = L.latLngBounds(points)
      map.once('moveend', syncStore)
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }
  }, [pdvs, bases, map, setCenter, setZoom])

  return null
}

/* Suivi du zoom courant pour adapter la taille des marqueurs / Track current zoom for marker scaling */
function ZoomTracker({ onZoomChange }: { onZoomChange: (z: number) => void }) {
  const map = useMap()
  useEffect(() => { onZoomChange(map.getZoom()) }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ zoomend: () => onZoomChange(map.getZoom()) })
  return null
}

/* Invalide la taille de la carte au montage + quand le panneau est redimensionné /
   Invalidate map size on mount + when panel is resized */
function MapResizeHandler({ resizeSignal }: { resizeSignal: number }) {
  const map = useMap()

  /* Invalidation au montage — la carte peut se monter avant que le conteneur ait sa taille finale /
     Invalidate on mount — map may mount before container has final size */
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(timer)
  }, [map])

  /* Invalidation sur resize signal (drag panneau, etc.) / Invalidate on resize signal */
  useEffect(() => {
    if (resizeSignal === 0) return
    const timer = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(timer)
  }, [map, resizeSignal])

  return null
}

interface MapViewProps {
  onPdvClick?: (pdv: PDV) => void
  onPdvTempClick?: (pdv: PDV, temp: string) => void
  onPdvContextMenu?: (pdv: PDV) => void
  selectedPdvIds?: Set<number>
  pdvVolumeStatusMap?: Map<number, PdvVolumeStatus>
  pdvEqpMap?: Map<number, Record<string, number>>
  pickupByPdv?: Map<number, PdvPickupSummary>
  routeCoords?: [number, number][]
  height?: string
  resizeSignal?: number
}

export function MapView({ onPdvClick, onPdvTempClick, onPdvContextMenu, selectedPdvIds, pdvVolumeStatusMap, pdvEqpMap, pickupByPdv, routeCoords, height = '100%', resizeSignal = 0 }: MapViewProps) {
  const { center, zoom, showBases, showPdvs, showSuppliers, showPdvLabels } = useMapStore()
  const { selectedRegionId } = useAppStore()
  const [currentZoom, setCurrentZoom] = useState(zoom)

  const pdvParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const baseParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const supplierParams = selectedRegionId ? { region_id: selectedRegionId } : undefined

  const { data: pdvs } = useApi<PDV>('/pdvs', pdvParams)
  const { data: bases } = useApi<BaseLogistics>('/bases', baseParams)
  const { data: suppliers } = useApi<Supplier>('/suppliers', supplierParams)

  return (
    <div className="relative rounded-xl overflow-hidden border" style={{ height, borderColor: 'var(--border-color)' }}>
      <MapFilters />
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync />
        <ZoomTracker onZoomChange={setCurrentZoom} />
        <MapResizeHandler resizeSignal={resizeSignal} />
        <RegionFitBounds pdvs={pdvs} bases={bases} />

        {showBases && bases.map((base) =>
          base.latitude && base.longitude ? (
            <BaseMarker key={`base-${base.id}`} base={base} />
          ) : null
        )}

        {showPdvs && pdvs.filter((pdv) => !selectedPdvIds?.has(pdv.id)).map((pdv) =>
          pdv.latitude && pdv.longitude ? (
            <PdvMarker
              key={`pdv-${pdv.id}`}
              pdv={pdv}
              onClick={onPdvClick}
              onTempClick={onPdvTempClick}
              onContextMenu={onPdvContextMenu}
              selected={selectedPdvIds?.has(pdv.id)}
              volumeStatus={pdvVolumeStatusMap?.get(pdv.id)}
              pickupSummary={pickupByPdv?.get(pdv.id)}
              showLabel={showPdvLabels}
              eqpByTemp={pdvEqpMap?.get(pdv.id)}
              zoomLevel={currentZoom}
            />
          ) : null
        )}

        {showSuppliers && suppliers.map((s) =>
          s.latitude && s.longitude ? (
            <SupplierMarker key={`sup-${s.id}`} supplier={s} />
          ) : null
        )}

        {/* Tracé de la route du tour / Tour route polyline */}
        {routeCoords && routeCoords.length >= 2 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: '#f97316',
              weight: 3,
              opacity: 0.8,
              dashArray: '8, 6',
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
