/* Page booking reception fournisseur / Supplier reception booking page
   Vue planning quais + commandes + reservations */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useAuthStore } from '../stores/useAuthStore'

interface Base { id: number; code: string; name: string }

interface ReceptionConfig {
  id: number; base_id: number; opening_time: string; closing_time: string
  dock_count: number; slot_duration_minutes: number; productivity_eqp_per_slot: number
  base_name?: string
}

interface PurchaseOrder {
  id: number; base_id: number; supplier_id: number; order_ref: string
  eqp_count: number; expected_delivery_date: string; status: string
  notes?: string; supplier_name?: string; base_name?: string
}

interface Booking {
  id: number; purchase_order_id: number; base_id: number; supplier_id: number
  booking_date: string; start_time: string; end_time: string; dock_number: number
  slots_needed: number; status: string; supplier_name?: string; order_ref?: string
  eqp_count?: number; notes?: string
}

interface SlotAvailability {
  start_time: string; end_time: string; available_docks: number[]
}

const BOOKING_STATUS_LABELS: Record<string, string> = {
  BOOKED: 'Reserve', ARRIVED: 'Arrive', UNLOADING: 'Dechargement',
  COMPLETED: 'Termine', CANCELLED: 'Annule', NO_SHOW: 'Absent',
}
const BOOKING_STATUS_COLORS: Record<string, string> = {
  BOOKED: 'var(--color-primary)', ARRIVED: '#3b82f6', UNLOADING: '#f59e0b',
  COMPLETED: '#22c55e', CANCELLED: '#6b7280', NO_SHOW: 'var(--color-danger)',
}

export default function ReceptionBooking() {
  const user = useAuthStore((s) => s.user)
  const isSupplier = !!user?.supplier_id

  const [bases, setBases] = useState<Base[]>([])
  const [configs, setConfigs] = useState<ReceptionConfig[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots, setSlots] = useState<SlotAvailability[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedBaseId, setSelectedBaseId] = useState<number | ''>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))

  // Booking dialog
  const [showBookDialog, setShowBookDialog] = useState(false)
  const [bookOrderId, setBookOrderId] = useState<number | ''>('')
  const [bookSlotTime, setBookSlotTime] = useState('')
  const [bookDock, setBookDock] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)

  // Config dialog
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [editConfig, setEditConfig] = useState<ReceptionConfig | null>(null)
  const [cfgOpening, setCfgOpening] = useState('06:00')
  const [cfgClosing, setCfgClosing] = useState('14:00')
  const [cfgDocks, setCfgDocks] = useState('2')
  const [cfgSlotMin, setCfgSlotMin] = useState('30')
  const [cfgProductivity, setCfgProductivity] = useState('2')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [baseRes, configRes, orderRes, bookingRes] = await Promise.all([
        api.get('/bases/'),
        api.get('/reception-booking/configs/'),
        api.get('/reception-booking/orders/', { params: { status: isSupplier ? undefined : 'PENDING' } }),
        api.get('/reception-booking/bookings/', {
          params: {
            base_id: selectedBaseId || undefined,
            date: selectedDate,
          },
        }),
      ])
      setBases(baseRes.data)
      setConfigs(configRes.data)
      setOrders(orderRes.data)
      setBookings(bookingRes.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedBaseId, selectedDate, isSupplier])

  useEffect(() => { fetchData() }, [fetchData])

  // Charger les creneaux quand base + date changent
  useEffect(() => {
    if (!selectedBaseId || !selectedDate) { setSlots([]); return }
    api.get('/reception-booking/availability/', { params: { base_id: selectedBaseId, date: selectedDate } })
      .then((r) => setSlots(r.data))
      .catch(() => setSlots([]))
  }, [selectedBaseId, selectedDate, bookings])

  const currentConfig = configs.find((c) => c.base_id === Number(selectedBaseId))

  const openBookDialog = (orderId?: number) => {
    setBookOrderId(orderId || '')
    setBookSlotTime('')
    setBookDock('')
    setShowBookDialog(true)
  }

  const handleBook = async () => {
    if (!bookOrderId || !bookSlotTime || !bookDock || !selectedBaseId) return
    setSaving(true)
    try {
      await api.post('/reception-booking/bookings/', {
        purchase_order_id: Number(bookOrderId),
        base_id: Number(selectedBaseId),
        booking_date: selectedDate,
        start_time: bookSlotTime,
        dock_number: Number(bookDock),
      })
      setShowBookDialog(false)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally { setSaving(false) }
  }

  const handleBookingStatus = async (id: number, status: string) => {
    try {
      await api.put(`/reception-booking/bookings/${id}`, { status })
      fetchData()
    } catch { alert('Erreur') }
  }

  const openConfigDialog = () => {
    if (currentConfig) {
      setEditConfig(currentConfig)
      setCfgOpening(currentConfig.opening_time)
      setCfgClosing(currentConfig.closing_time)
      setCfgDocks(String(currentConfig.dock_count))
      setCfgSlotMin(String(currentConfig.slot_duration_minutes))
      setCfgProductivity(String(currentConfig.productivity_eqp_per_slot))
    } else {
      setEditConfig(null)
      setCfgOpening('06:00'); setCfgClosing('14:00')
      setCfgDocks('2'); setCfgSlotMin('30'); setCfgProductivity('2')
    }
    setShowConfigDialog(true)
  }

  const handleConfigSave = async () => {
    if (!selectedBaseId) return
    setSaving(true)
    try {
      const payload = {
        base_id: Number(selectedBaseId),
        opening_time: cfgOpening, closing_time: cfgClosing,
        dock_count: Number(cfgDocks), slot_duration_minutes: Number(cfgSlotMin),
        productivity_eqp_per_slot: Number(cfgProductivity),
      }
      if (editConfig) {
        await api.put(`/reception-booking/configs/${editConfig.id}`, payload)
      } else {
        await api.post('/reception-booking/configs/', payload)
      }
      setShowConfigDialog(false)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally { setSaving(false) }
  }

  const pendingOrders = orders.filter((o) => o.status === 'PENDING' && (!selectedBaseId || o.base_id === Number(selectedBaseId)))

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {isSupplier ? 'Mes reservations reception' : 'Booking reception fournisseurs'}
        </h1>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={selectedBaseId}
          onChange={(e) => setSelectedBaseId(Number(e.target.value) || '')}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        >
          <option value="">Toutes les bases</option>
          {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        />
        {!isSupplier && selectedBaseId && (
          <button
            onClick={openConfigDialog}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            {currentConfig ? 'Config base' : '+ Config base'}
          </button>
        )}
      </div>

      {/* Commandes en attente */}
      {pendingOrders.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Commandes en attente de booking ({pendingOrders.length})
          </h2>
          <div className="space-y-1">
            {pendingOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm py-1">
                <div style={{ color: 'var(--text-primary)' }}>
                  <span className="font-medium">{o.order_ref}</span>
                  {' — '}{o.supplier_name} — {o.eqp_count} eq. — livr. {o.expected_delivery_date}
                  {o.base_name && <span style={{ color: 'var(--text-muted)' }}> ({o.base_name})</span>}
                </div>
                <button
                  onClick={() => openBookDialog(o.id)}
                  className="px-3 py-1 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  disabled={!selectedBaseId}
                >
                  Reserver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Planning quais */}
      {selectedBaseId && currentConfig && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Planning quais — {selectedDate} — {currentConfig.dock_count} quai(s) — {currentConfig.opening_time}-{currentConfig.closing_time}
          </h2>
          <div className="overflow-x-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${currentConfig.dock_count}, 1fr)`, gap: '2px' }}>
              {/* Header */}
              <div className="text-xs font-medium px-2 py-1" style={{ color: 'var(--text-muted)' }}>Heure</div>
              {Array.from({ length: currentConfig.dock_count }, (_, i) => (
                <div key={i} className="text-xs font-medium px-2 py-1 text-center" style={{ color: 'var(--text-muted)' }}>
                  Quai {i + 1}
                </div>
              ))}
              {/* Slots */}
              {slots.map((slot) => (
                <>
                  <div key={`t-${slot.start_time}`} className="text-xs px-2 py-2" style={{ color: 'var(--text-primary)' }}>
                    {slot.start_time}
                  </div>
                  {Array.from({ length: currentConfig.dock_count }, (_, dockIdx) => {
                    const dockNum = dockIdx + 1
                    const booking = bookings.find(
                      (b) => b.start_time <= slot.start_time && b.end_time > slot.start_time && b.dock_number === dockNum
                    )
                    const isAvailable = slot.available_docks.includes(dockNum)

                    if (booking) {
                      return (
                        <div
                          key={`d-${slot.start_time}-${dockNum}`}
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: `${BOOKING_STATUS_COLORS[booking.status]}20`, color: BOOKING_STATUS_COLORS[booking.status] }}
                          title={`${booking.supplier_name} — ${booking.order_ref} — ${booking.eqp_count} eq.`}
                        >
                          <div className="font-medium truncate">{booking.supplier_name}</div>
                          <div className="truncate">{booking.order_ref} ({booking.eqp_count} eq.)</div>
                          {!isSupplier && booking.status === 'BOOKED' && (
                            <div className="flex gap-1 mt-1">
                              <button
                                onClick={() => handleBookingStatus(booking.id, 'ARRIVED')}
                                className="px-1 rounded text-[10px]"
                                style={{ backgroundColor: '#3b82f620', color: '#3b82f6' }}
                              >Arrive</button>
                            </div>
                          )}
                          {!isSupplier && booking.status === 'ARRIVED' && (
                            <button
                              onClick={() => handleBookingStatus(booking.id, 'COMPLETED')}
                              className="px-1 rounded text-[10px] mt-1"
                              style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}
                            >Termine</button>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div
                        key={`d-${slot.start_time}-${dockNum}`}
                        className="text-xs px-2 py-2 rounded text-center"
                        style={{
                          backgroundColor: isAvailable ? 'var(--bg-tertiary)' : 'rgba(239,68,68,0.05)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {isAvailable ? '—' : 'occupe'}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Liste bookings du jour */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Fournisseur</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Ref. cde</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>EQP</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Creneau</th>
              <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Quai</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
              {!isSupplier && <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune reservation ce jour</td></tr>
            ) : bookings.map((b) => (
              <tr key={b.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.supplier_name}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.order_ref}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--text-primary)' }}>{b.eqp_count}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.start_time}-{b.end_time}</td>
                <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{b.dock_number}</td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${BOOKING_STATUS_COLORS[b.status]}20`, color: BOOKING_STATUS_COLORS[b.status] }}>
                    {BOOKING_STATUS_LABELS[b.status] || b.status}
                  </span>
                </td>
                {!isSupplier && (
                  <td className="px-3 py-2 text-right">
                    {b.status === 'BOOKED' && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => handleBookingStatus(b.id, 'ARRIVED')}
                          className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: '#3b82f6' }}>Arrive</button>
                        <button onClick={() => handleBookingStatus(b.id, 'NO_SHOW')}
                          className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: 'var(--color-danger)' }}>Absent</button>
                      </div>
                    )}
                    {b.status === 'ARRIVED' && (
                      <button onClick={() => handleBookingStatus(b.id, 'COMPLETED')}
                        className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: '#22c55e' }}>Termine</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Booking dialog */}
      {showBookDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowBookDialog(false)}>
          <div className="w-full max-w-sm rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Reserver un creneau</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Commande</label>
                <select value={bookOrderId} onChange={(e) => setBookOrderId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="">Selectionner...</option>
                  {pendingOrders.map((o) => (
                    <option key={o.id} value={o.id}>{o.order_ref} — {o.supplier_name} — {o.eqp_count} eq.</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Creneau</label>
                <select value={bookSlotTime} onChange={(e) => setBookSlotTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="">Selectionner...</option>
                  {slots.filter((s) => s.available_docks.length > 0).map((s) => (
                    <option key={s.start_time} value={s.start_time}>{s.start_time}-{s.end_time} ({s.available_docks.length} quai(s) dispo)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Quai</label>
                <select value={bookDock} onChange={(e) => setBookDock(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="">Selectionner...</option>
                  {bookSlotTime && slots.find((s) => s.start_time === bookSlotTime)?.available_docks.map((d) => (
                    <option key={d} value={d}>Quai {d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowBookDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
              <button onClick={handleBook}
                disabled={saving || !bookOrderId || !bookSlotTime || !bookDock}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                {saving ? 'Reservation...' : 'Reserver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config dialog */}
      {showConfigDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowConfigDialog(false)}>
          <div className="w-full max-w-sm rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Configuration reception</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ouverture</label>
                  <input type="time" value={cfgOpening} onChange={(e) => setCfgOpening(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fermeture</label>
                  <input type="time" value={cfgClosing} onChange={(e) => setCfgClosing(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nombre de quais</label>
                <input type="number" min={1} value={cfgDocks} onChange={(e) => setCfgDocks(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Duree creneau (minutes)</label>
                <input type="number" min={10} step={5} value={cfgSlotMin} onChange={(e) => setCfgSlotMin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>EQP par creneau (productivite)</label>
                <input type="number" min={0.5} step={0.5} value={cfgProductivity} onChange={(e) => setCfgProductivity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowConfigDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
              <button onClick={handleConfigSave} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
