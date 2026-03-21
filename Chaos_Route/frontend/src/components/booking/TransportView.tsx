/* Vue enlevements transport / Transport pickups view */

import { useState } from 'react'
import api from '../../services/api'
import type { Booking } from './types'
import { PICKUP_STATUS_LABELS, PICKUP_STATUS_COLORS, DOCK_TYPE_LABELS, DOCK_TYPE_COLORS } from './types'

interface Props {
  pickups: Booking[]
  carriers: { id: number; name: string; code: string }[]
  fetchPickups: () => void
  openEditBooking: (b: Booking) => void
}

export function TransportView({ pickups, carriers, fetchPickups, openEditBooking }: Props) {
  const [pickupFilter, setPickupFilter] = useState('')
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignBookingId, setAssignBookingId] = useState<number | null>(null)
  const [assignCarrierId, setAssignCarrierId] = useState<number | ''>('')
  const [assignInternal, setAssignInternal] = useState(false)
  const [assignPrice, setAssignPrice] = useState('')
  const [assignRef, setAssignRef] = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredPickups = pickupFilter ? pickups.filter(p => p.pickup_status === pickupFilter) : pickups

  const openAssignDialog = (booking: Booking) => {
    setAssignBookingId(booking.id)
    setAssignCarrierId(booking.carrier_id || '')
    setAssignInternal(booking.is_internal_fleet || false)
    setAssignPrice(booking.carrier_price != null ? String(booking.carrier_price) : '')
    setAssignRef(booking.carrier_ref || '')
    setAssignNotes(booking.pickup_notes || '')
    setShowAssignDialog(true)
  }

  const handleAssignPickup = async () => {
    if (!assignBookingId) return
    setSaving(true)
    try {
      await api.put(`/reception-booking/pickups/${assignBookingId}/assign`, {
        carrier_id: assignCarrierId || null,
        is_internal_fleet: assignInternal,
        carrier_price: assignPrice ? Number(assignPrice) : null,
        carrier_ref: assignRef || null,
        pickup_notes: assignNotes || null,
      })
      setShowAssignDialog(false)
      fetchPickups()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally { setSaving(false) }
  }

  const handlePickupStatus = async (bookingId: number, status: string) => {
    try {
      await api.put(`/reception-booking/pickups/${bookingId}/status`, { pickup_status: status })
      fetchPickups()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }

  const nextStatus: Record<string, string> = { PENDING: 'ASSIGNED', ASSIGNED: 'PICKED_UP', PICKED_UP: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED' }
  const inputCls = "w-full px-3 py-2 rounded-lg text-sm border"
  const inputStyle = { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }

  return (
    <div className="space-y-4">
      {/* Compteurs par statut */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        <div className="rounded-lg p-2 text-center cursor-pointer" onClick={() => setPickupFilter('')}
          style={{ backgroundColor: !pickupFilter ? 'var(--color-primary)15' : 'var(--bg-secondary)', border: !pickupFilter ? '2px solid var(--color-primary)' : '2px solid transparent' }}>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{pickups.length}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tous</div>
        </div>
        {(['PENDING', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const).map((s) => (
          <div key={s} className="rounded-lg p-2 text-center cursor-pointer" onClick={() => setPickupFilter(pickupFilter === s ? '' : s)}
            style={{ backgroundColor: `${PICKUP_STATUS_COLORS[s]}15`, border: pickupFilter === s ? `2px solid ${PICKUP_STATUS_COLORS[s]}` : '2px solid transparent' }}>
            <div className="text-lg font-bold" style={{ color: PICKUP_STATUS_COLORS[s] }}>
              {pickups.filter((p) => p.pickup_status === s).length}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{PICKUP_STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="px-4 py-2 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{filteredPickups.length} enlevement(s)</span>
        </div>
        {filteredPickups.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Aucune demande d'enlevement</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
            {filteredPickups.map((p) => {
              const ps = p.pickup_status || 'PENDING'
              return (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: PICKUP_STATUS_COLORS[ps] }}>{PICKUP_STATUS_LABELS[ps]}</span>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEditBooking(p)}>
                    <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.supplier_name || 'Sans nom'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.pickup_address || 'Adresse non renseignee'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs" style={{ color: 'var(--text-primary)' }}>Enl: <strong>{p.pickup_date || '?'}</strong></div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Recep: {p.booking_date}</div>
                  </div>
                  <div className="text-center flex-shrink-0" style={{ minWidth: '50px' }}>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{p.pallet_count} pal.</div>
                    <div className="text-[10px]" style={{ color: DOCK_TYPE_COLORS[p.dock_type] }}>{DOCK_TYPE_LABELS[p.dock_type]}</div>
                  </div>
                  <div className="text-center flex-shrink-0" style={{ minWidth: '100px' }}>
                    {p.carrier_name ? (
                      <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                        {p.carrier_name}
                        {p.carrier_price != null && <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>{p.carrier_price}EUR</span>}
                      </div>
                    ) : p.is_internal_fleet ? (
                      <div className="text-xs" style={{ color: '#3b82f6' }}>Flotte interne</div>
                    ) : (
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>—</div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {ps === 'PENDING' && (
                      <button onClick={(e) => { e.stopPropagation(); openAssignDialog(p) }}
                        className="px-2 py-1 rounded text-[10px] font-medium text-white" style={{ backgroundColor: '#f97316' }}>Assigner</button>
                    )}
                    {ps !== 'PENDING' && ps !== 'DELIVERED' && ps !== 'CANCELLED' && (
                      <button onClick={(e) => { e.stopPropagation(); openAssignDialog(p) }}
                        className="px-2 py-1 rounded text-[10px]" style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>Modifier</button>
                    )}
                    {nextStatus[ps] && (
                      <button onClick={(e) => { e.stopPropagation(); handlePickupStatus(p.id, nextStatus[ps]) }}
                        className="px-2 py-1 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: PICKUP_STATUS_COLORS[nextStatus[ps]] }}>{PICKUP_STATUS_LABELS[nextStatus[ps]]}</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dialog assignation */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowAssignDialog(false)}>
          <div className="w-full max-w-md rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Assignation transporteur</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={assignInternal} onChange={(e) => { setAssignInternal(e.target.checked); if (e.target.checked) setAssignCarrierId('') }} />
                Flotte interne
              </label>
              {!assignInternal && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Transporteur</label>
                  <select value={assignCarrierId} onChange={(e) => setAssignCarrierId(Number(e.target.value) || '')} className={inputCls} style={inputStyle}>
                    <option value="">-- Choisir --</option>
                    {carriers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Prix (EUR)</label>
                  <input type="number" step="0.01" min={0} value={assignPrice} onChange={(e) => setAssignPrice(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ref transport</label>
                  <input type="text" value={assignRef} onChange={(e) => setAssignRef(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea rows={2} value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowAssignDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
              <button onClick={handleAssignPickup} disabled={saving || (!assignInternal && !assignCarrierId)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                {saving ? 'Enregistrement...' : 'Assigner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
