/* Page principale de planification Mode 1 / Main tour planning page (Mode 1) */

import { useTranslation } from 'react-i18next'
import { TourBuilder } from '../components/tour/TourBuilder'

export default function TourPlanning() {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('tourPlanning.title')}
      </h2>
      <TourBuilder />
    </div>
  )
}
