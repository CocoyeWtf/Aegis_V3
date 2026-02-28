/* Rapport vehicules / Vehicle report page */

import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../services/api'
import { useApi } from '../hooks/useApi'
import type { BaseLogistics } from '../types'

/* ---- Types ---- */

interface VehicleRow {
  vehicle_id: number
  vehicle_code: string
  vehicle_name: string
  vehicle_type: string
  capacity_eqp: number
  nb_tours: number
  total_km: number
  total_eqp: number
  avg_fill_rate_pct: number
  total_cost: number
  cost_per_km: number
}

interface VehicleResponse {
  period: { date_from: string; date_to: string }
  vehicles: VehicleRow[]
}

/* ---- Helpers ---- */

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/* ---- Composant principal / Main component ---- */

export default function ReportVehicle() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [baseId, setBaseId] = useState('')
  const [data, setData] = useState<VehicleResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<keyof VehicleRow>('vehicle_code')
  const [sortAsc, setSortAsc] = useState(true)

  const { data: bases } = useApi<BaseLogistics>('/bases')

  const handleLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
      if (baseId) params.base_id = baseId
      const { data: res } = await api.get<VehicleResponse>('/reports/vehicle', { params })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, baseId])

  const handleExport = () => {
    if (!data) return
    const rows = data.vehicles.map((v) => ({
      'Code': v.vehicle_code,
      'Nom': v.vehicle_name,
      'Type': v.vehicle_type,
      'Capacite EQP': v.capacity_eqp,
      'Tours': v.nb_tours,
      'KM': v.total_km,
      'EQP': v.total_eqp,
      'Remplissage %': v.avg_fill_rate_pct,
      'Cout': v.total_cost,
      'Cout/km': v.cost_per_km,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport vehicules')
    XLSX.writeFile(wb, `rapport_vehicules_${dateFrom}_${dateTo}.xlsx`)
  }

  const handleSort = (col: keyof VehicleRow) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const sortedVehicles = data?.vehicles ? [...data.vehicles].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol]
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  }) : []

  const SortIcon = ({ col }: { col: keyof VehicleRow }) => (
    <span className="ml-1 text-xs opacity-50">{sortCol === col ? (sortAsc ? '▲' : '▼') : ''}</span>
  )

  /* Top 15 vehicules pour le graphique / Top 15 vehicles for chart */
  const chartData = data?.vehicles
    ? [...data.vehicles].sort((a, b) => b.avg_fill_rate_pct - a.avg_fill_rate_pct).slice(0, 15)
    : []

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport vehicules</h1>

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
          {/* Graphique taux de remplissage / Fill rate bar chart */}
          {chartData.length > 0 && (
            <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Taux de remplissage par vehicule</div>
              <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 35)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" domain={[0, 100]} unit="%" style={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="vehicle_code" width={70} style={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
                    formatter={(value) => [`${value}%`, 'Remplissage']}
                  />
                  <Bar dataKey="avg_fill_rate_pct" name="Remplissage %" fill="#f97316" radius={[0, 4, 4, 0]} />
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
                    ['vehicle_code', 'Code'],
                    ['vehicle_name', 'Nom'],
                    ['vehicle_type', 'Type'],
                    ['capacity_eqp', 'Capacite'],
                    ['nb_tours', 'Tours'],
                    ['total_km', 'KM'],
                    ['total_eqp', 'EQP'],
                    ['avg_fill_rate_pct', 'Remplissage %'],
                    ['total_cost', 'Cout'],
                    ['cost_per_km', 'Cout/km'],
                  ] as [keyof VehicleRow, string][]).map(([col, label]) => (
                    <th key={col} className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort(col)}>
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedVehicles.map((v) => (
                  <tr key={v.vehicle_id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.vehicle_code}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.vehicle_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{v.vehicle_type}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.capacity_eqp}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.nb_tours}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.total_km}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.total_eqp}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: v.avg_fill_rate_pct >= 80 ? '#10b981' : v.avg_fill_rate_pct >= 60 ? '#f59e0b' : '#ef4444' }}>
                      {v.avg_fill_rate_pct}%
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.total_cost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{v.cost_per_km.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.vehicles.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun vehicule trouve pour cette periode</div>
          )}
        </>
      )}
    </div>
  )
}
