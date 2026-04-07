/* Carte de suivi des livraisons PDV / PDV delivery tracking map */

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { DriverPosition, ActiveTour, ActiveTourStop, PdvDeliveryEntry } from '../../types'
import { TEMPERATURE_COLORS } from '../../types'
import type { TemperatureClass } from '../../types'
import 'leaflet/dist/leaflet.css'

/* ---- Icônes ---- */

function getPdvIcon(code: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      background:#22c55e;width:38px;height:38px;border-radius:50%;
      border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:bold;color:white;
      animation:pdv-pulse 2s ease-in-out infinite;
    ">${code}</div>`,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function getTruckIcon(color: string, label: string, highlighted: boolean): L.DivIcon {
  const size = highlighted ? 40 : 32
  const border = highlighted ? '3px solid #000' : '2px solid white'
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        background:${color};width:${size}px;height:${size}px;border-radius:50%;
        border:${border};box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
        font-size:${highlighted ? 18 : 14}px;
      ">🚛</div>
      <div style="
        margin-top:2px;background:${color};color:white;
        font-size:10px;font-weight:bold;padding:1px 5px;border-radius:8px;
        white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);
      ">${label}</div>
    </div>`,
    className: '',
    iconSize: [size, size + 18],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  })
}

const STOP_COLORS: Record<string, string> = {
  DELIVERED: '#22c55e',
  ARRIVED: '#3b82f6',
  PENDING: '#9ca3af',
  SKIPPED: '#ef4444',
}

function getStopIcon(order: number, status: string): L.DivIcon {
  const color = STOP_COLORS[status] || '#9ca3af'
  return L.divIcon({
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;
      border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:bold;color:white;">L${order}</div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

/* ---- FitBounds ---- */

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  const lastKey = useRef('')
  useEffect(() => {
    const key = points.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|')
    if (key === lastKey.current) return
    lastKey.current = key
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 14 })
    } else if (points.length === 1) {
      map.setView(points[0], 13)
    }
  }, [points, map])
  return null
}

/* ---- Props ---- */

interface PdvDeliveryMapProps {
  deliveries: PdvDeliveryEntry[]
  positions: DriverPosition[]
  activeTours: ActiveTour[]
  pdvLocation: { lat: number; lng: number; code: string; name: string } | null
  selectedTourId: number | null
  onTourSelect: (tourId: number | null) => void
  wsConnected: boolean
  tourLabels: Map<number, string>
}

/* ---- Composant ---- */

export function PdvDeliveryMap({
  deliveries, positions, activeTours, pdvLocation,
  selectedTourId, onTourSelect, wsConnected, tourLabels,
}: PdvDeliveryMapProps) {

  /* Couleur température par tour */
  const tourColorMap = new Map<number, string>()
  for (const d of deliveries) {
    if (!tourColorMap.has(d.tour_id)) {
      const cls = (d.temperature_classes?.[0] ?? 'SEC') as TemperatureClass
      tourColorMap.set(d.tour_id, TEMPERATURE_COLORS[cls] ?? TEMPERATURE_COLORS.SEC)
    }
  }

  /* Points pour FitBounds */
  const fitPoints: [number, number][] = []
  if (pdvLocation) fitPoints.push([pdvLocation.lat, pdvLocation.lng])

  if (selectedTourId) {
    /* Zoom sur le tour sélectionné + PDV */
    const tour = activeTours.find(t => t.tour_id === selectedTourId)
    if (tour) {
      for (const s of tour.stops) {
        if (s.pdv_latitude && s.pdv_longitude) fitPoints.push([s.pdv_latitude, s.pdv_longitude])
      }
    }
    const pos = positions.find(p => p.tour_id === selectedTourId)
    if (pos) fitPoints.push([pos.latitude, pos.longitude])
  } else {
    /* Zoom sur tous les camions + PDV */
    for (const p of positions) {
      fitPoints.push([p.latitude, p.longitude])
    }
  }

  /* Tour sélectionné — stops et polyline */
  const selectedTour = selectedTourId ? activeTours.find(t => t.tour_id === selectedTourId) : null
  const stopCoords: [number, number][] = selectedTour
    ? selectedTour.stops
        .filter((s: ActiveTourStop) => s.pdv_latitude && s.pdv_longitude)
        .sort((a: ActiveTourStop, b: ActiveTourStop) => a.sequence_order - b.sequence_order)
        .map((s: ActiveTourStop) => [s.pdv_latitude!, s.pdv_longitude!])
    : []

  /* Légende */
  const legendEntries = [...tourLabels.entries()].map(([tourId, label]) => ({
    tourId,
    label,
    color: tourColorMap.get(tourId) ?? TEMPERATURE_COLORS.SEC,
  }))

  return (
    <div className="relative" style={{ height: '100%' }}>
      {/* Animation CSS pulsante */}
      <style>{`
        @keyframes pdv-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
        }
      `}</style>

      <MapContainer center={pdvLocation ? [pdvLocation.lat, pdvLocation.lng] : [50.5, 4.35]} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {fitPoints.length > 0 && <FitBounds points={fitPoints} />}

        {/* Marqueur PDV */}
        {pdvLocation && (
          <Marker position={[pdvLocation.lat, pdvLocation.lng]} icon={getPdvIcon(pdvLocation.code)}>
            <Popup>
              <div style={{ fontSize: 13, minWidth: 140 }}>
                <strong>{pdvLocation.code}</strong> — {pdvLocation.name}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marqueurs camions */}
        {positions.map(pos => {
          const color = tourColorMap.get(pos.tour_id) ?? '#9ca3af'
          const label = tourLabels.get(pos.tour_id) ?? pos.tour_code
          const isSelected = selectedTourId === pos.tour_id
          return (
            <Marker
              key={pos.tour_id}
              position={[pos.latitude, pos.longitude]}
              icon={getTruckIcon(color, label, isSelected)}
              eventHandlers={{ click: () => onTourSelect(isSelected ? null : pos.tour_id) }}
            >
              <Popup>
                <div style={{ fontSize: 12, minWidth: 150 }}>
                  <div><strong>{pos.tour_code}</strong></div>
                  <div>{pos.driver_name || '—'}</div>
                  <div style={{ color: '#666', marginTop: 4 }}>
                    {pos.stops_delivered}/{pos.stops_total} livraisons
                    {pos.speed != null && ` · ${Math.round(pos.speed)} km/h`}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Stops du tour sélectionné */}
        {selectedTour && selectedTour.stops
          .filter((s: ActiveTourStop) => s.pdv_latitude && s.pdv_longitude)
          .sort((a: ActiveTourStop, b: ActiveTourStop) => a.sequence_order - b.sequence_order)
          .map((stop: ActiveTourStop) => (
            <Marker
              key={stop.stop_id}
              position={[stop.pdv_latitude!, stop.pdv_longitude!]}
              icon={getStopIcon(stop.sequence_order, stop.delivery_status)}
            >
              <Popup>
                <div style={{ fontSize: 12, minWidth: 140 }}>
                  <strong>L{stop.sequence_order}</strong> — {stop.pdv_name ?? stop.pdv_code}
                  <div style={{ color: '#666' }}>{stop.pdv_city}</div>
                  <div>{stop.eqp_count} EQC · {stop.delivery_status}</div>
                </div>
              </Popup>
            </Marker>
          ))
        }

        {/* Polyline du tour sélectionné */}
        {stopCoords.length >= 2 && (
          <Polyline
            positions={stopCoords}
            pathOptions={{
              color: tourColorMap.get(selectedTourId!) ?? '#3b82f6',
              weight: 3,
              opacity: 0.6,
              dashArray: '6 4',
            }}
          />
        )}
      </MapContainer>

      {/* Légende */}
      {legendEntries.length > 0 && (
        <div
          className="absolute top-2 right-2 z-[1000] rounded-lg px-2.5 py-1.5 text-xs"
          style={{ backgroundColor: 'rgba(255,255,255,0.92)', border: '1px solid #e5e5e5', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}
        >
          {legendEntries.map(({ tourId, label, color }) => (
            <div
              key={tourId}
              className="flex items-center gap-1.5 py-0.5 cursor-pointer"
              style={{ fontWeight: selectedTourId === tourId ? 'bold' : 'normal' }}
              onClick={() => onTourSelect(selectedTourId === tourId ? null : tourId)}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Indicateur WebSocket */}
      <div
        className="absolute bottom-2 right-2 z-[1000] flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
        style={{ backgroundColor: 'rgba(255,255,255,0.85)', color: wsConnected ? '#22c55e' : '#ef4444' }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsConnected ? '#22c55e' : '#ef4444' }} />
        {wsConnected ? 'Live' : 'Hors ligne'}
      </div>
    </div>
  )
}
