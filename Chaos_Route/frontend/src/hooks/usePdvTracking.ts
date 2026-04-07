/* Hook de tracking live pour les livraisons PDV / Live tracking hook for PDV deliveries */

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAll } from '../services/api'
import { trackingWS } from '../services/websocket'
import type { DriverPosition, ActiveTour } from '../types'

const POLLING_INTERVAL = 10_000

export function usePdvTracking(tourIds: number[], enabled: boolean) {
  const [positions, setPositions] = useState<DriverPosition[]>([])
  const [activeTours, setActiveTours] = useState<ActiveTour[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const tourIdSet = useRef(new Set<number>())

  /* Garder le Set synchronisé / Keep Set in sync */
  useEffect(() => {
    tourIdSet.current = new Set(tourIds)
  }, [tourIds])

  const loadData = useCallback(async () => {
    if (tourIds.length === 0) return
    try {
      const [allPositions, allTours] = await Promise.all([
        fetchAll<DriverPosition>('/tracking/positions'),
        fetchAll<ActiveTour>('/tracking/active-stops'),
      ])
      setPositions(allPositions.filter(p => tourIdSet.current.has(p.tour_id)))
      setActiveTours(allTours.filter(t => tourIdSet.current.has(t.tour_id)))
    } catch { /* ignore — polling réessaiera */ }
  }, [tourIds])

  /* Polling */
  useEffect(() => {
    if (!enabled || tourIds.length === 0) return
    loadData()
    const id = setInterval(loadData, POLLING_INTERVAL)
    return () => clearInterval(id)
  }, [enabled, loadData, tourIds])

  /* WebSocket */
  useEffect(() => {
    if (!enabled || tourIds.length === 0) return

    trackingWS.setStatusListener(setWsConnected)
    trackingWS.connect()

    const unsubGps = trackingWS.subscribe('gps_update', (data) => {
      const tourId = data.tour_id as number
      if (!tourIdSet.current.has(tourId)) return
      setPositions(prev => {
        const idx = prev.findIndex(p => p.tour_id === tourId)
        const updated: DriverPosition = {
          tour_id: tourId,
          tour_code: data.tour_code as string,
          driver_name: data.driver_name as string | undefined,
          latitude: data.latitude as number,
          longitude: data.longitude as number,
          speed: data.speed as number | undefined,
          accuracy: data.accuracy as number | undefined,
          timestamp: data.timestamp as string,
          stops_total: idx >= 0 ? prev[idx].stops_total : 0,
          stops_delivered: idx >= 0 ? prev[idx].stops_delivered : 0,
        }
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updated
          return next
        }
        return [...prev, updated]
      })
    })

    const unsubStop = trackingWS.subscribe('stop_event', () => {
      /* Recharger les stops pour mise à jour statut / Reload stops for status update */
      loadData()
    })

    return () => {
      unsubGps()
      unsubStop()
      trackingWS.release()
    }
  }, [enabled, tourIds, loadData])

  /* Reset quand désactivé */
  useEffect(() => {
    if (!enabled) {
      setPositions([])
      setActiveTours([])
    }
  }, [enabled])

  return { positions, activeTours, wsConnected }
}
