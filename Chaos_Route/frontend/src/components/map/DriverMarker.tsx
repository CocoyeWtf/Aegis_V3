/* Marker position chauffeur sur la carte / Driver position marker on map */

import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { DriverPosition } from '../../types'

const TRUCK_ICONS: Record<string, L.DivIcon> = {}

function getTruckIcon(color: string): L.DivIcon {
  if (!TRUCK_ICONS[color]) {
    TRUCK_ICONS[color] = L.divIcon({
      html: `<div style="
        background: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
      ">🚛</div>`,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    })
  }
  return TRUCK_ICONS[color]
}

function getColor(position: DriverPosition): string {
  const progress = position.stops_total > 0
    ? position.stops_delivered / position.stops_total
    : 0
  if (progress >= 0.8) return '#22c55e'     // vert / green
  if (progress >= 0.4) return '#f97316'     // orange
  return '#ef4444'                           // rouge / red
}

interface DriverMarkerProps {
  position: DriverPosition
  onClick?: () => void
}

export function DriverMarker({ position, onClick }: DriverMarkerProps) {
  const color = getColor(position)
  const icon = getTruckIcon(color)

  const lastUpdate = new Date(position.timestamp)
  const timeStr = lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <Marker
      position={[position.latitude, position.longitude]}
      icon={icon}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      <Popup>
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 'bold', fontSize: 13 }}>{position.tour_code}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{position.driver_name || '—'}</div>
          <hr style={{ margin: '4px 0', borderColor: '#eee' }} />
          <div style={{ fontSize: 11 }}>
            Progression: <strong>{position.stops_delivered}/{position.stops_total}</strong>
          </div>
          {position.speed != null && (
            <div style={{ fontSize: 11 }}>
              Vitesse: <strong>{Math.round(position.speed)} km/h</strong>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#999' }}>
            MAJ: {timeStr}
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
