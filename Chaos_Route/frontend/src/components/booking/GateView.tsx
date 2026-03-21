/* Vue poste de garde — check-in / depart / Gate view — check-in / departure */

import { useState } from 'react'
import api from '../../services/api'
import type { Booking } from './types'
import { STATUS_COLORS } from './types'

interface Props {
  checkedInBookings: Booking[]
  atDockBookings: Booking[]
  dockLeftBookings: Booking[]
  fetchData: () => void
}

export function GateView({ checkedInBookings, atDockBookings, dockLeftBookings, fetchData }: Props) {
  const [gateOrderNum, setGateOrderNum] = useState('')
  const [gatePlate, setGatePlate] = useState('')
  const [gatePhone, setGatePhone] = useState('')
  const [gateDriverName, setGateDriverName] = useState('')
  const [gateCheckinResult, setGateCheckinResult] = useState<string | null>(null)

  const handleGateCheckin = async () => {
    if (!gateOrderNum || !gatePlate || !gatePhone) { alert('N° commande, plaque et telephone requis'); return }
    try {
      await api.post('/reception-booking/checkin/', {
        order_number: gateOrderNum, license_plate: gatePlate,
        phone_number: gatePhone, driver_name: gateDriverName || null,
      })
      setGateCheckinResult(`Check-in OK — ${gateOrderNum} / ${gatePlate}`)
      setGateOrderNum(''); setGatePlate(''); setGatePhone(''); setGateDriverName('')
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      setGateCheckinResult(`Erreur : ${detail}`)
    }
  }

  const handleGateSiteDeparture = async (bookingId: number) => {
    try {
      await api.post(`/reception-booking/bookings/${bookingId}/site-departure`)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm border"
  const inputStyle = { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }

  return (
    <div className="space-y-4">
      {/* Check-in arrivee */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Check-in chauffeur (arrivee sur site)
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>N° commande (Rd) *</label>
            <input type="text" value={gateOrderNum} onChange={(e) => setGateOrderNum(e.target.value)}
              className={inputCls} style={inputStyle} placeholder="Scanner ou saisir" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Plaque immatriculation *</label>
            <input type="text" value={gatePlate} onChange={(e) => setGatePlate(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Telephone *</label>
            <input type="text" value={gatePhone} onChange={(e) => setGatePhone(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nom chauffeur</label>
            <input type="text" value={gateDriverName} onChange={(e) => setGateDriverName(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={handleGateCheckin}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: STATUS_COLORS.CHECKED_IN }}>
            Enregistrer arrivee
          </button>
          {gateCheckinResult && (
            <span className="text-sm" style={{ color: gateCheckinResult.startsWith('Erreur') ? '#ef4444' : '#22c55e' }}>
              {gateCheckinResult}
            </span>
          )}
        </div>
      </div>

      {/* En attente depart */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          En attente de depart ({dockLeftBookings.length})
        </h2>
        {dockLeftBookings.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun chauffeur en attente de depart</div>
        ) : (
          <div className="space-y-2">
            {dockLeftBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUS_COLORS.DOCK_LEFT }}>
                    Parti du quai
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {b.supplier_name || 'Sans nom'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {b.start_time}-{b.end_time} · {b.pallet_count} pal. · Q{b.dock_number}
                  </span>
                  {b.checkin && (
                    <span className="text-xs" style={{ color: '#3b82f6' }}>{b.checkin.license_plate}</span>
                  )}
                </div>
                <button onClick={() => handleGateSiteDeparture(b.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ backgroundColor: STATUS_COLORS.COMPLETED }}>
                  Parti du site
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recap journee */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Situation du jour</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg" style={{ backgroundColor: `${STATUS_COLORS.CHECKED_IN}15` }}>
            <div className="text-2xl font-bold" style={{ color: STATUS_COLORS.CHECKED_IN }}>{checkedInBookings.length}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>En attente quai</div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: `${STATUS_COLORS.AT_DOCK}15` }}>
            <div className="text-2xl font-bold" style={{ color: STATUS_COLORS.AT_DOCK }}>{atDockBookings.length}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>A quai / Dechargement</div>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: `${STATUS_COLORS.DOCK_LEFT}15` }}>
            <div className="text-2xl font-bold" style={{ color: STATUS_COLORS.DOCK_LEFT }}>{dockLeftBookings.length}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Attente depart</div>
          </div>
        </div>
      </div>
    </div>
  )
}
