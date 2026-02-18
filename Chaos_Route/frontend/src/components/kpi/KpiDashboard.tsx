/* Dashboard KPI avec 3 périodes + graphiques / KPI Dashboard with 3 periods + charts */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { KpiCard } from './KpiCard'
import type { Tour } from '../../types'

interface KpiDashboardProps {
  tours: Tour[]
  today: string
  weekStart: string
}

interface KpiSet {
  totalTours: number
  totalEqp: number
  totalKm: number
  totalCost: number
  estimatedCO2: number
}

function computeKpis(tours: Tour[]): KpiSet {
  if (tours.length === 0) {
    return { totalTours: 0, totalEqp: 0, totalKm: 0, totalCost: 0, estimatedCO2: 0 }
  }
  const totalEqp = tours.reduce((s, t) => s + (t.total_eqp ?? 0), 0)
  const totalKm = tours.reduce((s, t) => s + (t.total_km ?? 0), 0)
  const totalCost = tours.reduce((s, t) => s + (t.total_cost ?? 0), 0)
  return {
    totalTours: tours.length,
    totalEqp,
    totalKm: Math.round(totalKm),
    totalCost: Math.round(totalCost * 100) / 100,
    estimatedCO2: Math.round(totalKm * 0.9),
  }
}

export function KpiDashboard({ tours, today, weekStart }: KpiDashboardProps) {
  const { t } = useTranslation()

  /* Filtrage client-side pour les 3 périodes / Client-side filtering for 3 periods */
  const weekTours = useMemo(() => tours.filter(tour => tour.date >= weekStart), [tours, weekStart])
  const todayTours = useMemo(() => tours.filter(tour => tour.date === today), [tours, today])

  const monthKpis = useMemo(() => computeKpis(tours), [tours])
  const weekKpis = useMemo(() => computeKpis(weekTours), [weekTours])
  const todayKpis = useMemo(() => computeKpis(todayTours), [todayTours])

  /* Moyennes sur le mois / Monthly averages */
  const avgKpis = useMemo(() => {
    if (tours.length === 0) return { avgKmPerTour: 0, avgEqpPerTour: 0, avgCostPerTour: 0, avgKmPerEqp: 0 }
    return {
      avgKmPerTour: Math.round(monthKpis.totalKm / tours.length),
      avgEqpPerTour: Math.round(monthKpis.totalEqp / tours.length),
      avgCostPerTour: Math.round((monthKpis.totalCost / tours.length) * 100) / 100,
      avgKmPerEqp: monthKpis.totalEqp > 0 ? Math.round((monthKpis.totalKm / monthKpis.totalEqp) * 10) / 10 : 0,
    }
  }, [tours, monthKpis])

  /* Données pour le graphique par statut / Data for status chart */
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    tours.forEach((tour) => {
      counts[tour.status] = (counts[tour.status] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [tours])

  /* Données pour le graphique EQP par jour / EQP per day chart */
  const dailyData = useMemo(() => {
    const byDate: Record<string, { eqp: number; km: number; tours: number }> = {}
    tours.forEach((tour) => {
      if (!byDate[tour.date]) byDate[tour.date] = { eqp: 0, km: 0, tours: 0 }
      byDate[tour.date].eqp += tour.total_eqp ?? 0
      byDate[tour.date].km += tour.total_km ?? 0
      byDate[tour.date].tours += 1
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date: date.slice(5), ...vals }))
  }, [tours])

  const PIE_COLORS = ['var(--text-muted)', 'var(--color-primary)', 'var(--color-warning)', 'var(--color-success)']

  /* Rendu d'une colonne de KPIs pour une période / Render a KPI column for one period */
  const renderPeriodColumn = (label: string, kpis: KpiSet) => (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--text-primary)' }}>
        {label}
      </h3>
      <div className="space-y-3">
        <KpiCard label={t('kpi.totalTours')} value={kpis.totalTours} color="var(--color-primary)" />
        <KpiCard label={t('kpi.totalEqp')} value={kpis.totalEqp} color="var(--color-success)" />
        <KpiCard label={t('kpi.totalKm')} value={kpis.totalKm} unit="km" color="var(--color-warning)" />
        <KpiCard label={t('kpi.totalCost')} value={`${kpis.totalCost}`} unit="€" color="var(--color-danger)" />
        <KpiCard label={t('kpi.co2')} value={kpis.estimatedCO2} unit="kg" color="var(--text-muted)" />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 3 colonnes de KPIs par période / 3 KPI columns by period */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderPeriodColumn(t('kpi.thisMonth'), monthKpis)}
        {renderPeriodColumn(t('kpi.thisWeek'), weekKpis)}
        {renderPeriodColumn(t('kpi.today'), todayKpis)}
      </div>

      {/* Cartes KPI moyennes (mois) / Average KPI cards (month) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={t('kpi.avgKmPerTour')} value={avgKpis.avgKmPerTour} unit="km" color="var(--color-primary)" />
        <KpiCard label={t('kpi.avgEqpPerTour')} value={avgKpis.avgEqpPerTour} color="var(--color-success)" />
        <KpiCard label={t('kpi.avgCostPerTour')} value={`${avgKpis.avgCostPerTour}`} unit="€" color="var(--color-warning)" />
        <KpiCard label={t('kpi.avgKmPerEqp')} value={avgKpis.avgKmPerEqp} unit="km" color="var(--color-danger)" />
      </div>

      {/* Graphiques / Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* EQP par jour / EQP per day */}
        <div
          className="lg:col-span-2 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t('kpi.eqpPerDay')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                }}
              />
              <Bar dataKey="eqp" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="EQP" />
              <Bar dataKey="tours" fill="var(--color-success)" radius={[4, 4, 0, 0]} name="Tours" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Répartition par statut / Status distribution */}
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {t('kpi.statusDistribution')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                dataKey="value"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {statusData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
