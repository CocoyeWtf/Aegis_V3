/* Rapport PDV / PDV report page */

import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import api from '../services/api'
import { useApi } from '../hooks/useApi'
import type { BaseLogistics } from '../types'

/* ---- Types ---- */

interface PdvRow {
  pdv_id: number
  pdv_code: string
  pdv_name: string
  pdv_city: string
  pdv_type: string
  nb_deliveries: number
  total_eqp: number
  avg_eqp: number
  punctuality_pct: number
  nb_incidents: number
  nb_forced_closures: number
  nb_missing_supports: number
}

interface PdvResponse {
  period: { date_from: string; date_to: string }
  pdvs: PdvRow[]
}

/* ---- Helpers ---- */

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const PDV_TYPES = [
  'EXPRESS', 'CONTACT', 'SUPER_ALIMENTAIRE', 'SUPER_NON_ALIMENTAIRE',
  'HYPER', 'DRIVE', 'ENTREPOT', 'PLATEFORME', 'AUTRE',
]

/* ---- Composant principal / Main component ---- */

export default function ReportPdv() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(todayStr())
  const [baseId, setBaseId] = useState('')
  const [pdvType, setPdvType] = useState('')
  const [data, setData] = useState<PdvResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<keyof PdvRow>('pdv_code')
  const [sortAsc, setSortAsc] = useState(true)

  const { data: bases } = useApi<BaseLogistics>('/bases')

  const handleLoad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
      if (baseId) params.base_id = baseId
      if (pdvType) params.pdv_type = pdvType
      const { data: res } = await api.get<PdvResponse>('/reports/pdv', { params })
      setData(res)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, baseId, pdvType])

  const handleExport = () => {
    if (!data) return
    const rows = data.pdvs.map((p) => ({
      'Code': p.pdv_code,
      'Nom': p.pdv_name,
      'Ville': p.pdv_city,
      'Type': p.pdv_type,
      'Livraisons': p.nb_deliveries,
      'EQP total': p.total_eqp,
      'EQP moy': p.avg_eqp,
      'Ponctualite %': p.punctuality_pct,
      'Incidents': p.nb_incidents,
      'Clotures forcees': p.nb_forced_closures,
      'Supports manquants': p.nb_missing_supports,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport PDV')
    XLSX.writeFile(wb, `rapport_pdv_${dateFrom}_${dateTo}.xlsx`)
  }

  const handleSort = (col: keyof PdvRow) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const sortedPdvs = data?.pdvs ? [...data.pdvs].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol]
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  }) : []

  const SortIcon = ({ col }: { col: keyof PdvRow }) => (
    <span className="ml-1 text-xs opacity-50">{sortCol === col ? (sortAsc ? '▲' : '▼') : ''}</span>
  )

  const punctualityColor = (pct: number) =>
    pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport PDV</h1>

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
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Type PDV</label>
          <select value={pdvType} onChange={(e) => setPdvType(e.target.value)}
            className="rounded px-3 py-2 text-sm border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Tous</option>
            {PDV_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {data.pdvs.length} PDV trouves
          </div>

          {/* Tableau / Table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  {([
                    ['pdv_code', 'Code'],
                    ['pdv_name', 'Nom'],
                    ['pdv_city', 'Ville'],
                    ['pdv_type', 'Type'],
                    ['nb_deliveries', 'Livraisons'],
                    ['total_eqp', 'EQP total'],
                    ['avg_eqp', 'EQP moy.'],
                    ['punctuality_pct', 'Ponctualite %'],
                    ['nb_incidents', 'Incidents'],
                    ['nb_forced_closures', 'Clotures forcees'],
                    ['nb_missing_supports', 'Supports manquants'],
                  ] as [keyof PdvRow, string][]).map(([col, label]) => (
                    <th key={col} className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap" style={{ color: 'var(--text-muted)' }} onClick={() => handleSort(col)}>
                      {label}<SortIcon col={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPdvs.map((p) => (
                  <tr key={p.pdv_id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{p.pdv_code}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{p.pdv_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.pdv_city}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{p.pdv_type}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{p.nb_deliveries}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{p.total_eqp}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{p.avg_eqp}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: punctualityColor(p.punctuality_pct) }}>{p.punctuality_pct}%</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.nb_incidents > 0 ? '#ef4444' : 'var(--text-primary)' }}>{p.nb_incidents}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.nb_forced_closures > 0 ? '#f59e0b' : 'var(--text-primary)' }}>{p.nb_forced_closures}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: p.nb_missing_supports > 0 ? '#f59e0b' : 'var(--text-primary)' }}>{p.nb_missing_supports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pdvs.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun PDV trouve pour cette periode</div>
          )}
        </>
      )}
    </div>
  )
}
