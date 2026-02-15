/* Marqueur PDV sur la carte / PDV marker on map */

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { PDV } from '../../types'

const pdvIcon = L.divIcon({
  className: '',
  html: '<div style="background:#22c55e;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

const pdvSelectedIcon = L.divIcon({
  className: '',
  html: '<div style="background:#f97316;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface PdvMarkerProps {
  pdv: PDV
  onClick?: (pdv: PDV) => void
  selected?: boolean
}

export function PdvMarker({ pdv, onClick, selected }: PdvMarkerProps) {
  if (!pdv.latitude || !pdv.longitude) return null

  return (
    <Marker
      position={[pdv.latitude, pdv.longitude]}
      icon={selected ? pdvSelectedIcon : pdvIcon}
      eventHandlers={onClick ? { click: () => onClick(pdv) } : undefined}
    >
      <Tooltip>
        <div style={{ fontSize: '12px' }}>
          <strong>{pdv.code}</strong> — {pdv.name}<br />
          {pdv.city && <span>{pdv.city}<br /></span>}
          <span style={{ color: '#888' }}>{pdv.type}</span>
          {pdv.has_sas && <span> | SAS: {pdv.sas_capacity} EQP</span>}
        </div>
      </Tooltip>
    </Marker>
  )
}
