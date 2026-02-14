/* Page d'accueil / Dashboard page */

import { useTranslation } from 'react-i18next'

export default function Dashboard() {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('dashboard.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('dashboard.tours'), value: '—', color: 'var(--color-primary)' },
          { label: t('dashboard.pdvs'), value: '—', color: 'var(--color-success)' },
          { label: t('dashboard.vehicles'), value: '—', color: 'var(--color-warning)' },
          { label: t('dashboard.totalKm'), value: '—', color: 'var(--color-danger)' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5 border"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
            <p className="text-3xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div
        className="mt-8 rounded-xl p-6 border"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <p style={{ color: 'var(--text-muted)' }}>{t('dashboard.welcome')}</p>
      </div>
    </div>
  )
}
