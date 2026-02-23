/* Hook BroadcastChannel côté fenêtre principale / BroadcastChannel hook for main window (sender) */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PDV, PdvPickupSummary } from '../types'
import type { PdvVolumeStatus } from '../components/map/PdvMarker'

const CHANNEL_NAME = 'chaos-route-map'

/* Types de messages / Message types */
type MapMessage =
  | { type: 'MAP_INIT'; payload: MapInitPayload }
  | { type: 'MAP_STATE_SYNC'; payload: MapStateSyncPayload }
  | { type: 'MAP_READY' }
  | { type: 'PDV_CLICK'; payload: PDV }
  | { type: 'MAP_CLOSING' }

interface MapInitPayload {
  theme: 'dark' | 'light'
  regionId: number | null
  selectedPdvIds: number[]
  pdvVolumeStatusMap: [number, PdvVolumeStatus][]
  routeCoords: [number, number][]
  pickupByPdv: [number, PdvPickupSummary][]
}

interface MapStateSyncPayload {
  selectedPdvIds: number[]
  pdvVolumeStatusMap: [number, PdvVolumeStatus][]
  routeCoords: [number, number][]
  pickupByPdv: [number, PdvPickupSummary][]
}

interface UseDetachedMapOptions {
  selectedPdvIds: Set<number>
  pdvVolumeStatusMap: Map<number, PdvVolumeStatus>
  routeCoords: [number, number][]
  pickupByPdv: Map<number, PdvPickupSummary>
  theme: 'dark' | 'light'
  regionId: number | null
  onPdvClick: (pdv: PDV) => void
}

export function useDetachedMap({
  selectedPdvIds,
  pdvVolumeStatusMap,
  routeCoords,
  pickupByPdv,
  theme,
  regionId,
  onPdvClick,
}: UseDetachedMapOptions) {
  const [isDetached, setIsDetached] = useState(false)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const popupRef = useRef<Window | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Refs pour garder les valeurs fraîches sans recréer le canal / Refs to keep fresh values without recreating channel */
  const onPdvClickRef = useRef(onPdvClick)
  onPdvClickRef.current = onPdvClick
  const themeRef = useRef(theme)
  themeRef.current = theme
  const regionIdRef = useRef(regionId)
  regionIdRef.current = regionId

  /* Sérialisation Set/Map → arrays / Serialize Set/Map to arrays */
  const serializeState = useCallback((): MapStateSyncPayload => ({
    selectedPdvIds: Array.from(selectedPdvIds),
    pdvVolumeStatusMap: Array.from(pdvVolumeStatusMap.entries()),
    routeCoords,
    pickupByPdv: Array.from(pickupByPdv.entries()),
  }), [selectedPdvIds, pdvVolumeStatusMap, routeCoords, pickupByPdv])

  const serializeRef = useRef(serializeState)
  serializeRef.current = serializeState

  /* Initialisation canal + listeners (une seule fois quand isDetached passe à true) / Init channel + listeners */
  useEffect(() => {
    if (!isDetached) return

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel

    channel.onmessage = (event: MessageEvent<MapMessage>) => {
      const msg = event.data
      if (msg.type === 'MAP_READY') {
        const initPayload: MapInitPayload = {
          theme: themeRef.current,
          regionId: regionIdRef.current,
          ...serializeRef.current(),
        }
        channel.postMessage({ type: 'MAP_INIT', payload: initPayload })
      } else if (msg.type === 'PDV_CLICK') {
        onPdvClickRef.current(msg.payload)
      } else if (msg.type === 'MAP_CLOSING') {
        setIsDetached(false)
      }
    }

    /* Polling backup : détecte popup fermée / Backup polling: detect closed popup */
    pollingRef.current = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        setIsDetached(false)
      }
    }, 1000)

    return () => {
      channel.close()
      channelRef.current = null
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [isDetached])

  /* Synchronise l'état vers la popup / Sync state to popup on changes */
  useEffect(() => {
    if (!isDetached || !channelRef.current) return
    channelRef.current.postMessage({
      type: 'MAP_STATE_SYNC',
      payload: serializeState(),
    } satisfies MapMessage)
  }, [isDetached, serializeState])

  /* Détacher : ouvrir popup / Detach: open popup */
  const detach = useCallback(() => {
    const w = screen.width
    const h = screen.height
    const popup = window.open(
      '/map-detached',
      'chaos-route-map',
      `width=${Math.round(w * 0.6)},height=${Math.round(h * 0.8)},left=0,top=0,menubar=no,toolbar=no,location=no,status=no`,
    )
    if (popup) {
      popupRef.current = popup
      setIsDetached(true)
    }
  }, [])

  /* Rattacher : fermer popup / Attach: close popup */
  const attach = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    popupRef.current = null
    setIsDetached(false)
  }, [])

  /* Cleanup au unmount / Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close()
      }
    }
  }, [])

  return { isDetached, detach, attach }
}
