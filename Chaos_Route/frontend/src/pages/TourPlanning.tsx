/* Page planification avec tabs Construction + Ordonnancement / Planning page with Construction + Scheduling tabs */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../stores/useAppStore'
import { TourBuilder } from '../components/tour/TourBuilder'
import { TourScheduler } from '../components/tour/TourScheduler'

type Tab = 'construction' | 'scheduling'

export default function TourPlanning() {
  const { t } = useTranslation()
  const { isFullscreen, toggleFullscreen } = useAppStore()
  const [activeTab, setActiveTab] = useState<Tab>('construction')

  /* State partagé entre les deux tabs / Shared state between both tabs */
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'construction', label: t('tourPlanning.tabs.construction') },
    { key: 'scheduling', label: t('tourPlanning.tabs.scheduling') },
  ]

  return (
    <div>
      {/* En-tête avec titre + tabs + bouton fullscreen / Header with title + tabs + fullscreen button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('tourPlanning.title')}
        </h2>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--border-color)' }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className="px-4 py-2 text-sm font-medium transition-all"
                style={{
                  backgroundColor: activeTab === tab.key ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
                }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bouton plein écran / Fullscreen button */}
          <button
            className="px-3 py-2 rounded-lg border text-sm transition-all hover:opacity-80"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
            onClick={toggleFullscreen}
            title={isFullscreen ? t('tourPlanning.exitFullscreen') : t('tourPlanning.enterFullscreen')}
          >
            {isFullscreen ? '⊟' : '⊞'}
          </button>
        </div>
      </div>

      {/* Contenu du tab actif / Active tab content */}
      {activeTab === 'construction' ? (
        <TourBuilder
          selectedDate={selectedDate}
          selectedBaseId={selectedBaseId}
          onDateChange={setSelectedDate}
          onBaseChange={setSelectedBaseId}
        />
      ) : (
        <TourScheduler
          selectedDate={selectedDate}
          selectedBaseId={selectedBaseId}
          onDateChange={setSelectedDate}
          onBaseChange={setSelectedBaseId}
        />
      )}
    </div>
  )
}
