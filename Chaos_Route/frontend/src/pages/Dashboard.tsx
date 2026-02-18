/* Page d'accueil avec KPI / Dashboard page with KPI */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../stores/useAppStore'
import { KpiDashboard } from '../components/kpi/KpiDashboard'
import type { Tour } from '../types'

/** Lundi de la semaine courante (YYYY-MM-DD) / Monday of current week */
function getWeekStart(today: string): string {
  const d = new Date(today + 'T00:00:00')
  const day = d.getDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().slice(0, 10)
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const monthStart = useMemo(() => today.slice(0, 8) + '01', [today])
  const weekStart = useMemo(() => getWeekStart(today), [today])

  const params = useMemo(() => {
    const p: Record<string, unknown> = { date_from: monthStart, date_to: today }
    if (selectedRegionId) p.region_id = selectedRegionId
    return p
  }, [monthStart, today, selectedRegionId])

  const { data: tours, loading } = useApi<Tour>('/tours', params)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('dashboard.title')}
      </h2>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : tours.length > 0 ? (
        <KpiDashboard tours={tours} today={today} weekStart={weekStart} />
      ) : (
        <div
          className="rounded-xl p-6 border"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.welcome')}</p>
        </div>
      )}
    </div>
  )
}
