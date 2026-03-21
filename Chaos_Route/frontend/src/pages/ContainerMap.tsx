/* Carte contenants — heatmap PDV par taux de dépassement PUO /
   Container map — PDV heatmap by PUO overage rate.
   Cercles colorés : vert=OK, orange=proche limite, rouge=dépassement. */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import api from '../services/api'
import 'leaflet/dist/leaflet.css'

interface PDVLight {
  id: number; code: string; name: string
  latitude?: number; longitude?: number
  city?: string
}

interface StockRow {
  pdv_id: number; pdv_code: string; pdv_name: string
  support_type_id: number; support_type_code: string; support_type_name: string
  current_stock: number; puo: number | null; unit_value: number | null
}

interface SupportType {
  id: number; code: string; name: string; is_active: boolean
}

/* Statut PUO par PDV / PUO status per PDV */
interface PdvPuoStatus {
  pdv: PDVLight
  lines: StockRow[]
  totalStock: number
  totalPuo: number
  totalOverage: number
  overageValue: number
  ratio: number // stock / puo (1.0 = exact, >1 = overage)
  hasPuo: boolean
}

/* Auto-fit bounds / Auto-fit map to points */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)))
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })
  }, [map, points])
  return null
}

/* Couleur par ratio PUO / Color by PUO ratio */
function getColor(status: PdvPuoStatus): string {
  if (!status.hasPuo) return '#6b7280' // gris — pas de PUO défini
  if (status.ratio > 1.2) return '#ef4444'  // rouge — fort dépassement
  if (status.ratio > 1.0) return '#f97316'  // orange — léger dépassement
  if (status.ratio > 0.8) return '#22c55e'  // vert — dans les clous
  return '#3b82f6'                           // bleu — stock bas
}

function getRadius(status: PdvPuoStatus, zoom: number): number {
  const base = status.hasPuo && status.totalOverage > 0
    ? Math.min(20, 8 + status.totalOverage * 0.3)
    : 6
  const scale = Math.max(0.6, (zoom - 6) * 0.15 + 0.6)
  return base * scale
}

export default function ContainerMap() {
  const [pdvs, setPdvs] = useState<PDVLight[]>([])
  const [stocks, setStocks] = useState<StockRow[]>([])
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [loading, setLoading] = useState(true)
  const [stFilter, setStFilter] = useState<number | ''>('')
  const [showNoPuo, setShowNoPuo] = useState(false)
  const [zoom, setZoom] = useState(8)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [pdvRes, stockRes, stRes] = await Promise.all([
        api.get('/pdvs/').catch(() => ({ data: [] })),
        api.get('/pdv-stock/').catch(() => ({ data: [] })),
        api.get('/support-types/').catch(() => ({ data: [] })),
      ])
      setPdvs(pdvRes.data)
      setStocks(stockRes.data)
      setSupportTypes(stRes.data.filter((s: SupportType) => s.is_active))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* Agréger stock par PDV / Aggregate stock per PDV */
  const pdvStatuses: PdvPuoStatus[] = useMemo(() => {
    const filteredStocks = stFilter
      ? stocks.filter((s) => s.support_type_id === stFilter)
      : stocks

    const byPdv = new Map<number, StockRow[]>()
    for (const s of filteredStocks) {
      if (!byPdv.has(s.pdv_id)) byPdv.set(s.pdv_id, [])
      byPdv.get(s.pdv_id)!.push(s)
    }

    const result: PdvPuoStatus[] = []
    for (const [pdvId, lines] of byPdv) {
      const pdv = pdvs.find((p) => p.id === pdvId)
      if (!pdv || !pdv.latitude || !pdv.longitude) continue

      const totalStock = lines.reduce((s, l) => s + l.current_stock, 0)
      const puoLines = lines.filter((l) => l.puo !== null && l.puo !== undefined)
      const hasPuo = puoLines.length > 0
      const totalPuo = puoLines.reduce((s, l) => s + (l.puo ?? 0), 0)
      const totalOverage = puoLines.reduce((s, l) => {
        const over = l.current_stock - (l.puo ?? 0)
        return s + (over > 0 ? over : 0)
      }, 0)
      const overageValue = puoLines.reduce((s, l) => {
        const over = l.current_stock - (l.puo ?? 0)
        return s + (over > 0 ? over * (l.unit_value ?? 0) : 0)
      }, 0)
      const ratio = hasPuo && totalPuo > 0 ? totalStock / totalPuo : 0

      result.push({ pdv, lines, totalStock, totalPuo, totalOverage, overageValue, ratio, hasPuo })
    }
    return result
  }, [pdvs, stocks, stFilter])

  /* Filtrage affichage / Display filtering */
  const visibleStatuses = useMemo(() => {
    return pdvStatuses.filter((s) => showNoPuo || s.hasPuo)
  }, [pdvStatuses, showNoPuo])

  const points: [number, number][] = useMemo(() => {
    return visibleStatuses
      .filter((s) => s.pdv.latitude && s.pdv.longitude)
      .map((s) => [s.pdv.latitude!, s.pdv.longitude!])
  }, [visibleStatuses])

  /* KPI */
  const kpi = useMemo(() => {
    const withPuo = pdvStatuses.filter((s) => s.hasPuo)
    const overages = withPuo.filter((s) => s.totalOverage > 0)
    const totalOverageValue = overages.reduce((s, o) => s + o.overageValue, 0)
    return { total: pdvStatuses.length, withPuo: withPuo.length, overages: overages.length, totalOverageValue }
  }, [pdvStatuses])

  return (
    <div className="h-full flex flex-col">
      {/* Header + filtres */}
      <div className="p-3 flex items-center justify-between flex-wrap gap-2 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Carte contenants — Depassements PUO
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={stFilter}
            onChange={(e) => setStFilter(e.target.value ? Number(e.target.value) : '')}
            className="px-2 py-1 rounded text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">Tous les types</option>
            {supportTypes.map((st) => (
              <option key={st.id} value={st.id}>{st.code} — {st.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showNoPuo} onChange={(e) => setShowNoPuo(e.target.checked)} />
            Afficher PDV sans PUO
          </label>
        </div>
      </div>

      {/* KPI bar */}
      <div className="flex items-center gap-4 px-3 py-2 text-xs border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <span style={{ color: 'var(--text-muted)' }}>{kpi.total} PDV avec stock</span>
        <span style={{ color: 'var(--text-muted)' }}>{kpi.withPuo} avec PUO</span>
        <span style={{ color: kpi.overages > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
          {kpi.overages} en depassement
        </span>
        {kpi.totalOverageValue > 0 && (
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>
            {kpi.totalOverageValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR
          </span>
        )}
      </div>

      {/* Carte */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-[500]" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <span style={{ color: '#fff' }}>Chargement...</span>
          </div>
        )}
        <MapContainer
          center={[50.5, 4.35]}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />
          <FitBounds points={points} />
          <ZoomTracker onZoom={setZoom} />

          {visibleStatuses.map((status) => (
            <CircleMarker
              key={status.pdv.id}
              center={[status.pdv.latitude!, status.pdv.longitude!]}
              radius={getRadius(status, zoom)}
              pathOptions={{
                color: getColor(status),
                fillColor: getColor(status),
                fillOpacity: 0.7,
                weight: status.totalOverage > 0 ? 2 : 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div style={{ fontSize: '11px', lineHeight: 1.4 }}>
                  <strong>{status.pdv.code}</strong> — {status.pdv.name}
                  {status.pdv.city && <span className="ml-1" style={{ opacity: 0.7 }}>({status.pdv.city})</span>}
                  <br />
                  Stock: {status.totalStock}
                  {status.hasPuo && <> | PUO: {status.totalPuo}</>}
                  {status.totalOverage > 0 && (
                    <span style={{ color: '#ef4444', fontWeight: 600 }}> | +{status.totalOverage}</span>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div style={{ minWidth: '220px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                    {status.pdv.code} — {status.pdv.name}
                  </div>
                  {status.pdv.city && (
                    <div style={{ color: '#666', marginBottom: '6px' }}>{status.pdv.city}</div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '2px 4px', fontSize: '10px' }}>Type</th>
                        <th style={{ textAlign: 'right', padding: '2px 4px', fontSize: '10px' }}>Stock</th>
                        <th style={{ textAlign: 'right', padding: '2px 4px', fontSize: '10px' }}>PUO</th>
                        <th style={{ textAlign: 'right', padding: '2px 4px', fontSize: '10px' }}>Ecart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.lines.map((l, i) => {
                        const diff = l.puo !== null && l.puo !== undefined ? l.current_stock - l.puo : null
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '2px 4px' }}>{l.support_type_code}</td>
                            <td style={{ textAlign: 'right', padding: '2px 4px', fontFamily: 'monospace' }}>{l.current_stock}</td>
                            <td style={{ textAlign: 'right', padding: '2px 4px', fontFamily: 'monospace', color: '#888' }}>
                              {l.puo ?? '—'}
                            </td>
                            <td style={{
                              textAlign: 'right', padding: '2px 4px', fontFamily: 'monospace', fontWeight: 600,
                              color: diff === null ? '#888' : diff > 0 ? '#ef4444' : diff < 0 ? '#3b82f6' : '#22c55e',
                            }}>
                              {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {status.overageValue > 0 && (
                    <div style={{ marginTop: '6px', color: '#f59e0b', fontWeight: 600, fontSize: '11px' }}>
                      Projection: {status.overageValue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR
                    </div>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Légende flottante / Floating legend */}
        <div
          className="absolute bottom-4 left-4 z-[1000] rounded-xl border p-3 text-xs space-y-1.5"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', opacity: 0.95 }}
        >
          <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Legende PUO</div>
          {[
            { color: '#3b82f6', label: 'Stock bas (< 80% PUO)' },
            { color: '#22c55e', label: 'OK (80-100% PUO)' },
            { color: '#f97316', label: 'Leger depassement (100-120%)' },
            { color: '#ef4444', label: 'Fort depassement (> 120%)' },
            { color: '#6b7280', label: 'Pas de PUO defini' },
          ].map((item) => (
            <div key={item.color} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* Suivi du zoom / Zoom level tracker */
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onZoom(map.getZoom())
    map.on('zoomend', handler)
    return () => { map.off('zoomend', handler) }
  }, [map, onZoom])
  return null
}
