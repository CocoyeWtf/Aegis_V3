/* KPI Taux de ponctualité — CDC et opérationnel / Punctuality rate KPI — CDC and operational */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../../services/api'
import type { PunctualityKpiResponse } from '../../types'

interface PunctualityKpiProps {
  dateFrom: string
  dateTo: string
  regionId?: number | null
}

type SortKey = 'pdv_code' | 'pdv_name' | 'total' | 'cdc_pct' | 'operational_pct'
type SortDir = 'asc' | 'desc'

const tooltipStyle = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
}

export function PunctualityKpi({ dateFrom, dateTo, regionId }: PunctualityKpiProps) {
  const [data, setData] = useState<PunctualityKpiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activityFilter, setActivityFilter] = useState<string>('')
  const [sortKey, setSortKey] = useState<SortKey>('cdc_pct')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { date_from: dateFrom, date_to: dateTo }
      if (regionId) params.region_id = regionId
      if (activityFilter) params.activity_type = activityFilter
      const resp = await api.get<PunctualityKpiResponse>('/kpi/punctuality', { params })
      setData(resp.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, regionId, activityFilter])

  useEffect(() => { load() }, [load])

  /* Auto-refresh toutes les 60s / Auto-refresh every 60s */
  useEffect(() => {
    const interval = setInterval(() => { load() }, 60_000)
    return () => clearInterval(interval)
  }, [load])

  const chartData = useMemo(() => {
    if (!data?.by_date) return []
    return data.by_date.map(d => ({
      date: d.date.slice(8) + '/' + d.date.slice(5, 7),
      cdc_pct: d.cdc_pct,
      operational_pct: d.operational_pct,
    }))
  }, [data])

  const sortedPdvs = useMemo(() => {
    if (!data?.by_pdv) return []
    return [...data.by_pdv].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      const diff = (aVal as number) - (bVal as number)
      return sortDir === 'asc' ? diff : -diff
    })
  }, [data, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  if (loading) {
    return (
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement ponctualité...</p>
      </div>
    )
  }

  if (!data || !data.summary || data.summary.with_deadline === 0) {
    return (
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Taux de ponctualité</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Aucune donnée de ponctualité disponible. Importez des volumes avec une activité (Suivi ou MEAV) pour activer ce KPI.
        </p>
      </div>
    )
  }

  const { summary, by_activity } = data

  return (
    <div className="space-y-3">
      {/* Header + filtre activité / Header + activity filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Taux de ponctualité
          </h3>
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded transition-colors hover:opacity-80 disabled:opacity-40"
            style={{ color: 'var(--text-muted)' }}
            title="Rafraîchir"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
        <select
          value={activityFilter}
          onChange={e => setActivityFilter(e.target.value)}
          className="px-2 py-1 rounded-lg border text-xs"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        >
          <option value="">Toutes activités</option>
          <option value="SUIVI">Suivi</option>
          <option value="MEAV">Mise en avant</option>
        </select>
      </div>

      {/* Row 1 : Gauges + courbe / Gauges + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Gauge CDC / CDC gauge */}
        <div
          className="rounded-xl border p-4 text-center"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>CDC</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: summary.cdc.pct >= 90 ? 'var(--color-success)' : summary.cdc.pct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
            {summary.cdc.pct}%
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {summary.cdc.on_time}/{summary.cdc.on_time + summary.cdc.late} à temps
          </div>
          {summary.cdc.no_scan > 0 && (
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              ({summary.cdc.no_scan} sans scan)
            </div>
          )}
        </div>

        {/* Gauge Opérationnel / Operational gauge */}
        <div
          className="rounded-xl border p-4 text-center"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Opérationnel</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: summary.operational.pct >= 90 ? 'var(--color-success)' : summary.operational.pct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
            {summary.operational.pct}%
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {summary.operational.on_time}/{summary.operational.on_time + summary.operational.late} à temps
          </div>
          {summary.operational.no_scan > 0 && (
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              ({summary.operational.no_scan} sans scan)
            </div>
          )}
        </div>

        {/* Courbe par jour / Daily chart */}
        <div
          className="lg:col-span-3 rounded-xl border p-3"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Évolution par jour</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="cdc_pct" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 2 }} name="CDC" />
                <Line type="monotone" dataKey="operational_pct" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 2 }} name="Opérationnel" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--text-muted)' }}>Pas de données par jour</p>
          )}
        </div>
      </div>

      {/* Row 2 : Par activité / By activity */}
      {Object.keys(by_activity).length > 0 && (
        <div
          className="rounded-xl border px-4 py-2 flex flex-wrap gap-6 text-xs"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Par activité :</span>
          {Object.entries(by_activity).map(([act, metrics]) => (
            <span key={act} style={{ color: 'var(--text-primary)' }}>
              <span className="font-medium">{act}</span>
              {' '}
              <span style={{ color: 'var(--color-primary)' }}>{metrics.cdc.pct}%</span>
              {' / '}
              <span style={{ color: 'var(--color-success)' }}>{metrics.operational.pct}%</span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>({metrics.total} stops)</span>
            </span>
          ))}
        </div>
      )}

      {/* Row 3 : Tableau PDV triable / Sortable PDV table */}
      {sortedPdvs.length > 0 && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              Détail par PDV
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {([
                    ['pdv_code', 'Code'],
                    ['pdv_name', 'Nom'],
                    ['total', 'Stops'],
                    ['cdc_pct', 'CDC %'],
                    ['operational_pct', 'Opérationnel %'],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th
                      key={key}
                      className="px-3 py-2 font-semibold cursor-pointer select-none text-left"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => handleSort(key)}
                    >
                      {label}{sortIcon(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPdvs.map((pdv) => (
                  <tr key={pdv.pdv_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-primary)' }}>{pdv.pdv_code}</td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{pdv.pdv_name}</td>
                    <td className="px-3 py-1.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>{pdv.total}</td>
                    <td className="px-3 py-1.5 font-bold tabular-nums" style={{ color: pdv.cdc_pct >= 90 ? 'var(--color-success)' : pdv.cdc_pct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                      {pdv.cdc_pct}%
                    </td>
                    <td className="px-3 py-1.5 font-bold tabular-nums" style={{ color: pdv.operational_pct >= 90 ? 'var(--color-success)' : pdv.operational_pct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                      {pdv.operational_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
