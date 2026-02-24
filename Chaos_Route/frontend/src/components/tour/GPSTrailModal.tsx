/* Modal tracé GPS d'un tour avec code couleur actif/inactif et journal /
   GPS trail modal with active/inactive color coding and position log */

import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../services/api'

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

/* Seuil d'inactivité en secondes (5 min) / Inactivity threshold in seconds */
const GAP_THRESHOLD_SEC = 5 * 60

const COLOR_ACTIVE = '#22c55e'   // vert / green
const COLOR_INACTIVE = '#ef4444' // rouge / red

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

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
})

/* Segment de polyline coloré / Colored polyline segment */
interface TrailSegment {
  positions: [number, number][]
  active: boolean
}

/* Entrée du journal / Log entry */
interface LogEntry {
  index: number
  timestamp: string
  time: string
  lat: number
  lng: number
  speed: number | null
  accuracy: number | null
  gapSec: number | null
  active: boolean
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

function formatGap(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

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

/* Pan/zoom vers la position sélectionnée / Fly to selected position */
function FlyToPosition({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 15), { duration: 0.5 })
    }
  }, [position, map])
  return null
}

export function GPSTrailModal({ tourId, tourCode, onClose }: GPSTrailModalProps) {
  const [positions, setPositions] = useState<GPSPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null)

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

  /* Construire segments colorés + journal / Build colored segments + log */
  const { segments, logEntries, stats } = useMemo(() => {
    if (positions.length === 0) return { segments: [], logEntries: [], stats: null }

    const segs: TrailSegment[] = []
    const log: LogEntry[] = []
    let totalActive = 0
    let totalInactive = 0
    let gapCount = 0

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const coord: [number, number] = [p.latitude, p.longitude]
      let gapSec: number | null = null
      let active = true

      if (i > 0) {
        const prev = positions[i - 1]
        gapSec = Math.round((new Date(p.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000)
        active = gapSec <= GAP_THRESHOLD_SEC

        const prevCoord: [number, number] = [prev.latitude, prev.longitude]

        if (active) {
          totalActive += gapSec
        } else {
          totalInactive += gapSec
          gapCount++
        }

        // Ajouter segment entre point précédent et actuel / Add segment between prev and current
        const lastSeg = segs[segs.length - 1]
        if (lastSeg && lastSeg.active === active) {
          lastSeg.positions.push(coord)
        } else {
          segs.push({ positions: [prevCoord, coord], active })
        }
      }

      log.push({
        index: i,
        timestamp: p.timestamp,
        time: formatTime(p.timestamp),
        lat: p.latitude,
        lng: p.longitude,
        speed: p.speed,
        accuracy: p.accuracy,
        gapSec,
        active,
      })
    }

    return {
      segments: segs,
      logEntries: log,
      stats: {
        total: positions.length,
        activeMin: Math.round(totalActive / 60),
        inactiveMin: Math.round(totalInactive / 60),
        gaps: gapCount,
        firstTime: formatTime(positions[0].timestamp),
        lastTime: formatTime(positions[positions.length - 1].timestamp),
      },
    }
  }, [positions])

  const allCoords: [number, number][] = positions.map((p) => [p.latitude, p.longitude])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Tracé GPS — {tourCode}
            </h3>
            {stats && (
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{stats.firstTime} → {stats.lastTime}</span>
                <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: COLOR_ACTIVE }}>
                  Actif {stats.activeMin}m
                </span>
                <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: COLOR_INACTIVE }}>
                  Inactif {stats.inactiveMin}m ({stats.gaps} coupure{stats.gaps > 1 ? 's' : ''})
                </span>
                <span>{stats.total} pts</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {positions.length > 0 && (
              <button
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: showLog ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: showLog ? 'var(--bg-tertiary)' : 'transparent',
                }}
                onClick={() => setShowLog(!showLog)}
              >
                Journal
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:opacity-80 text-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Légende / Legend */}
        {!loading && !error && allCoords.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-1.5 border-b text-[11px] shrink-0" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-1 rounded" style={{ backgroundColor: COLOR_ACTIVE }} /> App active (&lt; 5 min entre positions)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 h-1 rounded" style={{ backgroundColor: COLOR_INACTIVE }} /> Perte signal / app inactive (&gt; 5 min)
            </span>
          </div>
        )}

        {/* Contenu : carte + journal optionnel / Content: map + optional log */}
        <div className="flex flex-1 min-h-0">
          {/* Carte / Map */}
          <div className="flex-1 relative">
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

            {!loading && !error && allCoords.length === 0 && (
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
              {allCoords.length >= 2 && (
                <>
                  <FitBounds positions={allCoords} />
                  {segments.map((seg, i) => (
                    <Polyline
                      key={i}
                      positions={seg.positions}
                      pathOptions={{
                        color: seg.active ? COLOR_ACTIVE : COLOR_INACTIVE,
                        weight: 4,
                        opacity: 0.85,
                        dashArray: seg.active ? undefined : '8, 8',
                      }}
                    />
                  ))}
                  <Marker position={allCoords[0]} icon={startIcon} />
                  <Marker position={allCoords[allCoords.length - 1]} icon={endIcon} />
                  {selectedLogIndex != null && (
                    <Marker
                      position={[logEntries[selectedLogIndex].lat, logEntries[selectedLogIndex].lng]}
                      icon={selectedIcon}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>{logEntries[selectedLogIndex].time}</strong><br />
                          {logEntries[selectedLogIndex].speed != null && `${(logEntries[selectedLogIndex].speed! * 3.6).toFixed(0)} km/h`}
                          {logEntries[selectedLogIndex].accuracy != null && ` — ±${logEntries[selectedLogIndex].accuracy!.toFixed(0)}m`}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  <FlyToPosition
                    position={selectedLogIndex != null ? [logEntries[selectedLogIndex].lat, logEntries[selectedLogIndex].lng] : null}
                  />
                </>
              )}
            </MapContainer>
          </div>

          {/* Journal / Log panel */}
          {showLog && (
            <div
              className="w-80 shrink-0 border-l overflow-y-auto"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
            >
              <div className="px-3 py-2 border-b text-xs font-semibold sticky top-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                Journal ({logEntries.length} positions)
              </div>
              {logEntries.map((entry) => (
                <div
                  key={entry.index}
                  className="px-3 py-1.5 border-b text-[11px] flex items-start gap-2 cursor-pointer hover:opacity-80"
                  style={{
                    borderColor: 'var(--border-color)',
                    backgroundColor: selectedLogIndex === entry.index ? 'rgba(249,115,22,0.12)' : 'transparent',
                  }}
                  onClick={() => setSelectedLogIndex(entry.index)}
                >
                  {/* Indicateur couleur / Color indicator */}
                  <span
                    className="mt-1 shrink-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: entry.active ? COLOR_ACTIVE : COLOR_INACTIVE }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{entry.time}</span>
                      {entry.gapSec != null && (
                        <span
                          className="px-1 rounded text-[10px]"
                          style={{
                            color: entry.active ? 'var(--text-muted)' : COLOR_INACTIVE,
                            backgroundColor: entry.active ? 'transparent' : 'rgba(239,68,68,0.1)',
                            fontWeight: entry.active ? 'normal' : 'bold',
                          }}
                        >
                          +{formatGap(entry.gapSec)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span>{entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}</span>
                      {entry.speed != null && <span>{(entry.speed * 3.6).toFixed(0)} km/h</span>}
                      {entry.accuracy != null && <span>±{entry.accuracy.toFixed(0)}m</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
