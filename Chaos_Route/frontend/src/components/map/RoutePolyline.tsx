/* Tracé de route sur la carte / Route polyline on map */

import { Polyline, Tooltip } from 'react-leaflet'

interface RoutePolylineProps {
  positions: [number, number][]
  color?: string
  weight?: number
  tourCode?: string
}

export function RoutePolyline({ positions, color = '#f97316', weight = 3, tourCode }: RoutePolylineProps) {
  if (positions.length < 2) return null

  return (
    <Polyline positions={positions} pathOptions={{ color, weight, opacity: 0.8 }}>
      {tourCode && (
        <Tooltip sticky>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{tourCode}</span>
        </Tooltip>
      )}
    </Polyline>
  )
}
