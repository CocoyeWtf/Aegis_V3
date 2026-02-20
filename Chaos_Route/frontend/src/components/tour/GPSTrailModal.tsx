/* Modal tracé GPS d'un tour / GPS trail modal for a tour */

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../services/api'
import { RoutePolyline } from '../map/RoutePolyline'

interface GPSPosition {
  id: number
  latitude: number
  longitude: number
  timestamp: string
  speed: number | null
  accuracy: number | null
}

interface GPSTrailModalProps {
  tourId: number
  tourCode: string
  onClose: () => void
}

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
})

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
})

/* Auto-fit la carte sur les bounds du tracé / Auto-fit map to trail bounds */
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(([lat, lng]) => [lat, lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [positions, map])
  return null
}

export function GPSTrailModal({ tourId, tourCode, onClose }: GPSTrailModalProps) {
  const [positions, setPositions] = useState<GPSPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<GPSPosition[]>(`/tracking/tour/${tourId}/trail`)
        setPositions(data)
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } }; message?: string }
        setError(err?.response?.data?.detail || err?.message || 'Erreur')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tourId])

  const coords: [number, number][] = positions.map((p) => [p.latitude, p.longitude])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-2xl w-full max-w-5xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Tracé GPS — {tourCode}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-80 text-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            &times;
          </button>
        </div>

        {/* Contenu / Content */}
        <div className="relative" style={{ height: 'calc(100% - 52px)' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <span className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</span>
            </div>
          )}

          {!loading && !error && coords.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun tracé GPS pour ce tour</span>
            </div>
          )}

          <MapContainer
            center={[50.85, 4.35]}
            zoom={8}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {coords.length >= 2 && (
              <>
                <FitBounds positions={coords} />
                <RoutePolyline positions={coords} color="#3b82f6" weight={4} tourCode={tourCode} />
                <Marker position={coords[0]} icon={startIcon} />
                <Marker position={coords[coords.length - 1]} icon={endIcon} />
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
