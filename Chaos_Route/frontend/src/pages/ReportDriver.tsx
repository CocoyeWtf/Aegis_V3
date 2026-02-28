/* Rapport chauffeurs / Driver report page */

import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../services/api'
import { useApi } from '../hooks/useApi'
import type { BaseLogistics } from '../types'

/* ---- Types ---- */

interface DriverRow {
  driver_name: string
  nb_tours: number
  total_km: number
  total_eqp: number
  nb_stops: number
  total_duration_minutes: number
  avg_duration_minutes: number
  punctuality_pct: number
}

interface DriverResponse {
  period: { date_from: string; date_to: string }
  drivers: DriverRow[]
}

/* ---- Helpers ---- */

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}h${String(min).padStart(2, '0')}` : `${min}min`
}

/* ---- Composant principal / Main component ---- */

export default function ReportDriver() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [baseId, setBaseId] = useState('')
  const [data, setData] = useState<DriverResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<keyof DriverRow>('driver_name')
  const [sortAsc, setSortAsc] = useState(true)

  const { data: bases } = useApi<BaseLogistics>('/bases')

  const handleLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
      if (baseId) params.base_id = baseId
      const { data: res } = await api.get<DriverResponse>('/reports/driver', { params })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, baseId])

  const handleExport = () => {
    if (!data) return
    const rows = data.drivers.map((d) => ({
      'Chauffeur': d.driver_name,
      'Tours': d.nb_tours,
      'KM': d.total_km,
      'EQP': d.total_eqp,
      'Stops': d.nb_stops,
      'Duree totale (min)': d.total_duration_minutes,
      'Duree moy (min)': d.avg_duration_minutes,
      'Ponctualite %': d.punctuality_pct,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport chauffeurs')
    XLSX.writeFile(wb, `rapport_chauffeurs_${dateFrom}_${dateTo}.xlsx`)
  }

  const handleSort = (col: keyof DriverRow) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const sortedDrivers = data?.drivers ? [...data.drivers].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol]
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  }) : []

  const SortIcon = ({ col }: { col: keyof DriverRow }) => (
    <span className="ml-1 text-xs opacity-50">{sortCol === col ? (sortAsc ? '▲' : '▼') : ''}</span>
  )

  /* Top 15 chauffeurs pour le graphique / Top 15 drivers for chart */
  const chartData = data?.drivers
    ? [...data.drivers].sort((a, b) => b.nb_tours - a.nb_tours).slice(0, 15)
    : []

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport chauffeurs</h1>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Du</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="rounded px-3 py-2 text-sm border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Au</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="rounded px-3 py-2 text-sm border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Base</label>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)}
            className="rounded px-3 py-2 text-sm border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Toutes</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
          </select>
        </div>
        <button onClick={handleLoad} disabled={loading}
          className="px-4 py-2 rounded text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          {loading ? 'Chargement...' : 'Charger'}
        </button>
        {data && (
          <button onClick={handleExport}
            className="px-4 py-2 rounded text-sm font-medium border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            Exporter Excel
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>}

      {data && (
        <>
          {/* Graphique horizontal / Horizontal bar chart */}
          {chartData.length > 0 && (
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Top chauffeurs (tours / EQP)</div>
              <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 35)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" style={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="driver_name" width={90} style={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Bar dataKey="nb_tours" name="Tours" fill="#f97316" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="total_eqp" name="EQP" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tableau / Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  {([
                    ['driver_name', 'Chauffeur'],
                    ['nb_tours', 'Tours'],
                    ['total_km', 'KM'],
                    ['total_eqp', 'EQP'],
                    ['nb_stops', 'Stops'],
                    ['total_duration_minutes', 'Duree totale'],
                    ['avg_duration_minutes', 'Duree moy.'],
                    ['punctuality_pct', 'Ponctualite %'],
                  ] as [keyof DriverRow, string][]).map(([col, label]) => (
                    <th key={col} className="px-3 py-2 text-left cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort(col)}>
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDrivers.map((d) => (
                  <tr key={d.driver_name} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{d.driver_name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.nb_tours}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.total_km}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.total_eqp}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.nb_stops}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{formatMinutes(d.total_duration_minutes)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{formatMinutes(d.avg_duration_minutes)}</td>
                    <td className="px-3 py-2" style={{ color: d.punctuality_pct >= 90 ? '#10b981' : d.punctuality_pct >= 75 ? '#f59e0b' : '#ef4444' }}>{d.punctuality_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.drivers.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun chauffeur trouve pour cette periode</div>
          )}
        </>
      )}
    </div>
  )
}
