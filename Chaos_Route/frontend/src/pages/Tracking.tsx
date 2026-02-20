/* Page suivi temps reel chauffeurs / Real-time driver tracking page */

import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../services/api'
import { trackingWS } from '../services/websocket'
import { DriverMarker } from '../components/map/DriverMarker'
import { PdvSearch } from '../components/tracking/PdvSearch'
import type { DriverPosition, DeliveryAlert, BaseLogistics, ActiveTour, ActiveTourStop } from '../types'

const POLLING_INTERVAL = 10_000

const pdvIcon = L.divIcon({
  html: `<div style="
    background: #f97316;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  ">&#x1F3EA;</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const contextIcon = L.divIcon({
  html: `<div style="
    background: #6b7280;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: white;
    font-weight: bold;
  "></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

/* Auto-fit la carte sur les bounds / Auto-fit map to bounds */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
    }
  }, [points, map])
  return null
}

export default function Tracking() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [baseId, setBaseId] = useState<number | ''>('')
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [positions, setPositions] = useState<DriverPosition[]>([])
  const [alerts, setAlerts] = useState<DeliveryAlert[]>([])
  const [dashboard, setDashboard] = useState({ active_tours: 0, completed_tours: 0, delayed_tours: 0, active_alerts: 0 })
  const [activeTours, setActiveTours] = useState<ActiveTour[]>([])
  const [selectedResult, setSelectedResult] = useState<{ tour: ActiveTour; stop: ActiveTourStop } | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [lastRefresh, setLastRefresh] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data))
  }, [])

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { date }
      if (baseId) params.base_id = baseId

      const [posRes, alertRes, dashRes, stopsRes] = await Promise.all([
        api.get<DriverPosition[]>('/tracking/positions', { params }),
        api.get<DeliveryAlert[]>('/tracking/alerts', { params: { date } }),
        api.get('/tracking/dashboard', { params }),
        api.get<ActiveTour[]>('/tracking/active-stops', { params }),
      ])
      setPositions(posRes.data)
      setAlerts(alertRes.data)
      setDashboard(dashRes.data)
      setActiveTours(stopsRes.data)
      setLastRefresh(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (e) {
      console.error('Failed to load tracking data', e)
    }
  }, [date, baseId])

  useEffect(() => { loadData() }, [loadData])

  // Polling fallback
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(loadData, POLLING_INTERVAL)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [loadData])

  // WebSocket live updates
  useEffect(() => {
    trackingWS.setStatusListener(setWsConnected)
    trackingWS.connect()
    const unsubGps = trackingWS.subscribe('gps_update', (data) => {
      setPositions((prev) => {
        const idx = prev.findIndex((p) => p.tour_id === data.tour_id)
        const updated: DriverPosition = {
          tour_id: data.tour_id as number,
          tour_code: (data.tour_code as string) || '',
          driver_name: data.driver_name as string | undefined,
          latitude: data.latitude as number,
          longitude: data.longitude as number,
          speed: data.speed as number | undefined,
          accuracy: data.accuracy as number | undefined,
          timestamp: data.timestamp as string,
          stops_total: idx >= 0 ? prev[idx].stops_total : 0,
          stops_delivered: idx >= 0 ? prev[idx].stops_delivered : 0,
        }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
    })
    const unsubAlert = trackingWS.subscribe('alert', () => {
      loadData()
    })
    const unsubStop = trackingWS.subscribe('stop_event', () => {
      loadData()
    })
    return () => {
      unsubGps()
      unsubAlert()
      unsubStop()
      trackingWS.setStatusListener(null)
      trackingWS.disconnect()
    }
  }, [loadData])

  const handleAcknowledge = async (alertId: number) => {
    await api.put(`/tracking/alerts/${alertId}/acknowledge`)
    loadData()
  }

  const severityColor = (s: string) => {
    if (s === 'CRITICAL') return 'var(--color-danger)'
    if (s === 'WARNING') return '#f97316'
    return 'var(--text-muted)'
  }

  return (
    <div className="p-6 flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Header + Filtres / Header + Filters */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Suivi chauffeurs
        </h1>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          <select value={baseId} onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Toutes les bases</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-3 items-center">
        {[
          { label: 'Actifs', value: dashboard.active_tours, color: '#3b82f6' },
          { label: 'Termines', value: dashboard.completed_tours, color: '#22c55e' },
          { label: 'Alertes', value: dashboard.active_alerts, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="px-4 py-2 rounded-lg border text-center"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', minWidth: 100 }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: wsConnected ? '#22c55e' : '#ef4444' }}>
            {wsConnected ? 'WS connecte' : 'WS deconnecte'}
          </span>
          {lastRefresh ? <span>MAJ {lastRefresh}</span> : null}
        </div>
      </div>

      {/* Contenu principal : carte + panel lateral / Main content: map + side panel */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Carte / Map */}
        <div className="flex-1 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
          <MapContainer
            center={[50.85, 4.35]}
            zoom={8}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {positions.map((p) => (
              <DriverMarker
                key={p.tour_id}
                position={p}
                highlighted={selectedResult ? p.tour_id === selectedResult.tour.tour_id : false}
              />
            ))}

            {/* Overlays quand un PDV est selectionne / Overlays when a PDV is selected */}
            {selectedResult && (() => {
              const stop = selectedResult.stop
              const driverPos = positions.find((p) => p.tour_id === selectedResult.tour.tour_id)
              const pdvCoord: [number, number] | null =
                stop.pdv_latitude != null && stop.pdv_longitude != null
                  ? [stop.pdv_latitude, stop.pdv_longitude]
                  : null

              // Stops contexte : dernier livre + suivant / Context stops: last delivered + next
              const tourStops = selectedResult.tour.stops
              const currentIdx = tourStops.findIndex((s) => s.stop_id === stop.stop_id)
              const lastDelivered = tourStops.slice(0, currentIdx).reverse().find((s) => s.delivery_status === 'DELIVERED')
              const nextStop = tourStops[currentIdx + 1]

              // Points pour FitBounds
              const fitPoints: [number, number][] = []
              if (driverPos) fitPoints.push([driverPos.latitude, driverPos.longitude])
              if (pdvCoord) fitPoints.push(pdvCoord)

              return (
                <>
                  {fitPoints.length >= 2 && <FitBounds points={fitPoints} />}

                  {/* Marqueur PDV selectionne / Selected PDV marker */}
                  {pdvCoord && <Marker position={pdvCoord} icon={pdvIcon} />}

                  {/* Ligne pointillee chauffeur → PDV / Dashed line driver → PDV */}
                  {driverPos && pdvCoord && (
                    <Polyline
                      positions={[[driverPos.latitude, driverPos.longitude], pdvCoord]}
                      pathOptions={{ color: '#f97316', weight: 3, opacity: 0.7, dashArray: '8, 8' }}
                    />
                  )}

                  {/* Marqueur contexte : dernier livre / Context marker: last delivered */}
                  {lastDelivered && lastDelivered.pdv_latitude != null && lastDelivered.pdv_longitude != null && (
                    <Marker position={[lastDelivered.pdv_latitude, lastDelivered.pdv_longitude]} icon={contextIcon} />
                  )}

                  {/* Marqueur contexte : prochain stop / Context marker: next stop */}
                  {nextStop && nextStop.pdv_latitude != null && nextStop.pdv_longitude != null && (
                    <Marker position={[nextStop.pdv_latitude, nextStop.pdv_longitude]} icon={contextIcon} />
                  )}
                </>
              )
            })()}
          </MapContainer>
        </div>

        {/* Panel lateral / Side panel */}
        <div className="w-80 flex flex-col gap-3 min-h-0">
          {/* Recherche PDV / PDV Search */}
          <PdvSearch
            activeTours={activeTours}
            selectedResult={selectedResult}
            onSelect={setSelectedResult}
          />

          {/* Liste tours actifs / Active tours list */}
          <div className="flex-1 rounded-xl border overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              Tours actifs ({positions.length})
            </div>
            {positions.length === 0 ? (
              <div className="p-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Aucun chauffeur en tournee</div>
            ) : (
              positions.map((p) => (
                <div key={p.tour_id} className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>{p.tour_code}</span>
                    <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>{p.stops_delivered}/{p.stops_total}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.driver_name || '—'}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    GPS: {new Date(p.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {p.speed != null && ` · ${Math.round(p.speed)} km/h`}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Panel alertes / Alert panel */}
          <div className="rounded-xl border overflow-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', maxHeight: 200 }}>
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              Alertes ({alerts.length})
            </div>
            {alerts.length === 0 ? (
              <div className="p-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Aucune alerte</div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="px-3 py-2 border-b flex items-start gap-2" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-xs font-bold mt-0.5" style={{ color: severityColor(a.severity) }}>
                    {a.severity === 'CRITICAL' ? '!!!' : a.severity === 'WARNING' ? '!!' : 'i'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{a.alert_type}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{a.message}</div>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(a.id)}
                    className="text-xs px-2 py-0.5 rounded border shrink-0"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                  >OK</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
