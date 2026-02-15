/* Page d'accueil avec KPI / Dashboard page with KPI */

import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../stores/useAppStore'
import { KpiDashboard } from '../components/kpi/KpiDashboard'
import type { Tour } from '../types'

export default function Dashboard() {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()

  const params = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: tours, loading } = useApi<Tour>('/tours', params)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('dashboard.title')}
      </h2>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : tours.length > 0 ? (
        <KpiDashboard tours={tours} />
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
