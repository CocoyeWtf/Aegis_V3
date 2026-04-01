/* Page popup Gantt détaché / Detached Gantt popup page */

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/useAppStore'
import { TourGantt, type GanttTour } from '../components/tour/TourGantt'
import api from '../services/api'

export default function DetachedGantt() {
  const [searchParams] = useSearchParams()
  const date = searchParams.get('date') || ''
  const themeParam = searchParams.get('theme') || 'dark'
  const { setSelectedRegion } = useAppStore()

  const [timeline, setTimeline] = useState<GanttTour[]>([])
  const [highlightedTourId, setHighlightedTourId] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  /* Appliquer le thème / Apply theme */
  useEffect(() => {
    document.documentElement.classList.toggle('light', themeParam === 'light')
    document.title = `Chaos Route — Timeline ${date}`
  }, [themeParam, date])

  /* Synchroniser la région / Sync region */
  useEffect(() => {
    const regionId = searchParams.get('regionId')
    if (regionId) setSelectedRegion(Number(regionId))
  }, [searchParams, setSelectedRegion])

  /* Charger la timeline / Load timeline */
  const loadTimeline = useCallback(async () => {
    if (!date) return
    try {
      const res = await api.get<GanttTour[]>('/tours/timeline', { params: { date } })
      setTimeline(res.data)
      setReady(true)
    } catch {
      setTimeline([])
      setReady(true)
    }
  }, [date])

  useEffect(() => { loadTimeline() }, [loadTimeline])

  /* Rafraîchir toutes les 30s / Auto-refresh every 30s */
  useEffect(() => {
    if (!date) return
    const id = setInterval(loadTimeline, 30_000)
    return () => clearInterval(id)
  }, [date, loadTimeline])

  if (!ready) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}
      >
        <div className="text-center space-y-2">
          <div className="text-lg font-semibold">Chargement...</div>
          <div className="text-sm">Timeline du {date}</div>
        </div>
      </div>
    )
  }

  /* Filtrer les tours planifiés (avec departure_time) / Filter scheduled tours */
  const scheduledTours = timeline.filter(t => t.departure_time && t.return_time)

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: 'var(--bg-primary)', overflow: 'auto' }}>
      <div style={{ padding: '8px 16px', minWidth: 'fit-content' }}>
        <TourGantt
          tours={scheduledTours}
          highlightedTourId={highlightedTourId}
          onTourClick={setHighlightedTourId}
        />
      </div>
    </div>
  )
}
