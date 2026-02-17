/* Dashboard KPI avec graphiques / KPI Dashboard with charts */

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
}

export function KpiDashboard({ tours }: KpiDashboardProps) {
  const { t } = useTranslation()

  const kpis = useMemo(() => {
    if (tours.length === 0) {
      return {
        totalTours: 0,
        totalEqp: 0,
        totalKm: 0,
        totalCost: 0,
        avgKmPerTour: 0,
        avgEqpPerTour: 0,
        avgCostPerTour: 0,
        avgKmPerEqp: 0,
        avgFillRate: 0,
        estimatedCO2: 0,
      }
    }

    const totalEqp = tours.reduce((s, t) => s + (t.total_eqp ?? 0), 0)
    const totalKm = tours.reduce((s, t) => s + (t.total_km ?? 0), 0)
    const totalCost = tours.reduce((s, t) => s + (t.total_cost ?? 0), 0)

    return {
      totalTours: tours.length,
      totalEqp,
      totalKm: Math.round(totalKm),
      totalCost: Math.round(totalCost * 100) / 100,
      avgKmPerTour: Math.round(totalKm / tours.length),
      avgEqpPerTour: Math.round(totalEqp / tours.length),
      avgCostPerTour: Math.round((totalCost / tours.length) * 100) / 100,
      avgKmPerEqp: totalEqp > 0 ? Math.round((totalKm / totalEqp) * 10) / 10 : 0,
      avgFillRate: 0, // Needs vehicle capacity data
      estimatedCO2: Math.round(totalKm * 0.9), // ~0.9 kg CO2/km for truck
    }
  }, [tours])

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
      .slice(-14) // Last 14 days
      .map(([date, vals]) => ({ date: date.slice(5), ...vals }))
  }, [tours])

  const PIE_COLORS = ['var(--text-muted)', 'var(--color-primary)', 'var(--color-warning)', 'var(--color-success)']

  return (
    <div className="space-y-6">
      {/* Cartes KPI / KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label={t('kpi.totalTours')} value={kpis.totalTours} color="var(--color-primary)" />
        <KpiCard label={t('kpi.totalEqp')} value={kpis.totalEqp} color="var(--color-success)" />
        <KpiCard label={t('kpi.totalKm')} value={kpis.totalKm} unit="km" color="var(--color-warning)" />
        <KpiCard label={t('kpi.totalCost')} value={`${kpis.totalCost}`} unit="€" color="var(--color-danger)" />
        <KpiCard label={t('kpi.co2')} value={kpis.estimatedCO2} unit="kg" color="var(--text-muted)" />
      </div>

      {/* Cartes KPI moyennes / Average KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={t('kpi.avgKmPerTour')} value={kpis.avgKmPerTour} unit="km" color="var(--color-primary)" />
        <KpiCard label={t('kpi.avgEqpPerTour')} value={kpis.avgEqpPerTour} color="var(--color-success)" />
        <KpiCard label={t('kpi.avgCostPerTour')} value={`${kpis.avgCostPerTour}`} unit="€" color="var(--color-warning)" />
        <KpiCard label={t('kpi.avgKmPerEqp')} value={kpis.avgKmPerEqp} unit="km" color="var(--color-danger)" />
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
