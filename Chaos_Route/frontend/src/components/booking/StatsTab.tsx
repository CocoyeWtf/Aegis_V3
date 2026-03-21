/* Onglet statistiques / Stats tab */

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import api from '../../services/api'

interface Props {
  selectedBaseId: number | ''
}

export function StatsTab({ selectedBaseId }: Props) {
  const [kpi, setKpi] = useState<Record<string, unknown> | null>(null)
  const [kpiFrom, setKpiFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) })
  const [kpiTo, setKpiTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  const fetchKpi = useCallback(async () => {
    if (!selectedBaseId) return
    setLoading(true)
    try {
      const res = await api.get('/reception-booking/kpi/', {
        params: { base_id: selectedBaseId, date_from: kpiFrom, date_to: kpiTo },
      })
      setKpi(res.data)
    } catch { setKpi(null) } finally { setLoading(false) }
  }, [selectedBaseId, kpiFrom, kpiTo])

  useEffect(() => { fetchKpi() }, [fetchKpi])

  if (!selectedBaseId) {
    return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Selectionnez une base pour voir les statistiques.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Periode :</label>
        <input type="date" value={kpiFrom} onChange={(e) => setKpiFrom(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>→</span>
        <input type="date" value={kpiTo} onChange={(e) => setKpiTo(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        <button onClick={fetchKpi} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}>Actualiser</button>
      </div>

      {loading && <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Calcul en cours...</div>}

      {!loading && kpi && (() => {
        const k = kpi as Record<string, unknown>
        const utilPct = Number(k.utilization_pct || 0)
        const utilColor = utilPct >= 80 ? '#22c55e' : utilPct >= 50 ? '#f59e0b' : '#ef4444'
        const dailyStats = (k.daily_stats as Array<Record<string, unknown>>) || []
        const lateSuppliers = (k.late_suppliers as Array<Record<string, unknown>>) || []
        const lateCarriers = (k.late_carriers as Array<Record<string, unknown>>) || []

        return (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border p-4 text-center" style={{ borderColor: utilColor, backgroundColor: `${utilColor}10` }}>
                <div className="text-3xl font-bold" style={{ color: utilColor }}>{utilPct}%</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Taux exploitation</div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{String(k.actual_pallets)} / {String(k.theoretical_max_pallets)} pal.</div>
              </div>
              <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{String(k.actual_trucks)}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Camions recus</div>
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>max : {String(k.theoretical_max_trucks)}</div>
              </div>
              <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>{k.avg_wait_minutes != null ? `${k.avg_wait_minutes} min` : '—'}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Attente moyenne</div>
              </div>
              <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="text-3xl font-bold" style={{ color: '#a855f7' }}>{k.avg_dock_minutes != null ? `${k.avg_dock_minutes} min` : '—'}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Duree quai moyenne</div>
              </div>
            </div>

            {/* Compteurs statuts */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Total', value: k.total_bookings, color: 'var(--text-primary)' },
                { label: 'Termines', value: k.completed, color: '#22c55e' },
                { label: 'Refuses', value: k.refused, color: '#ef4444' },
                { label: 'No-show', value: k.no_show, color: '#ef4444' },
                { label: 'Annules', value: k.cancelled, color: '#6b7280' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg p-2 text-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-lg font-bold" style={{ color: s.color }}>{String(s.value)}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Retards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Fournisseurs en retard</h3>
                {lateSuppliers.length === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucun retard</div>
                ) : (
                  <div className="space-y-1.5">
                    {lateSuppliers.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--text-primary)' }}>{String(s.name)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>+{String(s.avg_delay_min)} min</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({String(s.count)}x)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Transporteurs en retard</h3>
                {lateCarriers.length === 0 ? (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucun retard</div>
                ) : (
                  <div className="space-y-1.5">
                    {lateCarriers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{String(c.plate)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>+{String(c.avg_delay_min)} min</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>({String(c.count)}x)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Taux exploitation par jour</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyStats.map((d) => ({ day: String(d.date).slice(5), pct: Number(d.utilization_pct || 0) }))}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                      {dailyStats.map((d, i) => {
                        const pct = Number(d.utilization_pct || 0)
                        return <Cell key={i} fill={pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#3b82f6'} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Palettes par jour</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyStats.map((d) => ({ day: String(d.date).slice(5), pallets: Number(d.pallets || 0), trucks: Number(d.trucks || 0) }))}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="pallets" fill="#f97316" radius={[4, 4, 0, 0]} name="Palettes" />
                    <Bar dataKey="trucks" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Camions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie */}
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Repartition par statut</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Termines', value: Number(k.completed || 0), fill: '#22c55e' },
                        { name: 'Refuses', value: Number(k.refused || 0), fill: '#ef4444' },
                        { name: 'No-show', value: Number(k.no_show || 0), fill: '#f59e0b' },
                        { name: 'Annules', value: Number(k.cancelled || 0), fill: '#6b7280' },
                      ].filter((d) => d.value > 0)}
                      dataKey="value" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
