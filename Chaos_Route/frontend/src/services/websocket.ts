/* Client WebSocket temps reel / Real-time WebSocket client */

import { useAuthStore } from '../stores/useAuthStore'

type MessageHandler = (data: Record<string, unknown>) => void

class TrackingWebSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private shouldReconnect = true
  private onStatusChange: ((connected: boolean) => void) | null = null

  connect() {
    const token = useAuthStore.getState().accessToken
    if (!token) return

    this.shouldReconnect = true

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/ws/tracking?token=${token}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectDelay = 1000
        this.onStatusChange?.(true)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const type = data.type as string
          if (type) {
            const typeHandlers = this.handlers.get(type)
            if (typeHandlers) {
              typeHandlers.forEach((handler) => handler(data))
            }
          }
          // Broadcast aussi aux handlers '*' / Also broadcast to wildcard handlers
          const allHandlers = this.handlers.get('*')
          if (allHandlers) {
            allHandlers.forEach((handler) => handler(data))
          }
        } catch { /* ignore parse errors */ }
      }

      this.ws.onclose = () => {
        this.onStatusChange?.(false)
        if (this.shouldReconnect) {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
      this.connect()
    }, this.reconnectDelay)
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  subscribe(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  setStatusListener(listener: ((connected: boolean) => void) | null) {
    this.onStatusChange = listener
  }
}

export const trackingWS = new TrackingWebSocket()
