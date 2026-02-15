/* Marqueur Fournisseur sur la carte / Supplier marker on map */

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { Supplier } from '../../types'

const supplierIcon = L.divIcon({
  className: '',
  html: '<div style="background:#8b5cf6;width:14px;height:14px;border-radius:2px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:8px;font-weight:bold">F</span></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

interface SupplierMarkerProps {
  supplier: Supplier
}

export function SupplierMarker({ supplier }: SupplierMarkerProps) {
  if (!supplier.latitude || !supplier.longitude) return null

  return (
    <Marker position={[supplier.latitude, supplier.longitude]} icon={supplierIcon}>
      <Tooltip>
        <div style={{ fontSize: '12px' }}>
          <strong>{supplier.code}</strong> — {supplier.name}<br />
          {supplier.city && <span>{supplier.city}</span>}
        </div>
      </Tooltip>
    </Marker>
  )
}
