/* Marqueur PDV sur la carte / PDV marker on map */

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { PDV } from '../../types'

/* Statut volume du PDV / PDV volume status */
export type PdvVolumeStatus = 'none' | 'unassigned' | 'assigned'

function makeIcon(color: string, size: number, borderWidth: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:${borderWidth}px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/* Icônes par statut / Icons by status */
const icons = {
  none: makeIcon('#9ca3af', 14, 2),           // Gris — sans volume / Gray — no volume
  unassigned: makeIcon('#ef4444', 18, 2),      // Rouge — volume non affecté / Red — unassigned volume
  assigned: makeIcon('#22c55e', 18, 2),        // Vert — volume affecté / Green — assigned volume
  selected: makeIcon('#f97316', 24, 3),        // Orange — dans le tour en cours / Orange — in current tour
}

interface PdvMarkerProps {
  pdv: PDV
  onClick?: (pdv: PDV) => void
  selected?: boolean
  volumeStatus?: PdvVolumeStatus
}

export function PdvMarker({ pdv, onClick, selected, volumeStatus = 'none' }: PdvMarkerProps) {
  if (!pdv.latitude || !pdv.longitude) return null

  const icon = selected ? icons.selected : icons[volumeStatus]

  return (
    <Marker
      position={[pdv.latitude, pdv.longitude]}
      icon={icon}
      eventHandlers={onClick ? { click: () => onClick(pdv) } : undefined}
    >
      <Tooltip>
        <div style={{ fontSize: '12px' }}>
          <strong>{pdv.code}</strong> — {pdv.name}<br />
          {pdv.city && <span>{pdv.city}<br /></span>}
          <span style={{ color: '#888' }}>{pdv.type}</span>
          {pdv.has_sas && <span> | SAS: {pdv.sas_capacity} EQC</span>}
        </div>
      </Tooltip>
    </Marker>
  )
}
