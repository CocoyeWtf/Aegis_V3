/* Marqueur Base logistique sur la carte / Logistics base marker on map */

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { BaseLogistics } from '../../types'

const baseIcon = L.divIcon({
  className: '',
  html: '<div style="background:#f97316;width:18px;height:18px;border-radius:3px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:10px;font-weight:bold">B</span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

interface BaseMarkerProps {
  base: BaseLogistics
}

export function BaseMarker({ base }: BaseMarkerProps) {
  if (!base.latitude || !base.longitude) return null

  return (
    <Marker position={[base.latitude, base.longitude]} icon={baseIcon}>
      <Tooltip>
        <div style={{ fontSize: '12px' }}>
          <strong>{base.code}</strong> — {base.name}<br />
          {base.city && <span>{base.city}<br /></span>}
          <span style={{ color: '#f97316' }}>{base.type}</span>
        </div>
      </Tooltip>
    </Marker>
  )
}
