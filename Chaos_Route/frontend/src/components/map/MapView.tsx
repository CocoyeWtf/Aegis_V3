/* Carte Leaflet principale / Main Leaflet map component */

import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useMapStore } from '../../stores/useMapStore'
import { useApi } from '../../hooks/useApi'
import { useAppStore } from '../../stores/useAppStore'
import { PdvMarker } from './PdvMarker'
import { BaseMarker } from './BaseMarker'
import { SupplierMarker } from './SupplierMarker'
import { MapFilters } from './MapFilters'
import type { PDV, BaseLogistics, Supplier } from '../../types'
import 'leaflet/dist/leaflet.css'

/* Composant interne pour synchroniser le centre / Internal component to sync map center */
function MapSync() {
  const map = useMap()
  const { center, zoom } = useMapStore()

  useEffect(() => {
    map.setView(center, zoom)
  }, [map, center, zoom])

  return null
}

interface MapViewProps {
  onPdvClick?: (pdv: PDV) => void
  selectedPdvIds?: Set<number>
  routeStops?: { lat: number; lng: number }[]
  height?: string
}

export function MapView({ onPdvClick, selectedPdvIds, height = '100%' }: MapViewProps) {
  const { center, zoom, showBases, showPdvs, showSuppliers } = useMapStore()
  const { selectedRegionId } = useAppStore()

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

        {showBases && bases.map((base) =>
          base.latitude && base.longitude ? (
            <BaseMarker key={`base-${base.id}`} base={base} />
          ) : null
        )}

        {showPdvs && pdvs.map((pdv) =>
          pdv.latitude && pdv.longitude ? (
            <PdvMarker
              key={`pdv-${pdv.id}`}
              pdv={pdv}
              onClick={onPdvClick}
              selected={selectedPdvIds?.has(pdv.id)}
            />
          ) : null
        )}

        {showSuppliers && suppliers.map((s) =>
          s.latitude && s.longitude ? (
            <SupplierMarker key={`sup-${s.id}`} supplier={s} />
          ) : null
        )}
      </MapContainer>
    </div>
  )
}
