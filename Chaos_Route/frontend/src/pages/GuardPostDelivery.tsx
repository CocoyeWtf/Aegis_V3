/* Page check-in/out livraison pour le poste de garde /
   Guard post delivery check-in/out page.
   Gère les départs et retours des chauffeurs livraison (tournées PDV). */

import { useState, useEffect, useCallback } from 'react'

interface DeliveryEntry {
  id?: number
  driver_name: string
  license_plate: string
  tour_number?: string
  departure_time?: string
  return_time?: string
  status: 'OUT' | 'RETURNED'
  notes?: string
}

const STATUS_COLORS = { OUT: '#f59e0b', RETURNED: '#22c55e' }
const STATUS_LABELS = { OUT: 'En livraison', RETURNED: 'Rentre' }

export default function GuardPostDelivery() {
  const [entries, setEntries] = useState<DeliveryEntry[]>([])
  const [driverName, setDriverName] = useState('')
  const [plate, setPlate] = useState('')
  const [tourNum, setTourNum] = useState('')
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<string | null>(null)

  // Pour l'instant, gestion locale (pas de backend dédié, stocké en localStorage)
  // Sera remplacé par un endpoint backend quand le module livraison sera développé
  const STORAGE_KEY = 'guard_delivery_entries'

  const loadEntries = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as DeliveryEntry[]
        // Ne garder que les entrées du jour
        setEntries(parsed)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  const saveEntries = (newEntries: DeliveryEntry[]) => {
    setEntries(newEntries)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries))
  }

  const now = () => new Date().toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

  const handleDeparture = () => {
    if (!driverName || !plate) { alert('Nom chauffeur et plaque requis'); return }
    const entry: DeliveryEntry = {
      id: Date.now(),
      driver_name: driverName,
      license_plate: plate,
      tour_number: tourNum || undefined,
      departure_time: now(),
      status: 'OUT',
      notes: notes || undefined,
    }
    saveEntries([entry, ...entries])
    setDriverName(''); setPlate(''); setTourNum(''); setNotes('')
    setResult(`Depart enregistre — ${driverName} / ${plate}`)
  }

  const handleReturn = (id: number) => {
    saveEntries(entries.map((e) =>
      e.id === id ? { ...e, status: 'RETURNED' as const, return_time: now() } : e
    ))
  }

  const outEntries = entries.filter((e) => e.status === 'OUT')
  const returnedEntries = entries.filter((e) => e.status === 'RETURNED')

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Check-in/out Livraison
      </h1>

      {/* Formulaire depart */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Depart chauffeur
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nom chauffeur *</label>
            <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Plaque *</label>
            <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>N° tournee</label>
            <input type="text" value={tourNum} onChange={(e) => setTourNum(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={handleDeparture}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#f59e0b' }}>
            Enregistrer depart
          </button>
          {result && (
            <span className="text-sm" style={{ color: '#22c55e' }}>{result}</span>
          )}
        </div>
      </div>

      {/* En livraison */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          En livraison ({outEntries.length})
        </h2>
        {outEntries.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun chauffeur en livraison</div>
        ) : (
          <div className="space-y-2">
            {outEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUS_COLORS.OUT }}>
                    {STATUS_LABELS.OUT}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{e.driver_name}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{e.license_plate}</span>
                  {e.tour_number && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>T{e.tour_number}</span>}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Depart {e.departure_time}</span>
                </div>
                <button onClick={() => handleReturn(e.id!)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ backgroundColor: STATUS_COLORS.RETURNED }}>
                  Retour base
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retours du jour */}
      {returnedEntries.length > 0 && (
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Retours du jour ({returnedEntries.length})
          </h2>
          <div className="space-y-1">
            {returnedEntries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUS_COLORS.RETURNED, fontSize: '9px' }}>
                  {STATUS_LABELS.RETURNED}
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{e.driver_name}</span>
                <span className="font-mono">{e.license_plate}</span>
                {e.tour_number && <span>T{e.tour_number}</span>}
                <span>Dep. {e.departure_time} — Ret. {e.return_time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
