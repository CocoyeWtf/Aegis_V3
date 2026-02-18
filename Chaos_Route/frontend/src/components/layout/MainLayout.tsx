/* Layout principal / Main layout wrapper */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAppStore } from '../../stores/useAppStore'

export function MainLayout() {
  const { t } = useTranslation()
  const { isFullscreen, exitFullscreen } = useAppStore()

  /* Synchronise le state Zustand avec l'état réel du navigateur / Sync Zustand state with browser fullscreen state */
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      useAppStore.setState({ isFullscreen: fs })
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      {!isFullscreen && <div className="print-hide"><Sidebar /></div>}
      <div className="flex flex-col flex-1 overflow-hidden">
        {!isFullscreen && <div className="print-hide"><Header /></div>}
        <main className="flex-1 overflow-y-auto p-6 relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Outlet />
          {/* Bouton flottant quitter plein écran / Floating exit fullscreen button */}
          {isFullscreen && (
            <button
              className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-full text-sm font-semibold shadow-lg transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
              onClick={exitFullscreen}
            >
              {t('tourPlanning.exitFullscreen')}
            </button>
          )}
        </main>
      </div>
    </div>
  )
}
