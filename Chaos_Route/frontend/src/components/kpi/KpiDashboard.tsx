/* Dashboard KPI compact — table + sparklines + graphiques clicables / Compact KPI Dashboard */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line,
} from 'recharts'
import type { Tour, Volume, PdvPickupSummary } from '../../types'
import { EQC_PER_EQP } from '../../utils/tourTimeUtils'

interface KpiDashboardProps {
  tours: Tour[]
  volumes: Volume[]
  pickupSummaries: PdvPickupSummary[]
  today: string
  weekStart: string
  monthStart: string
}

interface KpiSet {
  totalTours: number
  totalEqp: number
  totalEqpDerived: number
  totalColis: number
  totalKm: number
  totalCost: number
  estimatedCO2: number
}

type ExpandedChart = null | 'sparkKm' | 'sparkEqc' | 'sparkColis' | 'sparkColisEqc' | 'barChart' | 'pieChart'

function computeKpis(tours: Tour[], volumes: Volume[]): KpiSet {
  if (tours.length === 0) {
    return { totalTours: 0, totalEqp: 0, totalEqpDerived: 0, totalColis: 0, totalKm: 0, totalCost: 0, estimatedCO2: 0 }
  }
  const totalEqp = tours.reduce((s, t) => s + (t.total_eqp ?? 0), 0)
  const totalKm = tours.reduce((s, t) => s + (t.total_km ?? 0), 0)
  const totalCost = tours.reduce((s, t) => s + (t.total_cost ?? 0), 0)
  const tourIds = new Set(tours.map(t => t.id))
  const totalColis = volumes
    .filter(v => v.tour_id && tourIds.has(v.tour_id))
    .reduce((s, v) => s + (v.nb_colis ?? 0), 0)
  return {
    totalTours: tours.length,
    totalEqp,
    totalEqpDerived: Math.round((totalEqp / EQC_PER_EQP) * 10) / 10,
    totalColis,
    totalKm: Math.round(totalKm),
    totalCost: Math.round(totalCost * 100) / 100,
    estimatedCO2: Math.round(totalKm * 0.9),
  }
}

/* Moyennes par tour pour un KpiSet / Per-tour averages for a KpiSet */
function computeAvgs(kpis: KpiSet, tourCount: number) {
  if (tourCount === 0) return { avgKm: 0, avgEqc: 0, avgColis: 0, avgColisEqc: 0 }
  return {
    avgKm: Math.round(kpis.totalKm / tourCount),
    avgEqc: Math.round((kpis.totalEqp / tourCount) * 10) / 10,
    avgColis: kpis.totalColis > 0 ? Math.round(kpis.totalColis / tourCount) : 0,
    avgColisEqc: kpis.totalEqp > 0 ? Math.round((kpis.totalColis / kpis.totalEqp) * 10) / 10 : 0,
  }
}

const PICKUP_TYPE_LABELS: Record<string, string> = {
  CONTAINER: 'Contenants',
  CARDBOARD: 'Cartons',
  MERCHANDISE: 'Marchandise',
  CONSIGNMENT: 'Consignes',
}

const PIE_COLORS = ['var(--text-muted)', 'var(--color-primary)', 'var(--color-warning)', 'var(--color-success)']

const tooltipStyle = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
}

/* ─── Mini sparkline card ─── */
interface SparklineCardProps {
  label: string
  value: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
  dataKey: string
  color: string
  onClick: () => void
}

function SparklineCard({ label, value, data, dataKey, color, onClick }: SparklineCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border p-2 text-left transition-colors hover:brightness-110 cursor-pointer"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="h-9 mt-0.5">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#grad-${dataKey})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </button>
  )
}

/* ─── Modale d'agrandissement / Chart expand modal ─── */
interface ChartModalProps {
  chartType: ExpandedChart
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyData: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statusData: any[]
  sparklineConfigs: { key: string; label: string; dataKey: string; color: string }[]
}

function ChartModal({ chartType, onClose, dailyData, statusData, sparklineConfigs }: ChartModalProps) {
  if (!chartType) return null

  const isSparkline = chartType.startsWith('spark')
  const config = isSparkline ? sparklineConfigs.find(c => c.key === chartType) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-xl border p-6 w-[90vw] max-w-4xl"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-sm cursor-pointer"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}
        >
          ✕
        </button>

        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          {isSparkline ? config?.label : chartType === 'barChart' ? 'EQC & Tours par jour' : 'Répartition par statut'}
        </h3>

        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            {isSparkline && config ? (
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey={config.dataKey} stroke={config.color} strokeWidth={2} dot={{ r: 3, fill: config.color }} />
              </LineChart>
            ) : chartType === 'barChart' ? (
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="eqp" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="EQC" />
                <Bar dataKey="tours" fill="var(--color-success)" radius={[4, 4, 0, 0]} name="Tours" />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={150}
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
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* ─── Dashboard principal / Main dashboard ─── */
export function KpiDashboard({ tours, volumes, pickupSummaries, today, weekStart, monthStart }: KpiDashboardProps) {
  const { t } = useTranslation()
  const [expandedChart, setExpandedChart] = useState<ExpandedChart>(null)

  /* Filtrage 4 périodes : année (all), mois, semaine, aujourd'hui */
  const monthTours = useMemo(() => tours.filter(tour => tour.date >= monthStart), [tours, monthStart])
  const weekTours = useMemo(() => tours.filter(tour => tour.date >= weekStart), [tours, weekStart])
  const todayTours = useMemo(() => tours.filter(tour => tour.date === today), [tours, today])
  const monthVolumes = useMemo(() => volumes.filter(v => v.date >= monthStart), [volumes, monthStart])
  const weekVolumes = useMemo(() => volumes.filter(v => v.date >= weekStart), [volumes, weekStart])
  const todayVolumes = useMemo(() => volumes.filter(v => v.date === today), [volumes, today])

  /* KPIs pour chaque période / KPIs for each period */
  const yearKpis = useMemo(() => computeKpis(tours, volumes), [tours, volumes])
  const monthKpis = useMemo(() => computeKpis(monthTours, monthVolumes), [monthTours, monthVolumes])
  const weekKpis = useMemo(() => computeKpis(weekTours, weekVolumes), [weekTours, weekVolumes])
  const todayKpis = useMemo(() => computeKpis(todayTours, todayVolumes), [todayTours, todayVolumes])

  /* Moyennes par tour pour chaque période / Per-tour averages for each period */
  const yearAvgs = useMemo(() => computeAvgs(yearKpis, tours.length), [yearKpis, tours.length])
  const monthAvgs = useMemo(() => computeAvgs(monthKpis, monthTours.length), [monthKpis, monthTours.length])
  const weekAvgs = useMemo(() => computeAvgs(weekKpis, weekTours.length), [weekKpis, weekTours.length])
  const todayAvgs = useMemo(() => computeAvgs(todayKpis, todayTours.length), [todayKpis, todayTours.length])

  /* Données journalières enrichies / Enriched daily data */
  const dailyData = useMemo(() => {
    const byDate: Record<string, { eqp: number; km: number; tours: number; colis: number }> = {}
    tours.forEach((tour) => {
      if (!byDate[tour.date]) byDate[tour.date] = { eqp: 0, km: 0, tours: 0, colis: 0 }
      byDate[tour.date].eqp += tour.total_eqp ?? 0
      byDate[tour.date].km += tour.total_km ?? 0
      byDate[tour.date].tours += 1
    })
    const tourDateMap = new Map<number, string>()
    tours.forEach(t => tourDateMap.set(t.id, t.date))
    volumes.forEach(v => {
      if (v.tour_id && tourDateMap.has(v.tour_id)) {
        const d = tourDateMap.get(v.tour_id)!
        if (byDate[d]) byDate[d].colis += v.nb_colis ?? 0
      }
    })
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date: date.slice(8) + '/' + date.slice(5, 7),
        ...vals,
        avgKmPerTour: vals.tours > 0 ? Math.round(vals.km / vals.tours) : 0,
        avgEqcPerTour: vals.tours > 0 ? Math.round((vals.eqp / vals.tours) * 10) / 10 : 0,
        avgColisPerTour: vals.tours > 0 ? Math.round(vals.colis / vals.tours) : 0,
        avgColisPerEqc: vals.eqp > 0 ? Math.round((vals.colis / vals.eqp) * 10) / 10 : 0,
      }))
  }, [tours, volumes])

  /* Statuts pour PieChart / Status distribution data */
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {}
    tours.forEach((tour) => { counts[tour.status] = (counts[tour.status] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [tours])

  /* Reprises par type / Pickup stats by type */
  const pickupStats = useMemo(() => {
    const stats: Record<string, { quantity: number; pdvCount: number }> = {
      CONTAINER: { quantity: 0, pdvCount: 0 },
      CARDBOARD: { quantity: 0, pdvCount: 0 },
      MERCHANDISE: { quantity: 0, pdvCount: 0 },
      CONSIGNMENT: { quantity: 0, pdvCount: 0 },
    }
    for (const summary of pickupSummaries) {
      const seenTypes = new Set<string>()
      for (const req of summary.requests) {
        const s = stats[req.pickup_type]
        if (s) {
          s.quantity += req.quantity
          if (!seenTypes.has(req.pickup_type)) {
            s.pdvCount += 1
            seenTypes.add(req.pickup_type)
          }
        }
      }
    }
    return stats
  }, [pickupSummaries])

  const hasPickups = pickupSummaries.length > 0

  /* ─── Lignes de la table KPI / KPI table rows ─── */

  interface KpiRow {
    label: string
    month: number
    week: number
    day: number
    avg: number
    unit?: string
    color: string
  }

  /* Lignes totaux / Total rows */
  const totalRows: KpiRow[] = useMemo(() => [
    { label: t('kpi.totalTours'), month: monthKpis.totalTours, week: weekKpis.totalTours, day: todayKpis.totalTours, avg: yearKpis.totalTours, color: 'var(--color-primary)' },
    { label: t('kpi.totalEqp'), month: monthKpis.totalEqp, week: weekKpis.totalEqp, day: todayKpis.totalEqp, avg: yearKpis.totalEqp, color: 'var(--color-success)' },
    { label: t('kpi.totalEqpDerived'), month: monthKpis.totalEqpDerived, week: weekKpis.totalEqpDerived, day: todayKpis.totalEqpDerived, avg: yearKpis.totalEqpDerived, color: 'var(--color-success)' },
    { label: t('kpi.totalColis'), month: monthKpis.totalColis, week: weekKpis.totalColis, day: todayKpis.totalColis, avg: yearKpis.totalColis, color: 'var(--color-info, #3b82f6)' },
    { label: t('kpi.totalKm'), month: monthKpis.totalKm, week: weekKpis.totalKm, day: todayKpis.totalKm, avg: yearKpis.totalKm, unit: 'km', color: 'var(--color-warning)' },
    { label: t('kpi.totalCost'), month: monthKpis.totalCost, week: weekKpis.totalCost, day: todayKpis.totalCost, avg: yearKpis.totalCost, unit: '€', color: 'var(--color-danger)' },
    { label: t('kpi.co2'), month: monthKpis.estimatedCO2, week: weekKpis.estimatedCO2, day: todayKpis.estimatedCO2, avg: yearKpis.estimatedCO2, unit: 'kg', color: 'var(--text-muted)' },
  ], [t, monthKpis, weekKpis, todayKpis, yearKpis])

  /* Lignes stratégiques (moyennes par tour) / Strategic rows (per-tour averages) */
  const strategicRows: KpiRow[] = useMemo(() => [
    { label: t('kpi.avgKmPerTour'), month: monthAvgs.avgKm, week: weekAvgs.avgKm, day: todayAvgs.avgKm, avg: yearAvgs.avgKm, unit: 'km', color: 'var(--color-primary)' },
    { label: t('kpi.avgEqpPerTour'), month: monthAvgs.avgEqc, week: weekAvgs.avgEqc, day: todayAvgs.avgEqc, avg: yearAvgs.avgEqc, color: 'var(--color-success)' },
    { label: t('kpi.avgColisPerTour'), month: monthAvgs.avgColis, week: weekAvgs.avgColis, day: todayAvgs.avgColis, avg: yearAvgs.avgColis, color: 'var(--color-info, #3b82f6)' },
    { label: t('kpi.avgColisPerEqc'), month: monthAvgs.avgColisEqc, week: weekAvgs.avgColisEqc, day: todayAvgs.avgColisEqc, avg: yearAvgs.avgColisEqc, color: 'var(--color-warning)' },
  ], [t, monthAvgs, weekAvgs, todayAvgs, yearAvgs])

  /* Config sparklines — valeurs = moyennes annuelles / Sparkline configs — values = yearly averages */
  const sparklineConfigs = [
    { key: 'sparkKm' as const, label: t('kpi.avgKmPerTour'), dataKey: 'avgKmPerTour', color: 'var(--color-primary)', value: `${yearAvgs.avgKm} km` },
    { key: 'sparkEqc' as const, label: t('kpi.avgEqpPerTour'), dataKey: 'avgEqcPerTour', color: 'var(--color-success)', value: `${yearAvgs.avgEqc}` },
    { key: 'sparkColis' as const, label: t('kpi.avgColisPerTour'), dataKey: 'avgColisPerTour', color: 'var(--color-info, #3b82f6)', value: `${yearAvgs.avgColis}` },
    { key: 'sparkColisEqc' as const, label: t('kpi.avgColisPerEqc'), dataKey: 'avgColisPerEqc', color: 'var(--color-warning)', value: `${yearAvgs.avgColisEqc}` },
  ]

  /* Formattage valeur / Format value */
  const fmt = (v: number, unit?: string) => {
    const formatted = unit === '€' ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : v.toLocaleString('fr-FR')
    return unit ? `${formatted} ${unit}` : formatted
  }

  /* Rendu d'une ligne de table / Render a table row */
  const renderRow = (row: KpiRow, i: number, isLast: boolean) => (
    <tr key={i} style={{ borderBottom: !isLast ? '1px solid var(--border-color)' : undefined }}>
      <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: row.color }}>{fmt(row.month, row.unit)}</td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: row.color }}>{fmt(row.week, row.unit)}</td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: row.color }}>{fmt(row.day, row.unit)}</td>
      <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>{fmt(row.avg, row.unit)}</td>
    </tr>
  )

  return (
    <div className="space-y-3">
      {/* ─── Row 1 : Table KPI + Sparklines ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Table compacte / Compact table */}
        <div
          className="lg:col-span-3 rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>KPI</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('kpi.thisMonth')}</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('kpi.thisWeek')}</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('kpi.today')}</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}>Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {/* Totaux / Totals */}
              {totalRows.map((row, i) => renderRow(row, i, false))}
              {/* Séparateur visuel / Visual separator */}
              <tr>
                <td colSpan={5} className="py-0">
                  <div style={{ borderTop: '2px solid var(--color-primary)', opacity: 0.3 }} />
                </td>
              </tr>
              {/* KPIs stratégiques (moyennes/tour) / Strategic KPIs (per-tour averages) */}
              {strategicRows.map((row, i) => renderRow(row, i, i === strategicRows.length - 1))}
            </tbody>
          </table>
        </div>

        {/* 4 Sparklines en grille 2x2 / 2x2 sparkline grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-2">
          {sparklineConfigs.map(cfg => (
            <SparklineCard
              key={cfg.key}
              label={cfg.label}
              value={cfg.value}
              data={dailyData}
              dataKey={cfg.dataKey}
              color={cfg.color}
              onClick={() => setExpandedChart(cfg.key)}
            />
          ))}
        </div>
      </div>

      {/* ─── Row 2 : BarChart + PieChart + Reprises ─── */}
      <div className={`grid gap-3 ${hasPickups ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* BarChart EQC/jour clicable / Clickable EQC/day bar chart */}
        <div
          className={`rounded-xl border p-3 cursor-pointer transition-colors hover:brightness-105 ${hasPickups ? 'lg:col-span-5' : 'lg:col-span-2'}`}
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          onClick={() => setExpandedChart('barChart')}
        >
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('kpi.eqpPerDay')}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="eqp" fill="var(--color-primary)" radius={[3, 3, 0, 0]} name="EQC" />
              <Bar dataKey="tours" fill="var(--color-success)" radius={[3, 3, 0, 0]} name="Tours" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PieChart statuts clicable / Clickable status pie chart */}
        <div
          className={`rounded-xl border p-3 cursor-pointer transition-colors hover:brightness-105 ${hasPickups ? 'lg:col-span-4' : 'lg:col-span-1'}`}
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          onClick={() => setExpandedChart('pieChart')}
        >
          <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('kpi.statusDistribution')}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={70}
                dataKey="value"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {statusData.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Reprises en attente — liste compacte / Pending pickups — compact list */}
        {hasPickups && (
          <div
            className="lg:col-span-3 rounded-xl border p-3"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <h3 className="text-xs font-semibold mb-2" style={{ color: '#f59e0b' }}>
              Reprises en attente
            </h3>
            <div className="space-y-1.5">
              {Object.entries(pickupStats).map(([type, s]) => {
                if (s.quantity === 0) return null
                return (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-primary)' }}>{PICKUP_TYPE_LABELS[type]}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                      >
                        {s.pdvCount} PDV
                      </span>
                      <span className="font-bold tabular-nums" style={{ color: '#f59e0b' }}>
                        {s.quantity}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modale agrandissement / Expand modal ─── */}
      <ChartModal
        chartType={expandedChart}
        onClose={() => setExpandedChart(null)}
        dailyData={dailyData}
        statusData={statusData}
        sparklineConfigs={sparklineConfigs}
      />
    </div>
  )
}
