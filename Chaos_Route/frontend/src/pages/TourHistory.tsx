import { useTranslation } from 'react-i18next'

export default function TourHistory() {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('tourHistory.title')}
      </h2>
      <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <p style={{ color: 'var(--text-muted)' }}>{t('common.comingSoon')}</p>
      </div>
    </div>
  )
}
