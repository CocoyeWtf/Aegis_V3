/* Rapport quotidien / Daily report page */

import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../services/api'
import { useApi } from '../hooks/useApi'
import type { BaseLogistics } from '../types'

/* ---- Types ---- */

interface DailyRow {
  date: string
  nb_tours: number
  nb_pdv: number
  total_eqp: number
  total_km: number
  total_cost: number
  total_weight_kg: number
  avg_fill_rate_pct: number
  punctuality_pct: number
}

interface DailyTotals {
  nb_tours: number
  nb_pdv: number
  total_eqp: number
  total_km: number
  total_cost: number
  total_weight_kg: number
  avg_fill_rate_pct: number
  punctuality_pct: number
}

interface DailyResponse {
  period: { date_from: string; date_to: string }
  days: DailyRow[]
  totals: DailyTotals
}

/* ---- Helpers ---- */

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function SummaryCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}{unit && <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  )
}

/* ---- Composant principal / Main component ---- */

export default function ReportDaily() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [baseId, setBaseId] = useState('')
  const [data, setData] = useState<DailyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<keyof DailyRow>('date')
  const [sortAsc, setSortAsc] = useState(true)

  const { data: bases } = useApi<BaseLogistics>('/bases')

  const handleLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
      if (baseId) params.base_id = baseId
      const { data: res } = await api.get<DailyResponse>('/reports/daily', { params })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, baseId])

  const handleExport = () => {
    if (!data) return
    const rows = data.days.map((d) => ({
      'Date': d.date,
      'Tours': d.nb_tours,
      'PDV': d.nb_pdv,
      'EQP': d.total_eqp,
      'KM': d.total_km,
      'Poids (kg)': d.total_weight_kg,
      'Cout': d.total_cost,
      'Remplissage %': d.avg_fill_rate_pct,
      'Ponctualite %': d.punctuality_pct,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport quotidien')
    XLSX.writeFile(wb, `rapport_quotidien_${dateFrom}_${dateTo}.xlsx`)
  }

  const handleSort = (col: keyof DailyRow) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const sortedDays = data?.days ? [...data.days].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol]
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  }) : []

  const SortIcon = ({ col }: { col: keyof DailyRow }) => (
    <span className="ml-1 text-xs opacity-50">{sortCol === col ? (sortAsc ? '▲' : '▼') : ''}</span>
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport quotidien</h1>

      {/* Barre de filtres / Filter bar */}
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
          {/* Cartes résumé / Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard label="Tours" value={data.totals.nb_tours} />
            <SummaryCard label="EQP total" value={data.totals.total_eqp} />
            <SummaryCard label="KM total" value={data.totals.total_km.toLocaleString('fr-FR')} unit="km" />
            <SummaryCard label="Cout total" value={data.totals.total_cost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} unit="EUR" />
            <SummaryCard label="Remplissage moy." value={`${data.totals.avg_fill_rate_pct}%`} />
            <SummaryCard label="Ponctualite" value={`${data.totals.punctuality_pct}%`} />
          </div>

          {/* Sparklines / Trend charts */}
          {data.days.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'total_eqp', label: 'EQP / jour', color: '#f97316' },
                { key: 'total_km', label: 'KM / jour', color: '#3b82f6' },
                { key: 'total_cost', label: 'Cout / jour', color: '#10b981' },
              ].map(({ key, label, color }) => (
                <div key={key} className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{label}</div>
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={data.days}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '12px' }}
                        labelStyle={{ color: 'var(--text-muted)' }}
                      />
                      <Area type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          {/* Tableau / Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  {([
                    ['date', 'Date'],
                    ['nb_tours', 'Tours'],
                    ['nb_pdv', 'PDV'],
                    ['total_eqp', 'EQP'],
                    ['total_km', 'KM'],
                    ['total_weight_kg', 'Poids (kg)'],
                    ['total_cost', 'Cout'],
                    ['avg_fill_rate_pct', 'Remplissage %'],
                    ['punctuality_pct', 'Ponctualite %'],
                  ] as [keyof DailyRow, string][]).map(([col, label]) => (
                    <th key={col} className="px-3 py-2 text-left cursor-pointer select-none" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort(col)}>
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDays.map((d) => (
                  <tr key={d.date} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.date}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.nb_tours}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.nb_pdv}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.total_eqp}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.total_km}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.total_weight_kg}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.total_cost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.avg_fill_rate_pct}%</td>
                    <td className="px-3 py-2" style={{ color: d.punctuality_pct >= 90 ? '#10b981' : d.punctuality_pct >= 75 ? '#f59e0b' : '#ef4444' }}>{d.punctuality_pct}%</td>
                  </tr>
                ))}
                {/* Ligne totaux / Totals row */}
                {data.totals && (
                  <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--color-primary)' }}>TOTAL</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.nb_tours}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.nb_pdv}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.total_eqp}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.total_km}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.total_weight_kg}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.total_cost.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.avg_fill_rate_pct}%</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{data.totals.punctuality_pct}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
