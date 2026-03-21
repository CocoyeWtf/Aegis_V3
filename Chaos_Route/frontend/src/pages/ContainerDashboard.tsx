/* Dashboard contenants — vue d'ensemble visuelle type Apple /
   Container dashboard — visual overview, Apple-quality design.
   Jauges, tendances, alertes, projection financière. */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import api from '../services/api'

interface BaseStock {
  id: number; base_id: number; base_code: string; base_name: string
  support_type_id: number; support_type_code: string; support_type_name: string
  unit_quantity: number; unit_label: string | null
  current_stock: number; last_updated_at: string | null
}

interface SupportType {
  id: number; code: string; name: string; unit_quantity: number
  unit_label?: string | null; image_path?: string | null
  alert_threshold?: number | null; unit_value?: number | null
  content_item_label?: string | null; content_items_per_unit?: number | null
  content_item_value?: number | null; supplier_plant?: string | null
  is_active: boolean
}

interface Movement {
  id: number; base_name: string; support_type_code: string; support_type_name: string
  movement_type: string; quantity: number; timestamp: string; reference?: string
}

interface Base { id: number; code: string; name: string }

const MOVEMENT_COLORS: Record<string, string> = {
  RECEIVED_FROM_PDV: '#22c55e',
  DELIVERY_PREP: '#3b82f6',
  SUPPLIER_RETURN: '#f97316',
  INVENTORY_ADJUSTMENT: '#a855f7',
  BASE_INVENTORY: '#06b6d4',
}

export default function ContainerDashboard() {
  const navigate = useNavigate()
  const [stocks, setStocks] = useState<BaseStock[]>([])
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [selectedBaseId, setSelectedBaseId] = useState<number | ''>('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [stockRes, stRes, mvRes, baseRes] = await Promise.all([
        api.get('/base-container-stock/', { params: { base_id: selectedBaseId || undefined } }).catch(() => ({ data: [] })),
        api.get('/support-types/').catch(() => ({ data: [] })),
        api.get('/base-container-stock/movements/', { params: { base_id: selectedBaseId || undefined, limit: 200 } }).catch(() => ({ data: [] })),
        api.get('/bases/').catch(() => ({ data: [] })),
      ])
      setStocks(stockRes.data)
      setSupportTypes(stRes.data.filter((s: SupportType) => s.is_active))
      setMovements(mvRes.data)
      setBases(baseRes.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedBaseId])

  useEffect(() => { fetchData() }, [fetchData])

  // Agréger stock par type de support / Aggregate stock by support type
  const stockByType = useMemo(() => {
    const map: Record<number, { type: SupportType; totalStock: number; threshold: number; value: number }> = {}
    for (const s of stocks) {
      const st = supportTypes.find((t) => t.id === s.support_type_id)
      if (!st) continue
      if (!map[st.id]) {
        map[st.id] = {
          type: st,
          totalStock: 0,
          threshold: st.alert_threshold || 0,
          value: 0,
        }
      }
      map[st.id].totalStock += s.current_stock
      map[st.id].value += s.current_stock * (st.unit_value || 0)
    }
    return Object.values(map).sort((a, b) => b.totalStock - a.totalStock)
  }, [stocks, supportTypes])

  // Alertes : stock > seuil ou stock négatif / Alerts: stock > threshold or negative
  const alerts = useMemo(() => {
    const list: { type: string; message: string; severity: 'warning' | 'danger' | 'info' }[] = []
    for (const s of stockByType) {
      if (s.totalStock < 0) {
        list.push({ type: s.type.name, message: `Stock negatif (${s.totalStock})`, severity: 'danger' })
      } else if (s.threshold > 0 && s.totalStock > s.threshold) {
        const excess = s.totalStock - s.threshold
        list.push({ type: s.type.name, message: `Depassement seuil de ${excess} unites (seuil: ${s.threshold})`, severity: 'warning' })
      } else if (s.threshold > 0 && s.totalStock < s.threshold * 0.2) {
        list.push({ type: s.type.name, message: `Stock tres bas (${s.totalStock}/${s.threshold})`, severity: 'info' })
      }
    }
    return list
  }, [stockByType])

  // Valeur totale immobilisée / Total immobilized value
  const totalValue = useMemo(() => stockByType.reduce((sum, s) => sum + s.value, 0), [stockByType])

  // Mouvements agrégés par jour (7 derniers jours) / Movements by day (last 7 days)
  const dailyMovements = useMemo(() => {
    const today = new Date()
    const days: { date: string; in: number; out: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().slice(0, 10)
      const dayMvs = movements.filter((m) => m.timestamp.startsWith(ds))
      days.push({
        date: ds.slice(5),
        in: dayMvs.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0),
        out: Math.abs(dayMvs.filter((m) => m.quantity < 0).reduce((s, m) => s + m.quantity, 0)),
      })
    }
    return days
  }, [movements])

  // Couleur jauge / Gauge color
  const gaugeColor = (stock: number, threshold: number) => {
    if (stock < 0) return '#ef4444'
    if (threshold <= 0) return '#3b82f6'
    const ratio = stock / threshold
    if (ratio > 1.2) return '#ef4444'  // Dépassement
    if (ratio > 0.8) return '#22c55e'  // Bien
    if (ratio > 0.4) return '#f59e0b'  // Moyen
    return '#3b82f6'                    // Bas
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Dashboard Contenants
        </h1>
        <div className="flex gap-2 items-center">
          <select value={selectedBaseId} onChange={(e) => setSelectedBaseId(Number(e.target.value) || '')}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Toutes les bases</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>}

      {!loading && (
        <>
          {/* ── Alertes ── */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                  style={{
                    backgroundColor: a.severity === 'danger' ? '#ef444415' : a.severity === 'warning' ? '#f59e0b15' : '#3b82f615',
                    border: `1px solid ${a.severity === 'danger' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                  }}>
                  <span className="text-lg">{a.severity === 'danger' ? '!' : a.severity === 'warning' ? '!' : 'i'}</span>
                  <div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.type}</span>
                    <span className="text-sm ml-2" style={{ color: 'var(--text-muted)' }}>{a.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── KPI cards du haut ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {stockByType.length}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Types en stock</div>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stockByType.reduce((s, x) => s + x.totalStock, 0).toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Unites en stock</div>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-3xl font-bold" style={{ color: totalValue > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                {totalValue > 0 ? `${totalValue.toLocaleString()} EUR` : '—'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Valeur immobilisee</div>
            </div>
            <div className="rounded-xl border p-4 text-center" style={{ borderColor: alerts.filter(a => a.severity !== 'info').length > 0 ? '#ef4444' : 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="text-3xl font-bold" style={{ color: alerts.length > 0 ? '#ef4444' : '#22c55e' }}>
                {alerts.filter(a => a.severity !== 'info').length}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Alertes</div>
            </div>
          </div>

          {/* ── Jauges par type de contenant ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stockByType.map((s) => {
              const pct = s.threshold > 0 ? Math.min(100, (s.totalStock / s.threshold) * 100) : 0
              const color = gaugeColor(s.totalStock, s.threshold)
              return (
                <div key={s.type.id} className="rounded-xl border p-4 cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
                  onClick={() => navigate('/base-container-stock')}>
                  <div className="flex items-center gap-3 mb-3">
                    {s.type.image_path ? (
                      <img src={`/api/support-types/${s.type.id}/image`} alt={s.type.name}
                        style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>?</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.type.name}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.type.code}</div>
                    </div>
                  </div>

                  {/* Jauge circulaire / Circular gauge */}
                  <div className="flex items-center justify-center mb-2">
                    <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                      <ResponsiveContainer width={80} height={80}>
                        <PieChart>
                          <Pie
                            data={[
                              { value: Math.min(pct, 100) },
                              { value: Math.max(0, 100 - pct) },
                            ]}
                            dataKey="value" cx="50%" cy="50%"
                            innerRadius={28} outerRadius={38}
                            startAngle={90} endAngle={-270}
                            strokeWidth={0}
                          >
                            <Cell fill={color} />
                            <Cell fill="var(--bg-tertiary)" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color, lineHeight: 1 }}>
                          {s.totalStock}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression + seuil */}
                  {s.threshold > 0 && (
                    <div>
                      <div style={{ height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: color, borderRadius: '2px' }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>0</span>
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Seuil: {s.threshold}</span>
                      </div>
                    </div>
                  )}

                  {/* Valeur */}
                  {s.value > 0 && (
                    <div className="text-[10px] text-center mt-1" style={{ color: '#f59e0b' }}>
                      {s.value.toLocaleString()} EUR immobilises
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Graphique mouvements 7 jours ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Mouvements 7 derniers jours
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyMovements}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="in" fill="#22c55e" radius={[4, 4, 0, 0]} name="Entrees" />
                  <Bar dataKey="out" fill="#ef4444" radius={[4, 4, 0, 0]} name="Sorties" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Derniers mouvements */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Derniers mouvements
              </h3>
              <div className="space-y-1.5" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {movements.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: MOVEMENT_COLORS[m.movement_type] || '#737373' }} />
                    <span style={{ color: m.quantity > 0 ? '#22c55e' : '#ef4444', fontWeight: 600, width: '40px' }}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </span>
                    <span className="truncate" style={{ color: 'var(--text-primary)' }}>{m.support_type_name}</span>
                    <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {m.timestamp.slice(11, 16)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Liens rapides ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Stock base', path: '/base-container-stock', color: '#3b82f6' },
              { label: 'Stock PDV', path: '/pdv-stock', color: '#22c55e' },
              { label: 'Suivi consignes', path: '/consignments', color: '#f97316' },
              { label: 'Types contenants', path: '/admin/support-types', color: '#a855f7' },
            ].map((link) => (
              <button key={link.path} onClick={() => navigate(link.path)}
                className="rounded-xl border p-3 text-sm font-medium text-center hover:opacity-80 transition-opacity"
                style={{ borderColor: link.color, color: link.color, backgroundColor: `${link.color}08` }}>
                {link.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
