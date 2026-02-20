/* Recherche PDV dans suivi chauffeurs / PDV search in driver tracking */

import { useState, useMemo } from 'react'
import type { ActiveTour, ActiveTourStop } from '../../types'

interface PdvSearchResult {
  tour: ActiveTour
  stop: ActiveTourStop
}

interface PdvSearchProps {
  activeTours: ActiveTour[]
  selectedResult: PdvSearchResult | null
  onSelect: (result: PdvSearchResult | null) => void
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DELIVERED: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Livre' },
  ARRIVED: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', label: 'Sur place' },
  PENDING: { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', label: 'En attente' },
  SKIPPED: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Non livre' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.PENDING
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

export function PdvSearch({ activeTours, selectedResult, onSelect }: PdvSearchProps) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const matches: PdvSearchResult[] = []
    for (const tour of activeTours) {
      for (const stop of tour.stops) {
        const code = (stop.pdv_code || '').toLowerCase()
        const name = (stop.pdv_name || '').toLowerCase()
        const city = (stop.pdv_city || '').toLowerCase()
        if (code.includes(q) || name.includes(q) || city.includes(q)) {
          matches.push({ tour, stop })
        }
      }
    }
    return matches
  }, [query, activeTours])

  const handleClear = () => {
    setQuery('')
    onSelect(null)
  }

  const sel = selectedResult

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      {/* Barre de recherche / Search bar */}
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>&#x1F50D;</span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (sel) onSelect(null) }}
          placeholder="Rechercher un PDV (code, nom, ville)..."
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        {(query || sel) && (
          <button onClick={handleClear} className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>&times;</button>
        )}
      </div>

      {/* Resultats dropdown / Results dropdown */}
      {!sel && query.length >= 2 && (
        <div className="max-h-48 overflow-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Aucun resultat
            </div>
          ) : (
            results.map((r) => (
              <button
                key={`${r.tour.tour_id}-${r.stop.stop_id}`}
                onClick={() => onSelect(r)}
                className="w-full text-left px-3 py-2 border-b hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>{r.stop.pdv_code}</span>
                    <span className="text-xs ml-1" style={{ color: 'var(--text-primary)' }}>{r.stop.pdv_name}</span>
                  </div>
                  <StatusBadge status={r.stop.delivery_status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.stop.pdv_city || '—'}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>·</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{r.tour.tour_code}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{r.tour.driver_name || ''}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Fiche info PDV / PDV info card */}
      {sel && (
        <InfoCard tour={sel.tour} stop={sel.stop} />
      )}
    </div>
  )
}

function InfoCard({ tour, stop }: { tour: ActiveTour; stop: ActiveTourStop }) {
  const totalStops = tour.stops.length
  const stopIndex = tour.stops.findIndex((s) => s.stop_id === stop.stop_id)
  const position = stopIndex + 1

  // Stops restants avant ce PDV (PENDING uniquement) / Remaining stops before this PDV (PENDING only)
  const pendingBefore = tour.stops
    .filter((s) => s.sequence_order < stop.sequence_order && s.delivery_status === 'PENDING')
    .length

  return (
    <div className="px-3 py-2 space-y-2">
      {/* PDV info */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{stop.pdv_code}</span>
          <StatusBadge status={stop.delivery_status} />
        </div>
        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{stop.pdv_name}</div>
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{stop.pdv_city || '—'}</div>
      </div>

      {/* Fenetre livraison / Delivery window */}
      {(stop.pdv_delivery_window_start || stop.pdv_delivery_window_end) && (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          <span style={{ color: 'var(--text-muted)' }}>Fenetre:</span>
          <span className="font-medium">
            {stop.pdv_delivery_window_start || '?'} — {stop.pdv_delivery_window_end || '?'}
          </span>
        </div>
      )}

      <hr style={{ borderColor: 'var(--border-color)' }} />

      {/* Tour info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Tour:</span>
          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{tour.tour_code}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Chauffeur:</span>
          <span style={{ color: 'var(--text-primary)' }}>{tour.driver_name || '—'}</span>
        </div>
        {tour.departure_time && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Depart:</span>
            <span style={{ color: 'var(--text-primary)' }}>{tour.departure_time}</span>
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--border-color)' }} />

      {/* Position dans la tournee / Position in tour */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>Position:</span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Stop {position}/{totalStops}</span>
        </div>
        {stop.delivery_status === 'PENDING' && pendingBefore > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Stops restants avant:</span>
            <span className="font-bold" style={{ color: '#f97316' }}>{pendingBefore}</span>
          </div>
        )}
        {stop.arrival_time && (
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Heure prevue:</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{stop.arrival_time}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)' }}>EQP:</span>
          <span style={{ color: 'var(--text-primary)' }}>{stop.eqp_count}</span>
        </div>
      </div>
    </div>
  )
}
