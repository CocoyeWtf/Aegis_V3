/* Page reception reprises base / Base pickup reception page */

import { useState, useRef, useCallback } from 'react'
import api from '../services/api'
import type { PickupLabel } from '../types'

interface ReceivedEntry {
  label: PickupLabel
  pdvCode?: string
  pdvName?: string
  supportType?: string
  receivedAt: string
}

export default function BaseReception() {
  const [inputValue, setInputValue] = useState('')
  const [receivedToday, setReceivedToday] = useState<ReceivedEntry[]>([])
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return
    setProcessing(true)
    setLastResult(null)

    try {
      const { data: label } = await api.post<PickupLabel>(
        `/pickup-requests/labels/receive?label_code=${encodeURIComponent(code.trim())}`
      )

      // Charger le detail de la demande pour le nom PDV / Load request detail for PDV name
      let pdvCode = ''
      let pdvName = ''
      let supportType = ''
      try {
        const { data: req } = await api.get(`/pickup-requests/${label.pickup_request_id}`)
        pdvCode = req.pdv?.code || ''
        pdvName = req.pdv?.name || ''
        supportType = req.support_type?.name || ''
      } catch { /* ignore */ }

      const entry: ReceivedEntry = {
        label,
        pdvCode,
        pdvName,
        supportType,
        receivedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      }
      setReceivedToday((prev) => [entry, ...prev])
      setLastResult({ success: true, message: `${code} - ${pdvCode} ${pdvName} - ${supportType}` })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      setLastResult({ success: false, message: `${code}: ${detail}` })
    } finally {
      setProcessing(false)
      setInputValue('')
      inputRef.current?.focus()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScan(inputValue)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Reception reprises
      </h1>

      {/* Zone scan / Scan zone */}
      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Scanner ou saisir le code etiquette
        </label>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={processing}
          placeholder="RET-XXXXX-PAL-20260220-001"
          className="w-full px-4 py-3 rounded-lg border text-lg font-mono"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />

        {/* Feedback dernier scan / Last scan feedback */}
        {lastResult && (
          <div
            className="mt-3 px-4 py-3 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: lastResult.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: lastResult.success ? '#22c55e' : '#ef4444',
            }}
          >
            {lastResult.success ? '✓' : '✗'} {lastResult.message}
          </div>
        )}
      </div>

      {/* Tableau recus aujourd'hui / Received today table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            Recus aujourd'hui ({receivedToday.length})
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Heure</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Code etiquette</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>PDV</th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Type support</th>
            </tr>
          </thead>
          <tbody>
            {receivedToday.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucune reception
                </td>
              </tr>
            )}
            {receivedToday.map((entry, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  {entry.receivedAt}
                </td>
                <td className="px-4 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>
                  {entry.label.label_code}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>
                  {entry.pdvCode} - {entry.pdvName}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>
                  {entry.supportType}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
