/* KPI Surcharges — graphique mensuel ventilé par type / Monthly surcharges KPI chart by type */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../../services/api'

interface SurchargesKpiProps {
  dateFrom: string
  dateTo: string
  regionId?: number | null
}

interface ByMonth {
  month: string
  count: number
  total_amount: number
}

interface ByType {
  surcharge_type_id: number
  label: string
  count: number
  total_amount: number
}

interface ByMonthAndType {
  month: string
  surcharge_type_id: number
  label: string
  count: number
  total_amount: number
}

interface SurchargesKpiResponse {
  by_month: ByMonth[]
  by_type: ByType[]
  by_month_and_type: ByMonthAndType[]
}

const COLORS = [
  '#f97316', '#ef4444', '#8b5cf6', '#3b82f6', '#22c55e',
  '#eab308', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1',
]

const tooltipStyle = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
}

export function SurchargesKpi({ dateFrom, dateTo, regionId }: SurchargesKpiProps) {
  const [data, setData] = useState<SurchargesKpiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { date_from: dateFrom, date_to: dateTo }
      if (regionId) params.region_id = regionId
      const resp = await api.get<SurchargesKpiResponse>('/kpi/surcharges', { params })
      setData(resp.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, regionId])

  useEffect(() => { load() }, [load])

  /* Préparer les données pour le BarChart empilé / Prepare stacked bar chart data */
  const { chartData, typeKeys, typeColors } = useMemo(() => {
    if (!data || !data.by_month_and_type.length) {
      return { chartData: [], typeKeys: [], typeColors: {} as Record<string, string> }
    }

    // Extraire les types uniques / Extract unique types
    const types = data.by_type.map((t) => t.label)
    const colors: Record<string, string> = {}
    types.forEach((label, i) => {
      colors[label] = COLORS[i % COLORS.length]
    })

    // Construire les données par mois / Build per-month data
    const months = [...new Set(data.by_month_and_type.map((d) => d.month))].sort()
    const rows = months.map((month) => {
      const row: Record<string, unknown> = {
        month: month.slice(5) + '/' + month.slice(0, 4),
      }
      for (const t of types) {
        row[t] = 0
      }
      for (const entry of data.by_month_and_type) {
        if (entry.month === month) {
          row[entry.label] = entry.total_amount
        }
      }
      return row
    })

    return { chartData: rows, typeKeys: types, typeColors: colors }
  }, [data])

  /* Totaux / Totals */
  const totalCount = data?.by_month.reduce((s, m) => s + m.count, 0) || 0
  const totalAmount = data?.by_month.reduce((s, m) => s + m.total_amount, 0) || 0

  if (loading) {
    return (
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chargement surcharges...</p>
      </div>
    )
  }

  if (!data || totalCount === 0) {
    return (
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Surcharges</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Aucune surcharge validée sur la période.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Surcharges
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Résumé / Summary */}
        <div
          className="rounded-xl border p-4 text-center"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Nombre</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
            {totalCount}
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>surcharges validées</div>
        </div>

        <div
          className="rounded-xl border p-4 text-center"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Montant total</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: 'var(--color-danger)' }}>
            {totalAmount.toFixed(0)}
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>EUR</div>
        </div>

        {/* Graphique empilé par mois / Stacked monthly chart */}
        <div
          className="lg:col-span-3 rounded-xl border p-3"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Montant par mois (ventilé par type)</div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${Number(value).toFixed(2)} €`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {typeKeys.map((key) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={typeColors[key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--text-muted)' }}>Pas de données</p>
          )}
        </div>
      </div>

      {/* Détail par type / Detail by type */}
      {data.by_type.length > 0 && (
        <div
          className="rounded-xl border px-4 py-2 flex flex-wrap gap-6 text-xs"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Par type :</span>
          {data.by_type.map((t) => (
            <span key={t.surcharge_type_id} style={{ color: 'var(--text-primary)' }}>
              <span
                className="inline-block w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: typeColors[t.label] || 'var(--text-muted)' }}
              />
              <span className="font-medium">{t.label}</span>
              {' '}
              <span style={{ color: 'var(--color-danger)' }}>{t.total_amount.toFixed(2)} €</span>
              {' '}
              <span style={{ color: 'var(--text-muted)' }}>({t.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
