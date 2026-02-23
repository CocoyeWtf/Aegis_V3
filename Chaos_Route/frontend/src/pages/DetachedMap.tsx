/* Page popup carte détachée / Detached map popup page */

import { useEffect } from 'react'
import { useDetachedMapReceiver } from '../hooks/useDetachedMapReceiver'
import { useAppStore } from '../stores/useAppStore'
import { MapView } from '../components/map/MapView'

export default function DetachedMap() {
  const { ready, theme, regionId, selectedPdvIds, pdvVolumeStatusMap, routeCoords, pickupByPdv, sendPdvClick } =
    useDetachedMapReceiver()

  const { setSelectedRegion } = useAppStore()

  /* Appliquer le thème reçu / Apply received theme */
  useEffect(() => {
    if (!ready) return
    document.documentElement.classList.toggle('light', theme === 'light')
    document.title = 'Chaos Route — Carte'
  }, [ready, theme])

  /* Synchroniser la région pour les appels API de MapView / Sync region for MapView API calls */
  useEffect(() => {
    if (!ready || regionId === null) return
    setSelectedRegion(regionId)
  }, [ready, regionId, setSelectedRegion])

  if (!ready) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}
      >
        <div className="text-center space-y-2">
          <div className="text-lg font-semibold">Connexion...</div>
          <div className="text-sm">En attente de la fenêtre principale</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <MapView
        onPdvClick={sendPdvClick}
        selectedPdvIds={selectedPdvIds}
        pdvVolumeStatusMap={pdvVolumeStatusMap}
        pickupByPdv={pickupByPdv}
        routeCoords={routeCoords}
        height="100%"
      />
    </div>
  )
}
