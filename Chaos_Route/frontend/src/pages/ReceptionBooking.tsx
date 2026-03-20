/* Page booking reception V2 / Supplier reception booking V2
   Planning visuel par type de quai, creneaux 15min, config, reservations, import */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { useAuthStore } from '../stores/useAuthStore'

interface Base { id: number; code: string; name: string }

interface DockSchedule {
  id: number; dock_config_id: number; day_of_week: number
  open_time: string; close_time: string
}

interface DockConfig {
  id: number; base_id: number; dock_type: string; dock_count: number
  pallets_per_hour: number; setup_minutes: number; departure_minutes: number
  schedules: DockSchedule[]; base_name?: string
}

interface BookingOrder {
  id: number; booking_id: number; order_number: string
  pallet_count?: number; supplier_name?: string; reconciled: boolean
  delivery_date_required?: string; delivery_time_requested?: string
}

interface BookingCheckin {
  id: number; booking_id: number; license_plate: string
  phone_number: string; driver_name?: string; checkin_time: string
}

interface BookingRefusal {
  id: number; booking_id: number; reason: string
  refused_by_user_id: number; timestamp: string
}

interface Booking {
  id: number; base_id: number; dock_type: string; dock_number?: number
  booking_date: string; start_time: string; end_time: string
  pallet_count: number; estimated_duration_minutes: number
  status: string; is_locked: boolean; supplier_name?: string
  temperature_type?: string; notes?: string
  orders: BookingOrder[]; checkin?: BookingCheckin; refusal?: BookingRefusal
}

interface SlotAvailability {
  start_time: string; end_time: string; dock_type: string
  available_docks: number[]; total_docks: number
}

const DOCK_TYPE_LABELS: Record<string, string> = {
  SEC: 'Sec', FRAIS: 'Frais', GEL: 'Gel', FFL: 'FFL',
}
const DOCK_TYPE_COLORS: Record<string, string> = {
  SEC: '#a3a3a3', FRAIS: '#3b82f6', GEL: '#8b5cf6', FFL: '#22c55e',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', CONFIRMED: 'Confirme', CHECKED_IN: 'Arrive',
  AT_DOCK: 'A quai', COMPLETED: 'Termine', CANCELLED: 'Annule',
  REFUSED: 'Refuse', NO_SHOW: 'Absent',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#737373', CONFIRMED: '#f97316', CHECKED_IN: '#3b82f6',
  AT_DOCK: '#f59e0b', COMPLETED: '#22c55e', CANCELLED: '#6b7280',
  REFUSED: '#ef4444', NO_SHOW: '#ef4444',
}
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function timeToMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minutesToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

export default function ReceptionBooking() {
  const user = useAuthStore((s) => s.user)
  const [bases, setBases] = useState<Base[]>([])
  const [configs, setConfigs] = useState<DockConfig[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedBaseId, setSelectedBaseId] = useState<number | ''>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedDockType, setSelectedDockType] = useState<string>('')

  // Dialogs
  const [tab, setTab] = useState<'planning' | 'config' | 'import'>('planning')
  const [showBookDialog, setShowBookDialog] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // New booking form
  const [bkDockType, setBkDockType] = useState('')
  const [bkStartTime, setBkStartTime] = useState('')
  const [bkPallets, setBkPallets] = useState('')
  const [bkSupplier, setBkSupplier] = useState('')
  const [bkOrderNum, setBkOrderNum] = useState('')
  const [bkLocked, setBkLocked] = useState(false)
  const [bkDockNum, setBkDockNum] = useState('')
  const [bkNotes, setBkNotes] = useState('')

  // Config form
  const [cfgDockType, setCfgDockType] = useState('SEC')
  const [cfgDockCount, setCfgDockCount] = useState('2')
  const [cfgPalletsH, setCfgPalletsH] = useState('30')
  const [cfgSetup, setCfgSetup] = useState('10')
  const [cfgDepart, setCfgDepart] = useState('8')
  const [cfgSchedules, setCfgSchedules] = useState<{ day: number; open: string; close: string }[]>([])
  const [editConfigId, setEditConfigId] = useState<number | null>(null)

  // Import
  const [importResult, setImportResult] = useState<{ imported: number; reconciled: number; errors: string[] } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [baseRes, configRes, bookingRes] = await Promise.all([
        api.get('/bases/'),
        api.get('/reception-booking/dock-configs/', { params: { base_id: selectedBaseId || undefined } }),
        api.get('/reception-booking/bookings/', {
          params: { base_id: selectedBaseId || undefined, date: selectedDate },
        }),
      ])
      setBases(baseRes.data)
      setConfigs(configRes.data)
      setBookings(bookingRes.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedBaseId, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  // Configs pour la base selectionnee / Configs for selected base
  const baseConfigs = useMemo(() =>
    configs.filter((c) => !selectedBaseId || c.base_id === Number(selectedBaseId)),
    [configs, selectedBaseId]
  )

  const dockTypes = useMemo(() =>
    [...new Set(baseConfigs.map((c) => c.dock_type))],
    [baseConfigs]
  )

  // Day of week pour la date selectionnee / Day of week for selected date
  const selectedDow = useMemo(() => {
    const d = new Date(selectedDate)
    return (d.getDay() + 6) % 7  // 0=Monday
  }, [selectedDate])

  // ─── Planning grid data ───
  const planningData = useMemo(() => {
    const result: {
      dockType: string; dockTypeColor: string; dockCount: number
      openTime: string; closeTime: string
      slots: { time: string; docks: (Booking | null)[] }[]
    }[] = []

    const typesToShow = selectedDockType ? [selectedDockType] : dockTypes

    for (const dt of typesToShow) {
      const cfg = baseConfigs.find((c) => c.dock_type === dt)
      if (!cfg) continue

      const schedule = cfg.schedules.find((s) => s.day_of_week === selectedDow)
      if (!schedule) continue

      const opening = timeToMinutes(schedule.open_time)
      const closing = timeToMinutes(schedule.close_time)
      const typeBookings = bookings.filter((b) =>
        b.dock_type === dt && !['CANCELLED', 'REFUSED'].includes(b.status)
      )

      const slots: { time: string; docks: (Booking | null)[] }[] = []
      let current = opening
      while (current + 15 <= closing) {
        const time = minutesToTime(current)
        const docks: (Booking | null)[] = []
        for (let d = 1; d <= cfg.dock_count; d++) {
          const booking = typeBookings.find((b) => {
            if (b.dock_number !== d) return false
            const bStart = timeToMinutes(b.start_time)
            const bEnd = timeToMinutes(b.end_time)
            return bStart <= current && bEnd > current
          })
          docks.push(booking || null)
        }
        slots.push({ time, docks })
        current += 15
      }

      result.push({
        dockType: dt, dockTypeColor: DOCK_TYPE_COLORS[dt] || '#737373',
        dockCount: cfg.dock_count, openTime: schedule.open_time,
        closeTime: schedule.close_time, slots,
      })
    }
    return result
  }, [baseConfigs, bookings, dockTypes, selectedDockType, selectedDow])

  // ─── Handlers ───
  const handleCreateBooking = async () => {
    if (!selectedBaseId || !bkDockType || !bkStartTime || !bkPallets) return
    setSaving(true)
    try {
      await api.post('/reception-booking/bookings/', {
        base_id: Number(selectedBaseId),
        dock_type: bkDockType,
        booking_date: selectedDate,
        start_time: bkStartTime,
        pallet_count: Number(bkPallets),
        dock_number: bkDockNum ? Number(bkDockNum) : null,
        supplier_name: bkSupplier || null,
        is_locked: bkLocked,
        notes: bkNotes || null,
        orders: bkOrderNum ? [{ order_number: bkOrderNum }] : [],
      })
      setShowBookDialog(false)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally { setSaving(false) }
  }

  const handleBookingAction = async (bookingId: number, action: string) => {
    try {
      if (action === 'at-dock') {
        const dock = prompt('Numero de quai :')
        if (!dock) return
        await api.post(`/reception-booking/bookings/${bookingId}/at-dock`, { dock_number: Number(dock) })
      } else if (action === 'departed') {
        await api.post(`/reception-booking/bookings/${bookingId}/departed`)
      } else if (action === 'refuse') {
        const reason = prompt('Motif du refus (obligatoire) :')
        if (!reason) return
        await api.post(`/reception-booking/bookings/${bookingId}/refuse`, { reason })
      } else if (action === 'cancel') {
        await api.put(`/reception-booking/bookings/${bookingId}`, { status: 'CANCELLED' })
      }
      fetchData()
    } catch { alert('Erreur') }
  }

  const handleSaveConfig = async () => {
    if (!selectedBaseId) return
    setSaving(true)
    try {
      const payload = {
        base_id: Number(selectedBaseId),
        dock_type: cfgDockType,
        dock_count: Number(cfgDockCount),
        pallets_per_hour: Number(cfgPalletsH),
        setup_minutes: Number(cfgSetup),
        departure_minutes: Number(cfgDepart),
        schedules: cfgSchedules.map((s) => ({
          day_of_week: s.day, open_time: s.open, close_time: s.close,
        })),
      }
      if (editConfigId) {
        await api.put(`/reception-booking/dock-configs/${editConfigId}`, payload)
      } else {
        await api.post('/reception-booking/dock-configs/', payload)
      }
      setShowConfigDialog(false)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally { setSaving(false) }
  }

  const handleImport = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await api.post('/reception-booking/import-orders/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }

  const openNewConfig = (dockType?: string) => {
    const existing = dockType ? baseConfigs.find((c) => c.dock_type === dockType) : null
    if (existing) {
      setEditConfigId(existing.id)
      setCfgDockType(existing.dock_type)
      setCfgDockCount(String(existing.dock_count))
      setCfgPalletsH(String(existing.pallets_per_hour))
      setCfgSetup(String(existing.setup_minutes))
      setCfgDepart(String(existing.departure_minutes))
      setCfgSchedules(existing.schedules.map((s) => ({ day: s.day_of_week, open: s.open_time, close: s.close_time })))
    } else {
      setEditConfigId(null)
      setCfgDockType(dockType || 'SEC')
      setCfgDockCount('2'); setCfgPalletsH('30'); setCfgSetup('10'); setCfgDepart('8')
      setCfgSchedules([0, 1, 2, 3, 4].map((d) => ({ day: d, open: '06:00', close: '14:00' })))
    }
    setShowConfigDialog(true)
  }

  const openNewBooking = (dockType?: string, startTime?: string, dockNum?: number) => {
    setBkDockType(dockType || dockTypes[0] || 'SEC')
    setBkStartTime(startTime || '')
    setBkPallets(''); setBkSupplier(''); setBkOrderNum('')
    setBkLocked(false); setBkNotes('')
    setBkDockNum(dockNum ? String(dockNum) : '')
    setShowBookDialog(true)
  }

  // ─── Render helpers ───
  const renderBookingBlock = (booking: Booking, slotTime: string) => {
    // Afficher seulement sur le premier creneau du booking / Only show on first slot
    if (booking.start_time !== slotTime) return (
      <div className="h-full rounded" style={{ backgroundColor: `${STATUS_COLORS[booking.status]}15` }} />
    )

    const slotsSpan = Math.ceil(booking.estimated_duration_minutes / 15)
    const color = STATUS_COLORS[booking.status] || '#737373'

    return (
      <div
        className="rounded px-1.5 py-1 text-xs cursor-pointer overflow-hidden"
        style={{
          backgroundColor: `${color}20`,
          borderLeft: `3px solid ${color}`,
          minHeight: `${slotsSpan * 28}px`,
          position: 'relative',
        }}
        title={`${booking.supplier_name || '?'} — ${booking.pallet_count} pal. — ${booking.start_time}-${booking.end_time}`}
      >
        <div className="font-bold truncate" style={{ color }}>{booking.supplier_name || 'Sans nom'}</div>
        <div className="truncate" style={{ color: 'var(--text-primary)' }}>
          {booking.orders.map((o) => o.order_number).join(', ') || '—'} · {booking.pallet_count} pal.
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {booking.start_time}-{booking.end_time} · {STATUS_LABELS[booking.status]}
          {booking.is_locked && ' · Verrouille'}
        </div>
        {booking.checkin && (
          <div className="text-[10px] mt-0.5" style={{ color: '#3b82f6' }}>
            Arrive {booking.checkin.checkin_time.slice(11, 16)} · {booking.checkin.license_plate}
          </div>
        )}
        {/* Actions rapides / Quick actions */}
        <div className="flex gap-1 mt-1 flex-wrap">
          {booking.status === 'CHECKED_IN' && (
            <button onClick={(e) => { e.stopPropagation(); handleBookingAction(booking.id, 'at-dock') }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: '#f59e0b' }}>
              A quai
            </button>
          )}
          {booking.status === 'AT_DOCK' && (
            <button onClick={(e) => { e.stopPropagation(); handleBookingAction(booking.id, 'departed') }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: '#22c55e' }}>
              Parti
            </button>
          )}
          {['DRAFT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status) && (
            <button onClick={(e) => { e.stopPropagation(); handleBookingAction(booking.id, 'refuse') }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: '#ef4444' }}>
              Refuser
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Booking reception
        </h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('planning')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'planning' ? 'text-white' : ''}`}
            style={{ backgroundColor: tab === 'planning' ? 'var(--color-primary)' : 'var(--bg-tertiary)', color: tab === 'planning' ? 'white' : 'var(--text-primary)' }}>
            Planning
          </button>
          <button onClick={() => setTab('config')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium`}
            style={{ backgroundColor: tab === 'config' ? 'var(--color-primary)' : 'var(--bg-tertiary)', color: tab === 'config' ? 'white' : 'var(--text-primary)' }}>
            Configuration
          </button>
          <button onClick={() => setTab('import')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium`}
            style={{ backgroundColor: tab === 'import' ? 'var(--color-primary)' : 'var(--bg-tertiary)', color: tab === 'import' ? 'white' : 'var(--text-primary)' }}>
            Import
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 items-center flex-wrap">
        <select value={selectedBaseId} onChange={(e) => setSelectedBaseId(Number(e.target.value) || '')}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          <option value="">Toutes les bases</option>
          {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        {tab === 'planning' && dockTypes.length > 1 && (
          <select value={selectedDockType} onChange={(e) => setSelectedDockType(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">Tous les types</option>
            {dockTypes.map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt] || dt}</option>)}
          </select>
        )}
        {tab === 'planning' && selectedBaseId && (
          <button onClick={() => openNewBooking()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            + Booking
          </button>
        )}
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {DAY_LABELS[selectedDow]}
        </span>
      </div>

      {/* ─── TAB: PLANNING ─── */}
      {tab === 'planning' && (
        <>
          {loading && <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>}

          {!loading && planningData.length === 0 && selectedBaseId && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              Aucune configuration de quai pour cette base ce jour.
              <button onClick={() => setTab('config')} className="ml-2 underline" style={{ color: 'var(--color-primary)' }}>
                Configurer
              </button>
            </div>
          )}

          {planningData.map((pd) => (
            <div key={pd.dockType} className="rounded-lg border p-3"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pd.dockTypeColor }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {DOCK_TYPE_LABELS[pd.dockType] || pd.dockType}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {pd.dockCount} quai(s) · {pd.openTime}-{pd.closeTime}
                </span>
              </div>

              <div className="overflow-x-auto">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `60px repeat(${pd.dockCount}, minmax(140px, 1fr))`,
                  gap: '1px',
                }}>
                  {/* Header quais */}
                  <div className="text-[10px] font-medium px-1 py-1" style={{ color: 'var(--text-muted)' }}>Heure</div>
                  {Array.from({ length: pd.dockCount }, (_, i) => (
                    <div key={i} className="text-[10px] font-medium px-1 py-1 text-center" style={{ color: 'var(--text-muted)' }}>
                      Quai {i + 1}
                    </div>
                  ))}

                  {/* Slots */}
                  {pd.slots.map((slot) => (
                    <>
                      <div key={`t-${slot.time}`} className="text-[10px] px-1 py-0.5 border-t"
                        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)', height: '28px', lineHeight: '24px' }}>
                        {slot.time}
                      </div>
                      {slot.docks.map((booking, dockIdx) => (
                        <div
                          key={`d-${slot.time}-${dockIdx}`}
                          className="border-t px-0.5"
                          style={{
                            borderColor: 'var(--border-color)',
                            backgroundColor: booking ? 'transparent' : 'var(--bg-primary)',
                            height: '28px',
                            cursor: booking ? 'default' : 'pointer',
                          }}
                          onClick={() => !booking && openNewBooking(pd.dockType, slot.time, dockIdx + 1)}
                        >
                          {booking ? renderBookingBlock(booking, slot.time) : null}
                        </div>
                      ))}
                    </>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Liste bookings du jour */}
          {bookings.length > 0 && (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Fournisseur</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Commande(s)</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Palettes</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Creneau</th>
                    <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Quai</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
                    <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.supplier_name || '—'}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                        {b.orders.map((o) => o.order_number).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${DOCK_TYPE_COLORS[b.dock_type]}20`, color: DOCK_TYPE_COLORS[b.dock_type] }}>
                          {DOCK_TYPE_LABELS[b.dock_type] || b.dock_type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: 'var(--text-primary)' }}>{b.pallet_count}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{b.start_time}-{b.end_time}</td>
                      <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{b.dock_number || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${STATUS_COLORS[b.status]}20`, color: STATUS_COLORS[b.status] }}>
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                        {b.is_locked && <span className="ml-1 text-[10px]" style={{ color: '#f59e0b' }}>Verrouille</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {b.status === 'CHECKED_IN' && (
                            <button onClick={() => handleBookingAction(b.id, 'at-dock')}
                              className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: '#f59e0b' }}>A quai</button>
                          )}
                          {b.status === 'AT_DOCK' && (
                            <button onClick={() => handleBookingAction(b.id, 'departed')}
                              className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: '#22c55e' }}>Parti</button>
                          )}
                          {!['COMPLETED', 'CANCELLED', 'REFUSED'].includes(b.status) && (
                            <>
                              <button onClick={() => handleBookingAction(b.id, 'refuse')}
                                className="px-2 py-1 rounded text-xs" style={{ color: '#ef4444', backgroundColor: '#ef444420' }}>Refuser</button>
                              <button onClick={() => handleBookingAction(b.id, 'cancel')}
                                className="px-2 py-1 rounded text-xs" style={{ color: '#6b7280', backgroundColor: '#6b728020' }}>Annuler</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── TAB: CONFIG ─── */}
      {tab === 'config' && (
        <div className="space-y-4">
          {!selectedBaseId ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Selectionnez une base pour configurer les quais.</div>
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Types de quais configures :</span>
                {['SEC', 'FRAIS', 'GEL', 'FFL'].map((dt) => {
                  const exists = baseConfigs.find((c) => c.dock_type === dt)
                  return (
                    <button key={dt} onClick={() => openNewConfig(dt)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                      style={{
                        borderColor: exists ? DOCK_TYPE_COLORS[dt] : 'var(--border-color)',
                        color: exists ? DOCK_TYPE_COLORS[dt] : 'var(--text-muted)',
                        backgroundColor: exists ? `${DOCK_TYPE_COLORS[dt]}15` : 'transparent',
                      }}>
                      {DOCK_TYPE_LABELS[dt]} {exists ? `(${exists.dock_count})` : '+'}
                    </button>
                  )
                })}
              </div>

              {baseConfigs.map((cfg) => (
                <div key={cfg.id} className="rounded-lg border p-4"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DOCK_TYPE_COLORS[cfg.dock_type] }} />
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {DOCK_TYPE_LABELS[cfg.dock_type]} — {cfg.dock_count} quai(s)
                      </span>
                    </div>
                    <button onClick={() => openNewConfig(cfg.dock_type)}
                      className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)' }}>Modifier</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Productivite:</span> {cfg.pallets_per_hour} pal/h</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Mise a quai:</span> {cfg.setup_minutes} min</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Depart:</span> {cfg.departure_minutes} min</div>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {cfg.schedules.sort((a, b) => a.day_of_week - b.day_of_week).map((s) => (
                      <span key={s.day_of_week} className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                        {DAY_LABELS[s.day_of_week]} {s.open_time}-{s.close_time}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ─── TAB: IMPORT ─── */}
      {tab === 'import' && (
        <div className="space-y-4">
          <div className="rounded-lg border p-6 text-center"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              Import du carnet de commandes (fichier XLS, sheet "Lst Rd Ouvert Detail")
            </p>
            <input type="file" accept=".xls,.xlsx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f) }}
              className="text-sm" style={{ color: 'var(--text-primary)' }} />
          </div>
          {importResult && (
            <div className="rounded-lg border p-4"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Resultat import</h3>
              <div className="text-sm space-y-1" style={{ color: 'var(--text-primary)' }}>
                <div>Commandes importees : <strong>{importResult.imported}</strong></div>
                <div>Reconciliees avec bookings : <strong>{importResult.reconciled}</strong></div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium" style={{ color: '#ef4444' }}>Erreurs :</div>
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-xs" style={{ color: '#ef4444' }}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── DIALOG: New Booking ─── */}
      {showBookDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowBookDialog(false)}>
          <div className="w-full max-w-md rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Nouveau booking</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type quai</label>
                  <select value={bkDockType} onChange={(e) => setBkDockType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                    {dockTypes.map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Heure debut</label>
                  <input type="time" step={900} value={bkStartTime} onChange={(e) => setBkStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nb palettes</label>
                  <input type="number" min={1} value={bkPallets} onChange={(e) => setBkPallets(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Quai (optionnel)</label>
                  <input type="number" min={1} value={bkDockNum} onChange={(e) => setBkDockNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fournisseur</label>
                <input type="text" value={bkSupplier} onChange={(e) => setBkSupplier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>N° commande (Rd)</label>
                <input type="text" value={bkOrderNum} onChange={(e) => setBkOrderNum(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={bkLocked} onChange={(e) => setBkLocked(e.target.checked)} />
                Non deplacable (risque rupture)
              </label>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea rows={2} value={bkNotes} onChange={(e) => setBkNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowBookDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
              <button onClick={handleCreateBooking}
                disabled={saving || !bkDockType || !bkStartTime || !bkPallets}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                {saving ? 'Creation...' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIALOG: Config ─── */}
      {showConfigDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowConfigDialog(false)}>
          <div className="w-full max-w-lg rounded-xl border shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editConfigId ? 'Modifier' : 'Ajouter'} configuration quai
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type de quai</label>
                <select value={cfgDockType} onChange={(e) => setCfgDockType(e.target.value)}
                  disabled={!!editConfigId}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  {['SEC', 'FRAIS', 'GEL', 'FFL'].map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nb quais</label>
                  <input type="number" min={1} value={cfgDockCount} onChange={(e) => setCfgDockCount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Palettes/heure</label>
                  <input type="number" min={1} value={cfgPalletsH} onChange={(e) => setCfgPalletsH(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Mise a quai (min)</label>
                  <input type="number" min={0} value={cfgSetup} onChange={(e) => setCfgSetup(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Depart (min)</label>
                  <input type="number" min={0} value={cfgDepart} onChange={(e) => setCfgDepart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* Horaires par jour */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Horaires d'ouverture</label>
                {cfgSchedules.map((s, i) => (
                  <div key={s.day} className="flex items-center gap-2 mb-1">
                    <span className="text-xs w-8" style={{ color: 'var(--text-primary)' }}>{DAY_LABELS[s.day]}</span>
                    <input type="time" value={s.open}
                      onChange={(e) => { const arr = [...cfgSchedules]; arr[i] = { ...s, open: e.target.value }; setCfgSchedules(arr) }}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>
                    <input type="time" value={s.close}
                      onChange={(e) => { const arr = [...cfgSchedules]; arr[i] = { ...s, close: e.target.value }; setCfgSchedules(arr) }}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <button onClick={() => setCfgSchedules(cfgSchedules.filter((_, j) => j !== i))}
                      className="text-xs" style={{ color: '#ef4444' }}>x</button>
                  </div>
                ))}
                <button onClick={() => {
                  const usedDays = new Set(cfgSchedules.map((s) => s.day))
                  const nextDay = [0, 1, 2, 3, 4, 5, 6].find((d) => !usedDays.has(d))
                  if (nextDay !== undefined) setCfgSchedules([...cfgSchedules, { day: nextDay, open: '06:00', close: '14:00' }])
                }}
                  className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>+ Ajouter un jour</button>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowConfigDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
              <button onClick={handleSaveConfig} disabled={saving}
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
