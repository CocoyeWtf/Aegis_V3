/* Page booking reception — orchestrateur / Supplier reception booking — orchestrator.
   Importe les sous-composants depuis components/booking/.
   Planning visuel par type de quai, creneaux 15min, config, reservations, import. */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import api from '../services/api'
import { useAuthStore } from '../stores/useAuthStore'

import {
  type Base, type DockConfig, type Booking, type DockScheduleOverride, type SuggestedSlot, type DockColumn,
  DOCK_TYPE_LABELS, DOCK_TYPE_COLORS, STATUS_LABELS, STATUS_COLORS, PICKUP_STATUS_LABELS, PICKUP_STATUS_COLORS,
  DAY_LABELS, timeToMinutes, minutesToTime, formatDateFr,
} from '../components/booking/types'
import { GateView } from '../components/booking/GateView'
import { TransportView } from '../components/booking/TransportView'
import { StatsTab } from '../components/booking/StatsTab'
import { CalendarTab } from '../components/booking/CalendarTab'

// ─── DnD components ───
function DraggableBooking({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}>
      {children}
    </div>
  )
}

function DroppableCell({ id, children, style, onClick }: {
  id: string; children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} style={{ ...style, outline: isOver ? '2px solid var(--color-primary)' : undefined }} onClick={onClick}>
      {children}
    </div>
  )
}

export default function ReceptionBooking() {
  const [searchParams] = useSearchParams()
  const viewParam = searchParams.get('view') as 'appros' | 'gate' | 'reception' | 'transport' | null
  const user = useAuthStore((s) => s.user)
  const [bases, setBases] = useState<Base[]>([])
  const [configs, setConfigs] = useState<DockConfig[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [overrides, setOverrides] = useState<DockScheduleOverride[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedBaseId, setSelectedBaseId] = useState<number | ''>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedDockType, setSelectedDockType] = useState<string>('')

  const hasPerm = useCallback((resource: string, action: string) => {
    if (!user) return false
    if (user.is_superadmin) return true
    return user.permissions.includes(`${resource}:${action}`) || user.permissions.includes('*:*')
  }, [user])

  const isAppros = useMemo(() => hasPerm('booking-appros', 'update'), [hasPerm])
  const isGate = useMemo(() => hasPerm('booking-gate', 'update'), [hasPerm])
  const isReception = useMemo(() => hasPerm('booking-reception', 'update'), [hasPerm])

  const canEdit = useCallback((b: Booking) => {
    if (!user) return false
    if (user.is_superadmin) return true
    if (b.created_by_user_id === user.id && isAppros) return true
    return isAppros
  }, [user, isAppros])

  // Dialogs
  const [tab, setTab] = useState<'planning' | 'config' | 'import' | 'calendar' | 'stats'>('planning')
  const [showBookDialog, setShowBookDialog] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Booking form
  const [editBookingId, setEditBookingId] = useState<number | null>(null)
  const [bkDockType, setBkDockType] = useState('')
  const [bkStartTime, setBkStartTime] = useState('')
  const [bkPallets, setBkPallets] = useState('')
  const [bkSupplier, setBkSupplier] = useState('')
  const [bkOrderNum, setBkOrderNum] = useState('')
  const [bkLocked, setBkLocked] = useState(false)
  const [bkDockNum, setBkDockNum] = useState('')
  const [bkNotes, setBkNotes] = useState('')
  const [bkIsPickup, setBkIsPickup] = useState(false)
  const [bkPickupDate, setBkPickupDate] = useState('')
  const [bkPickupAddress, setBkPickupAddress] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestedSlot[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

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

  // Transport
  const [pickups, setPickups] = useState<Booking[]>([])
  const [carriers, setCarriers] = useState<{ id: number; name: string; code: string }[]>([])

  // Drag & drop
  const [dragBookingId, setDragBookingId] = useState<number | null>(null)

  // Notifications
  const [notifications, setNotifications] = useState<{ id: number; message: string; time: string }[]>([])
  const knownCheckedInIds = useRef<Set<number>>(new Set())
  const notifSound = useRef<HTMLAudioElement | null>(null)

  // Override dialog
  const [showOverrideDialog, setShowOverrideDialog] = useState(false)
  const [editOverrideId, setEditOverrideId] = useState<number | null>(null)
  const [ovDate, setOvDate] = useState('')
  const [ovConfigId, setOvConfigId] = useState<number | ''>('')
  const [ovClosed, setOvClosed] = useState(false)
  const [ovOpenTime, setOvOpenTime] = useState('')
  const [ovCloseTime, setOvCloseTime] = useState('')
  const [ovDockCount, setOvDockCount] = useState('')
  const [ovNotes, setOvNotes] = useState('')

  // Init notification sound
  useEffect(() => {
    const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null
    if (audioCtx) {
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * 880 * i / audioCtx.sampleRate) * Math.exp(-3 * i / data.length)
      }
      notifSound.current = { play: () => {
        const src = audioCtx.createBufferSource()
        src.buffer = buf
        src.connect(audioCtx.destination)
        src.start()
      }} as unknown as HTMLAudioElement
    }
  }, [])

  // ─── Data fetching ───
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [baseRes, configRes, bookingRes] = await Promise.all([
        api.get('/bases/').catch(() => ({ data: [] })),
        api.get('/reception-booking/dock-configs/', { params: { base_id: selectedBaseId || undefined } }).catch(() => ({ data: [] })),
        api.get('/reception-booking/bookings/', { params: { base_id: selectedBaseId || undefined, date: selectedDate } }).catch(() => ({ data: [] })),
      ])
      setBases(baseRes.data)
      setConfigs(configRes.data)
      setBookings(bookingRes.data)
      if (selectedBaseId) {
        try {
          const ovRes = await api.get('/reception-booking/schedule-overrides/', {
            params: { base_id: selectedBaseId, date_from: selectedDate.slice(0, 8) + '01', date_to: selectedDate.slice(0, 8) + '31' },
          })
          setOverrides(ovRes.data)
        } catch { setOverrides([]) }
      } else { setOverrides([]) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedBaseId, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  // Polling
  useEffect(() => {
    if (!isReception && !isGate) return
    if (!selectedBaseId) return
    const poll = async () => {
      try {
        const res = await api.get('/reception-booking/bookings/', { params: { base_id: selectedBaseId, date: selectedDate, status: 'CHECKED_IN' } })
        const freshCheckedIn: Booking[] = res.data
        const newArrivals = freshCheckedIn.filter((b) => !knownCheckedInIds.current.has(b.id))
        if (knownCheckedInIds.current.size > 0 && newArrivals.length > 0) {
          for (const b of newArrivals) {
            const msg = `${b.supplier_name || 'Chauffeur'} arrive — ${b.pallet_count} pal. ${DOCK_TYPE_LABELS[b.dock_type] || b.dock_type}`
            setNotifications((prev) => [{ id: b.id, message: msg, time: new Date().toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) }, ...prev].slice(0, 10))
            try { notifSound.current?.play() } catch { /* silent */ }
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Chauffeur arrive', { body: msg, icon: '/favicon.ico' })
            }
          }
          fetchData()
        }
        knownCheckedInIds.current = new Set(freshCheckedIn.map((b) => b.id))
      } catch { /* silent */ }
    }
    api.get('/reception-booking/bookings/', { params: { base_id: selectedBaseId, date: selectedDate, status: 'CHECKED_IN' } })
      .then((res) => { knownCheckedInIds.current = new Set((res.data as Booking[]).map((b) => b.id)) }).catch(() => {})
    const interval = setInterval(poll, 20000)
    return () => clearInterval(interval)
  }, [isReception, isGate, selectedBaseId, selectedDate, fetchData])

  useEffect(() => {
    if ((isReception || isGate) && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission()
  }, [isReception, isGate])

  // Fetch pickups
  const fetchPickups = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/reception-booking/pickups/', { params: { base_id: selectedBaseId || undefined } }),
        api.get('/carriers/').catch(() => ({ data: [] })),
      ])
      setPickups(pRes.data)
      setCarriers(cRes.data)
    } catch { /* silent */ }
  }, [selectedBaseId])

  useEffect(() => { if (viewParam === 'transport') fetchPickups() }, [viewParam, fetchPickups])

  // Suggested slots
  useEffect(() => {
    if (!showBookDialog || editBookingId || !selectedBaseId || !bkDockType || !bkPallets) { setSuggestions([]); return }
    const pallets = Number(bkPallets)
    if (pallets <= 0) { setSuggestions([]); return }
    let cancelled = false
    setLoadingSuggestions(true)
    api.get('/reception-booking/suggested-slots/', {
      params: { base_id: selectedBaseId, date: selectedDate, dock_type: bkDockType, pallet_count: pallets },
    }).then((res) => { if (!cancelled) setSuggestions(res.data) })
      .catch(() => { if (!cancelled) setSuggestions([]) })
      .finally(() => { if (!cancelled) setLoadingSuggestions(false) })
    return () => { cancelled = true }
  }, [showBookDialog, editBookingId, selectedBaseId, selectedDate, bkDockType, bkPallets])

  // ─── Computed ───
  const baseConfigs = useMemo(() => configs.filter((c) => !selectedBaseId || c.base_id === Number(selectedBaseId)), [configs, selectedBaseId])
  const dockTypes = useMemo(() => [...new Set(baseConfigs.map((c) => c.dock_type))], [baseConfigs])
  const selectedDow = useMemo(() => { const d = new Date(selectedDate); return (d.getDay() + 6) % 7 }, [selectedDate])

  const { columns, timeSlots, earliest, latest } = useMemo(() => {
    const cols: DockColumn[] = []
    let earliest = 24 * 60, latest = 0
    const typesToShow = selectedDockType ? [selectedDockType] : dockTypes
    for (const dt of typesToShow) {
      const cfg = baseConfigs.find((c) => c.dock_type === dt)
      if (!cfg) continue
      const ov = overrides.find((o) => o.dock_config_id === cfg.id && o.override_date === selectedDate)
      if (ov && ov.is_closed) continue
      const schedule = cfg.schedules.find((s) => s.day_of_week === selectedDow)
      if (!schedule && !ov) continue
      const openTime = ov?.open_time || schedule?.open_time
      const closeTime = ov?.close_time || schedule?.close_time
      if (!openTime || !closeTime) continue
      const dockCount = ov?.dock_count ?? cfg.dock_count
      const open = timeToMinutes(openTime), close = timeToMinutes(closeTime)
      if (open < earliest) earliest = open
      if (close > latest) latest = close
      for (let d = 1; d <= dockCount; d++) {
        cols.push({ dockType: dt, dockNumber: d, label: `${DOCK_TYPE_LABELS[dt] || dt} Q${d}`, color: DOCK_TYPE_COLORS[dt] || '#737373' })
      }
    }
    const slots: string[] = []
    let cur = earliest
    while (cur + 15 <= latest) { slots.push(minutesToTime(cur)); cur += 15 }
    return { columns: cols, timeSlots: slots, earliest, latest }
  }, [baseConfigs, dockTypes, selectedDockType, selectedDow, selectedDate, overrides])

  const bookingMatrix = useMemo(() => {
    return timeSlots.map((slotTime) => {
      const slotMin = timeToMinutes(slotTime)
      return columns.map((col) => {
        return bookings.find((b) => {
          if (b.dock_type !== col.dockType || b.dock_number !== col.dockNumber) return false
          const bStart = timeToMinutes(b.start_time), bEnd = timeToMinutes(b.end_time)
          return bStart <= slotMin && bEnd > slotMin
        }) || null
      })
    })
  }, [bookings, timeSlots, columns])

  const checkedInBookings = useMemo(() => bookings.filter((b) => b.status === 'CHECKED_IN'), [bookings])
  const atDockBookings = useMemo(() => bookings.filter((b) => ['AT_DOCK', 'UNLOADING'].includes(b.status)), [bookings])
  const dockLeftBookings = useMemo(() => bookings.filter((b) => b.status === 'DOCK_LEFT'), [bookings])

  // ─── Handlers ───
  const handleSaveBooking = async () => {
    if (!bkDockType || !bkStartTime || !bkPallets) return
    if (!editBookingId && !selectedBaseId) { alert('Veuillez selectionner une base.'); return }
    setSaving(true)
    try {
      if (editBookingId) {
        await api.put(`/reception-booking/bookings/${editBookingId}`, {
          dock_type: bkDockType, dock_number: bkDockNum ? Number(bkDockNum) : null,
          start_time: bkStartTime, pallet_count: Number(bkPallets),
          supplier_name: bkSupplier || null, is_locked: bkLocked, notes: bkNotes || null,
        })
      } else {
        await api.post('/reception-booking/bookings/', {
          base_id: Number(selectedBaseId), dock_type: bkDockType, booking_date: selectedDate,
          start_time: bkStartTime, pallet_count: Number(bkPallets),
          dock_number: bkDockNum ? Number(bkDockNum) : null,
          supplier_name: bkSupplier || null, is_locked: bkLocked, notes: bkNotes || null,
          is_pickup: bkIsPickup,
          pickup_date: bkIsPickup && bkPickupDate ? bkPickupDate : null,
          pickup_address: bkIsPickup && bkPickupAddress ? bkPickupAddress : null,
          orders: bkOrderNum ? [{ order_number: bkOrderNum }] : [],
        })
      }
      setShowBookDialog(false); fetchData()
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur')
    } finally { setSaving(false) }
  }

  const handleBookingAction = async (bookingId: number, action: string) => {
    try {
      if (action === 'at-dock') { const dock = prompt('Numero de quai :'); if (!dock) return; await api.post(`/reception-booking/bookings/${bookingId}/at-dock`, { dock_number: Number(dock) }) }
      else if (action === 'unloading') { await api.post(`/reception-booking/bookings/${bookingId}/unloading`) }
      else if (action === 'dock-left') { await api.post(`/reception-booking/bookings/${bookingId}/dock-left`) }
      else if (action === 'site-departure') { await api.post(`/reception-booking/bookings/${bookingId}/site-departure`) }
      else if (action === 'refuse') { const reason = prompt('Motif du refus :'); if (!reason) return; await api.post(`/reception-booking/bookings/${bookingId}/refuse`, { reason }) }
      else if (action === 'cancel') { await api.put(`/reception-booking/bookings/${bookingId}`, { status: 'CANCELLED' }) }
      fetchData()
    } catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
  }

  const handleDeleteBooking = async (bookingId: number) => {
    if (!window.confirm('Supprimer definitivement ce booking ?')) return
    try { await api.delete(`/reception-booking/bookings/${bookingId}`); fetchData() }
    catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
  }

  const handleSaveConfig = async () => {
    if (!selectedBaseId) return
    setSaving(true)
    try {
      const payload = {
        base_id: Number(selectedBaseId), dock_type: cfgDockType, dock_count: Number(cfgDockCount),
        pallets_per_hour: Number(cfgPalletsH), setup_minutes: Number(cfgSetup), departure_minutes: Number(cfgDepart),
        schedules: cfgSchedules.map((s) => ({ day_of_week: s.day, open_time: s.open, close_time: s.close })),
      }
      if (editConfigId) await api.put(`/reception-booking/dock-configs/${editConfigId}`, payload)
      else await api.post('/reception-booking/dock-configs/', payload)
      setShowConfigDialog(false); fetchData()
    } catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleImport = async (file: File) => {
    const formData = new FormData(); formData.append('file', file)
    try { const res = await api.post('/reception-booking/import-orders/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); setImportResult(res.data); fetchData() }
    catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
  }

  const openNewConfig = (dockType?: string) => {
    const existing = dockType ? baseConfigs.find((c) => c.dock_type === dockType) : null
    if (existing) {
      setEditConfigId(existing.id); setCfgDockType(existing.dock_type); setCfgDockCount(String(existing.dock_count))
      setCfgPalletsH(String(existing.pallets_per_hour)); setCfgSetup(String(existing.setup_minutes)); setCfgDepart(String(existing.departure_minutes))
      setCfgSchedules(existing.schedules.map((s) => ({ day: s.day_of_week, open: s.open_time, close: s.close_time })))
    } else {
      setEditConfigId(null); setCfgDockType(dockType || 'SEC'); setCfgDockCount('2'); setCfgPalletsH('30'); setCfgSetup('10'); setCfgDepart('8')
      setCfgSchedules([0, 1, 2, 3, 4].map((d) => ({ day: d, open: '06:00', close: '14:00' })))
    }
    setShowConfigDialog(true)
  }

  const openNewBooking = (dockType?: string, startTime?: string) => {
    setEditBookingId(null); setBkDockType(dockType || dockTypes[0] || 'SEC'); setBkStartTime(startTime || timeSlots[0] || '06:00')
    setBkPallets(''); setBkSupplier(''); setBkOrderNum(''); setBkLocked(false); setBkNotes(''); setBkDockNum('')
    setBkIsPickup(false); setBkPickupDate(''); setBkPickupAddress(''); setShowBookDialog(true)
  }

  const openEditBooking = (b: Booking) => {
    setEditBookingId(b.id); setBkDockType(b.dock_type); setBkStartTime(b.start_time)
    setBkPallets(String(b.pallet_count)); setBkSupplier(b.supplier_name || ''); setBkOrderNum(b.orders.map((o) => o.order_number).join(', '))
    setBkLocked(b.is_locked); setBkNotes(b.notes || ''); setBkDockNum(b.dock_number ? String(b.dock_number) : '')
    setBkIsPickup(b.is_pickup || false); setBkPickupDate(b.pickup_date || ''); setBkPickupAddress(b.pickup_address || '')
    setShowBookDialog(true)
  }

  // Override handlers
  const openOverrideDialog = (dateStr: string, dockConfigId?: number) => {
    setOvDate(dateStr); setOvConfigId(dockConfigId || (baseConfigs[0]?.id ?? ''))
    const existing = overrides.find((o) => o.override_date === dateStr && (dockConfigId ? o.dock_config_id === dockConfigId : true))
    if (existing) {
      setEditOverrideId(existing.id); setOvConfigId(existing.dock_config_id); setOvClosed(existing.is_closed)
      setOvOpenTime(existing.open_time || ''); setOvCloseTime(existing.close_time || '')
      setOvDockCount(existing.dock_count != null ? String(existing.dock_count) : ''); setOvNotes(existing.notes || '')
    } else {
      setEditOverrideId(null); setOvClosed(false); setOvOpenTime(''); setOvCloseTime(''); setOvDockCount(''); setOvNotes('')
    }
    setShowOverrideDialog(true)
  }

  const handleSaveOverride = async () => {
    if (!ovConfigId || !ovDate) return
    setSaving(true)
    try {
      const payload = { dock_config_id: Number(ovConfigId), override_date: ovDate, is_closed: ovClosed, open_time: ovOpenTime || null, close_time: ovCloseTime || null, dock_count: ovDockCount ? Number(ovDockCount) : null, notes: ovNotes || null }
      if (editOverrideId) await api.put(`/reception-booking/schedule-overrides/${editOverrideId}`, payload)
      else await api.post('/reception-booking/schedule-overrides/', payload)
      setShowOverrideDialog(false); fetchData()
    } catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
    finally { setSaving(false) }
  }

  const handleDeleteOverride = async () => {
    if (!editOverrideId || !window.confirm('Supprimer cette exception ?')) return
    try { await api.delete(`/reception-booking/schedule-overrides/${editOverrideId}`); setShowOverrideDialog(false); fetchData() }
    catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
  }

  // DnD
  const handleDragStart = (event: DragStartEvent) => { const id = String(event.active.id); if (id.startsWith('booking-')) setDragBookingId(Number(id.replace('booking-', ''))) }
  const handleDragEnd = async (event: DragEndEvent) => {
    setDragBookingId(null); const { active, over } = event; if (!over) return
    const bookingId = Number(String(active.id).replace('booking-', '')); const dropId = String(over.id)
    if (!dropId.startsWith('drop-')) return
    const parts = dropId.split('-'); const slotTime = `${parts[1]}:${parts[2]}`; const colIdx = Number(parts[3]); const col = columns[colIdx]; if (!col) return
    const booking = bookings.find((b) => b.id === bookingId); if (!booking) return
    if (booking.start_time === slotTime && booking.dock_number === col.dockNumber && booking.dock_type === col.dockType) return
    try { await api.put(`/reception-booking/bookings/${bookingId}`, { dock_type: col.dockType, dock_number: col.dockNumber, start_time: slotTime }); fetchData() }
    catch (err: unknown) { alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur') }
  }
  const draggedBooking = dragBookingId ? bookings.find((b) => b.id === dragBookingId) : null

  // ─── Render booking block ───
  const renderBookingBlock = (booking: Booking, slotTime: string) => {
    if (booking.start_time !== slotTime) return <div className="h-full rounded" style={{ backgroundColor: `${STATUS_COLORS[booking.status]}15` }} />
    const slotsSpan = Math.ceil(booking.estimated_duration_minutes / 15)
    const color = STATUS_COLORS[booking.status] || '#737373'
    const isDead = ['CANCELLED', 'REFUSED'].includes(booking.status)
    return (
      <div className="rounded px-1.5 py-1 text-xs cursor-pointer overflow-hidden"
        style={{ backgroundColor: `${color}${isDead ? '10' : '20'}`, borderLeft: `3px solid ${color}`, minHeight: `${slotsSpan * 28}px`, opacity: isDead ? 0.6 : 1, textDecoration: booking.status === 'CANCELLED' ? 'line-through' : undefined }}
        title={`${booking.supplier_name || '?'} — ${booking.pallet_count} pal. — ${booking.start_time}-${booking.end_time}`}
        onClick={(e) => { e.stopPropagation(); openEditBooking(booking) }}>
        <div className="flex items-center gap-1">
          {booking.orders.some((o) => o.reconciled) && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} title="Rapproche" />}
          {booking.is_pickup && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} title="Enlevement" />}
          {booking.is_locked && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} title="Verrouille" />}
          {booking.notes && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#3b82f6' }} title="Note" />}
          <span className="font-bold truncate" style={{ color }}>{booking.supplier_name || 'Sans nom'}</span>
        </div>
        <div className="truncate" style={{ color: 'var(--text-primary)' }}>{booking.orders.map((o) => o.order_number).join(', ') || '—'} · {booking.pallet_count} pal.</div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{booking.start_time}-{booking.end_time} · {STATUS_LABELS[booking.status]}</div>
        {booking.refusal && <div className="text-[10px] mt-0.5 truncate" style={{ color: '#ef4444' }}>Refuse : {booking.refusal.reason}</div>}
        {booking.checkin && <div className="text-[10px] mt-0.5" style={{ color: '#3b82f6' }}>Arrive {booking.checkin.checkin_time.slice(11, 16)} · {booking.checkin.license_plate}</div>}
      </div>
    )
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm border"
  const inputStyle = { backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {viewParam === 'gate' ? 'Poste de garde — Check-in / Depart' : viewParam === 'appros' ? 'Booking fournisseurs' : viewParam === 'transport' ? 'Enlevements transport' : viewParam === 'reception' ? 'Reception quais' : 'Booking reception'}
        </h1>
        {viewParam !== 'gate' && viewParam !== 'transport' && (
          <div className="flex gap-2">
            {['planning', 'config', 'import', 'calendar', 'stats'].filter(t => {
              if (t === 'config' && viewParam !== 'reception' && viewParam !== null) return false
              if (t === 'import' && viewParam !== 'appros' && viewParam !== null) return false
              return true
            }).map(t => (
              <button key={t} onClick={() => setTab(t as typeof tab)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: tab === t ? 'var(--color-primary)' : 'var(--bg-tertiary)', color: tab === t ? 'white' : 'var(--text-primary)' }}>
                {t === 'planning' ? 'Planning' : t === 'config' ? 'Configuration' : t === 'import' ? 'Import' : t === 'calendar' ? 'Calendrier' : 'Stats'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (isReception || isGate) && (
        <div className="space-y-1">
          {notifications.slice(0, 3).map((n) => (
            <div key={n.id} className="flex items-center gap-3 px-4 py-2 rounded-lg animate-pulse"
              style={{ backgroundColor: `${STATUS_COLORS.CHECKED_IN}20`, border: `1px solid ${STATUS_COLORS.CHECKED_IN}` }}>
              <span className="text-xs font-bold" style={{ color: STATUS_COLORS.CHECKED_IN }}>{n.time}</span>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.message}</span>
              <button className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }} onClick={() => setNotifications((prev) => prev.filter((x) => x.id !== n.id))}>x</button>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 items-center flex-wrap">
        <select value={selectedBaseId} onChange={(e) => setSelectedBaseId(Number(e.target.value) || '')} className="px-3 py-1.5 rounded-lg text-sm border" style={inputStyle}>
          <option value="">Toutes les bases</option>
          {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm border" style={inputStyle} />
        {tab === 'planning' && dockTypes.length > 1 && (
          <select value={selectedDockType} onChange={(e) => setSelectedDockType(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm border" style={inputStyle}>
            <option value="">Tous les types</option>
            {dockTypes.map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt] || dt}</option>)}
          </select>
        )}
        {tab === 'planning' && selectedBaseId && (
          <button onClick={() => openNewBooking()} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>+ Booking</button>
        )}
        <span className="text-sm font-semibold px-3 py-1" style={{ color: 'var(--text-primary)' }}>{formatDateFr(selectedDate)}</span>
      </div>

      {/* ─── VUE GARDE ─── */}
      {(viewParam === 'gate' || (isGate && !isAppros && !isReception && !viewParam)) && (
        <GateView checkedInBookings={checkedInBookings} atDockBookings={atDockBookings} dockLeftBookings={dockLeftBookings} fetchData={fetchData} />
      )}

      {/* ─── VUE TRANSPORT ─── */}
      {viewParam === 'transport' && (
        <TransportView pickups={pickups} carriers={carriers} fetchPickups={fetchPickups} openEditBooking={openEditBooking} />
      )}

      {/* ─── FILE D'ATTENTE RECEPTION ─── */}
      {isReception && checkedInBookings.length > 0 && tab === 'planning' && (
        <div className="rounded-xl border p-3" style={{ borderColor: STATUS_COLORS.CHECKED_IN, backgroundColor: `${STATUS_COLORS.CHECKED_IN}10` }}>
          <div className="text-xs font-semibold mb-2" style={{ color: STATUS_COLORS.CHECKED_IN }}>
            {checkedInBookings.length} chauffeur(s) arrive(s) — en attente d'assignation quai
          </div>
          <div className="flex flex-wrap gap-2">
            {checkedInBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid ${STATUS_COLORS.CHECKED_IN}` }}
                onClick={() => openEditBooking(b)}>
                <span className="text-xs font-bold" style={{ color: STATUS_COLORS.CHECKED_IN }}>{b.supplier_name || 'Sans nom'}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{b.pallet_count} pal. · {b.start_time}</span>
                {b.checkin && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{b.checkin.license_plate}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: PLANNING ─── */}
      {tab === 'planning' && (
        <>
          {loading && <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>}
          {!loading && columns.length === 0 && selectedBaseId && (
            <div className="space-y-4">
              <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                Pas de planning configure pour ce jour.
                <button onClick={() => setTab('config')} className="ml-2 underline" style={{ color: 'var(--color-primary)' }}>Configurer semaine type</button>
                {isReception && <button onClick={() => openOverrideDialog(selectedDate)} className="ml-2 underline" style={{ color: 'var(--color-primary)' }}>Ouvrir ce jour (exception)</button>}
              </div>
              {bookings.length > 0 && (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{bookings.length} booking(s) existant(s) ce jour</div>
                  <div className="space-y-2">
                    {bookings.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: 'var(--bg-tertiary)', borderLeft: `4px solid ${STATUS_COLORS[b.status] || '#737373'}` }}
                        onClick={() => openEditBooking(b)}>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUS_COLORS[b.status] || '#737373' }}>{STATUS_LABELS[b.status] || b.status}</span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{b.supplier_name || 'Sans nom'}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.start_time}-{b.end_time} · {b.pallet_count} pal.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {columns.length > 0 && timeSlots.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-4 px-4 py-2 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Legende</span>
                {[{ c: '#22c55e', l: 'Rapproche' }, { c: '#ef4444', l: 'Verrouille' }, { c: '#3b82f6', l: 'Note' }, { c: '#f59e0b', l: 'Enlevement' }].map(x => (
                  <div key={x.l} className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: x.c }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{x.l}</span></div>
                ))}
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{minutesToTime(earliest)} - {minutesToTime(latest)}</span>
              </div>
              <div className="overflow-x-auto" style={{ padding: '12px' }}>
                <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                    <div style={{ width: '52px', flexShrink: 0, paddingTop: '52px' }}>
                      {timeSlots.map((st) => (
                        <div key={st} style={{ height: '28px', lineHeight: '28px', fontSize: '10px', fontWeight: st.endsWith(':00') ? 700 : 400, color: st.endsWith(':00') ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'right', paddingRight: '6px' }}>{st}</div>
                      ))}
                    </div>
                    {columns.map((col, ci) => (
                      <div key={ci} style={{ flex: '1', minWidth: '110px', border: `2px solid ${DOCK_TYPE_COLORS[col.dockType] || 'var(--color-primary)'}`, borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
                        <div style={{ background: `linear-gradient(135deg, ${DOCK_TYPE_COLORS[col.dockType] || '#737373'}, ${DOCK_TYPE_COLORS[col.dockType] || '#737373'}cc)`, padding: '10px 6px', textAlign: 'center' }}>
                          <div style={{ color: 'white', fontSize: '15px', fontWeight: 700 }}>Quai n&deg;{col.dockNumber}</div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>{DOCK_TYPE_LABELS[col.dockType] || col.dockType}</div>
                        </div>
                        {timeSlots.map((st, si) => {
                          const booking = bookingMatrix[si]?.[ci] || null
                          return (
                            <DroppableCell id={`drop-${st.replace(':', '-')}-${ci}`} key={st}
                              style={{ height: '28px', borderTop: st.endsWith(':00') ? '1px solid var(--border-color)' : st.endsWith(':30') ? '1px dashed var(--border-color)' : '1px solid transparent', backgroundColor: st.endsWith(':00') ? 'var(--bg-secondary)' : 'var(--bg-primary)', cursor: booking || !selectedBaseId ? 'default' : 'pointer', padding: '0 3px' }}
                              onClick={() => !booking && selectedBaseId && openNewBooking(col.dockType, st)}>
                              {booking ? (booking.start_time === st && isAppros ? <DraggableBooking id={`booking-${booking.id}`}>{renderBookingBlock(booking, st)}</DraggableBooking> : renderBookingBlock(booking, st)) : null}
                            </DroppableCell>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  <DragOverlay>{draggedBooking && <div style={{ padding: '6px 10px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: 'white', fontSize: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', whiteSpace: 'nowrap' }}>{draggedBooking.supplier_name || 'Booking'} — {draggedBooking.pallet_count} pal.</div>}</DragOverlay>
                </DndContext>
              </div>
            </div>
          )}
          {bookings.length > 0 && <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}><span>{bookings.length} booking(s)</span><span>{bookings.reduce((s, b) => s + b.pallet_count, 0)} palettes</span></div>}
        </>
      )}

      {/* ─── TAB: CONFIG ─── */}
      {tab === 'config' && (
        <div className="space-y-4">
          {!selectedBaseId ? <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Selectionnez une base pour configurer les quais.</div> : (
            <>
              <div className="flex gap-2 items-center">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Types de quais configures :</span>
                {['SEC', 'FRAIS', 'GEL', 'FFL'].map((dt) => {
                  const exists = baseConfigs.find((c) => c.dock_type === dt)
                  return <button key={dt} onClick={() => openNewConfig(dt)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: exists ? DOCK_TYPE_COLORS[dt] : 'var(--border-color)', color: exists ? DOCK_TYPE_COLORS[dt] : 'var(--text-muted)', backgroundColor: exists ? `${DOCK_TYPE_COLORS[dt]}15` : 'transparent' }}>{DOCK_TYPE_LABELS[dt]} {exists ? `(${exists.dock_count})` : '+'}</button>
                })}
              </div>
              {baseConfigs.map((cfg) => (
                <div key={cfg.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DOCK_TYPE_COLORS[cfg.dock_type] }} />
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{DOCK_TYPE_LABELS[cfg.dock_type]} — {cfg.dock_count} quai(s)</span>
                    </div>
                    <button onClick={() => openNewConfig(cfg.dock_type)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--color-primary)' }}>Modifier</button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Productivite:</span> {cfg.pallets_per_hour} pal/h</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Mise a quai:</span> {cfg.setup_minutes} min</div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Depart:</span> {cfg.departure_minutes} min</div>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {cfg.schedules.sort((a, b) => a.day_of_week - b.day_of_week).map((s) => (
                      <span key={s.day_of_week} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>{DAY_LABELS[s.day_of_week]} {s.open_time}-{s.close_time}</span>
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
          <div className="rounded-lg border p-6 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Import du carnet de commandes (fichier XLS, sheet "Lst Rd Ouvert Detail")</p>
            <input type="file" accept=".xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f) }} className="text-sm" style={{ color: 'var(--text-primary)' }} />
          </div>
          {importResult && (
            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Resultat import</h3>
              <div className="text-sm space-y-1" style={{ color: 'var(--text-primary)' }}>
                <div>Commandes importees : <strong>{importResult.imported}</strong></div>
                <div>Reconciliees avec bookings : <strong>{importResult.reconciled}</strong></div>
                {importResult.errors.length > 0 && <div className="mt-2"><div className="font-medium" style={{ color: '#ef4444' }}>Erreurs :</div>{importResult.errors.map((err, i) => <div key={i} className="text-xs" style={{ color: '#ef4444' }}>{err}</div>)}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: CALENDRIER ─── */}
      {tab === 'calendar' && (
        <CalendarTab selectedBaseId={selectedBaseId} baseConfigs={baseConfigs} overrides={overrides} isReception={isReception} setSelectedDate={setSelectedDate} setTab={setTab} openOverrideDialog={openOverrideDialog} fetchData={fetchData} />
      )}

      {/* ─── TAB: STATS ─── */}
      {tab === 'stats' && <StatsTab selectedBaseId={selectedBaseId} />}

      {/* ─── DIALOG: Override ─── */}
      {showOverrideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowOverrideDialog(false)}>
          <div className="w-full max-w-md rounded-xl border shadow-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{editOverrideId ? 'Modifier exception' : 'Nouvelle exception'}</h2>
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>{formatDateFr(ovDate)}</div>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type de quai</label>
                <select value={ovConfigId} onChange={(e) => setOvConfigId(Number(e.target.value) || '')} disabled={!!editOverrideId} className={inputCls} style={inputStyle}>
                  <option value="">-- Choisir --</option>
                  {baseConfigs.map((c) => <option key={c.id} value={c.id}>{DOCK_TYPE_LABELS[c.dock_type] || c.dock_type} ({c.dock_count} quais)</option>)}
                </select></div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}><input type="checkbox" checked={ovClosed} onChange={(e) => setOvClosed(e.target.checked)} />Ferme ce jour</label>
              {!ovClosed && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ouverture</label><input type="time" value={ovOpenTime} onChange={(e) => setOvOpenTime(e.target.value)} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fermeture</label><input type="time" value={ovCloseTime} onChange={(e) => setOvCloseTime(e.target.value)} className={inputCls} style={inputStyle} /></div>
                </div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nombre de quais</label><input type="number" min={0} value={ovDockCount} onChange={(e) => setOvDockCount(e.target.value)} className={inputCls} style={inputStyle} /></div>
              </>)}
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Motif / notes</label><input type="text" value={ovNotes} onChange={(e) => setOvNotes(e.target.value)} placeholder="ex: Inventaire, jour ferie..." className={inputCls} style={inputStyle} /></div>
            </div>
            <div className="mt-5 flex justify-between">
              <div>{editOverrideId && <button onClick={handleDeleteOverride} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#ef4444', border: '1px solid #ef444440' }}>Supprimer</button>}</div>
              <div className="flex gap-2">
                <button onClick={() => setShowOverrideDialog(false)} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
                <button onClick={handleSaveOverride} disabled={saving || !ovConfigId || !ovDate} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIALOG: New/Edit Booking ─── */}
      {showBookDialog && (() => {
        const editedBooking = editBookingId ? bookings.find((b) => b.id === editBookingId) : null
        const readOnly = editedBooking ? !canEdit(editedBooking) : false
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowBookDialog(false)}>
            <div className="w-full max-w-md rounded-xl border shadow-2xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{readOnly ? 'Detail booking' : (editBookingId ? 'Modifier booking' : 'Nouveau booking')}</h2>
              {editedBooking && (
                <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUS_COLORS[editedBooking.status] || '#737373' }}>{STATUS_LABELS[editedBooking.status]}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{editedBooking.start_time}-{editedBooking.end_time} · {editedBooking.pallet_count} pal.</span>
                  {editedBooking.checkin && <span className="text-xs" style={{ color: '#3b82f6' }}>Plaque: {editedBooking.checkin.license_plate}</span>}
                </div>
              )}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type quai *</label><select value={bkDockType} onChange={(e) => setBkDockType(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle}>{dockTypes.map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt]}</option>)}</select></div>
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Heure debut *</label><input type="time" step={900} value={bkStartTime} onChange={(e) => setBkStartTime(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nb palettes *</label><input type="number" min={1} value={bkPallets} onChange={(e) => setBkPallets(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Quai</label><div className={inputCls} style={inputStyle}>{editBookingId ? (bkDockNum ? `Q${bkDockNum}` : 'Non assigne') : 'Attribution automatique'}</div></div>
                </div>
                {!editBookingId && bkPallets && Number(bkPallets) > 0 && (
                  <div className="rounded-lg border p-3" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary)08' }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>Creneaux recommandes</div>
                    {loadingSuggestions && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Calcul...</div>}
                    {!loadingSuggestions && suggestions.length === 0 && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucune suggestion</div>}
                    {!loadingSuggestions && suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((s, i) => (
                          <button key={i} onClick={() => setBkStartTime(s.start_time)} className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                            style={{ borderColor: bkStartTime === s.start_time ? 'var(--color-primary)' : 'var(--border-color)', backgroundColor: bkStartTime === s.start_time ? 'var(--color-primary)' : 'var(--bg-tertiary)', color: bkStartTime === s.start_time ? 'white' : 'var(--text-primary)' }}>
                            <span className="font-bold">{s.start_time}-{s.end_time}</span> <span className="opacity-70">Q{s.dock_number}</span> <span className="opacity-60">({s.reason})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fournisseur</label><input type="text" value={bkSupplier} onChange={(e) => setBkSupplier(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>N° commande</label><input type="text" value={bkOrderNum} onChange={(e) => setBkOrderNum(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}><input type="checkbox" checked={bkLocked} onChange={(e) => setBkLocked(e.target.checked)} disabled={readOnly} />Non deplacable</label>
                <div className="rounded-lg border p-3" style={{ borderColor: bkIsPickup ? '#f59e0b' : 'var(--border-color)', backgroundColor: bkIsPickup ? '#f59e0b08' : 'transparent' }}>
                  <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}><input type="checkbox" checked={bkIsPickup} onChange={(e) => setBkIsPickup(e.target.checked)} disabled={readOnly} />Enlevement transport</label>
                  {bkIsPickup && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Date enlevement</label><input type="date" value={bkPickupDate} onChange={(e) => setBkPickupDate(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                      <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Adresse</label><input type="text" value={bkPickupAddress} onChange={(e) => setBkPickupAddress(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                    </div>
                  )}
                  {editBookingId && bkIsPickup && (() => {
                    const eb = bookings.find(b => b.id === editBookingId)
                    if (!eb?.pickup_status) return null
                    return <div className="mt-2 flex items-center gap-2"><span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: PICKUP_STATUS_COLORS[eb.pickup_status] || '#737373' }}>{PICKUP_STATUS_LABELS[eb.pickup_status]}</span>{eb.carrier_name && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Transporteur: {eb.carrier_name}</span>}</div>
                  })()}
                </div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label><textarea rows={2} value={bkNotes} onChange={(e) => setBkNotes(e.target.value)} disabled={readOnly} className={`${inputCls} disabled:opacity-60`} style={inputStyle} /></div>
                {editedBooking?.refusal && (
                  <div className="px-3 py-2 rounded-lg border" style={{ borderColor: '#ef4444', backgroundColor: '#ef444410' }}>
                    <div className="text-xs font-medium" style={{ color: '#ef4444' }}>Motif du refus :</div>
                    <div className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{editedBooking.refusal.reason}</div>
                  </div>
                )}
              </div>
              {editedBooking && (
                <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
                  {isReception && editedBooking.status === 'CHECKED_IN' && <button onClick={() => { handleBookingAction(editedBooking.id, 'at-dock'); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: STATUS_COLORS.AT_DOCK }}>Assigner quai</button>}
                  {isReception && editedBooking.status === 'AT_DOCK' && <button onClick={() => { handleBookingAction(editedBooking.id, 'unloading'); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: STATUS_COLORS.UNLOADING }}>Debut dechargement</button>}
                  {isReception && ['AT_DOCK', 'UNLOADING'].includes(editedBooking.status) && <button onClick={() => { handleBookingAction(editedBooking.id, 'dock-left'); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: STATUS_COLORS.DOCK_LEFT }}>Parti du quai</button>}
                  {isGate && editedBooking.status === 'DOCK_LEFT' && <button onClick={() => { handleBookingAction(editedBooking.id, 'site-departure'); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: STATUS_COLORS.COMPLETED }}>Parti du site</button>}
                  {isReception && ['DRAFT', 'CONFIRMED', 'CHECKED_IN'].includes(editedBooking.status) && <button onClick={() => { handleBookingAction(editedBooking.id, 'refuse'); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#ef4444' }}>Refuser</button>}
                  {isAppros && !['COMPLETED', 'CANCELLED', 'REFUSED', 'DOCK_LEFT'].includes(editedBooking.status) && <button onClick={() => { handleBookingAction(editedBooking.id, 'cancel'); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#6b7280', color: '#6b7280' }}>Annuler</button>}
                  {canEdit(editedBooking) && !['COMPLETED', 'CANCELLED', 'REFUSED', 'DOCK_LEFT'].includes(editedBooking.status) && <button onClick={() => { handleDeleteBooking(editedBooking.id); setShowBookDialog(false) }} className="px-3 py-1.5 rounded-lg text-xs font-medium ml-auto" style={{ color: '#ef4444', border: '1px solid #ef444440' }}>Supprimer</button>}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setShowBookDialog(false)} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Fermer</button>
                {!readOnly && !['COMPLETED', 'CANCELLED', 'REFUSED', 'DOCK_LEFT'].includes(editedBooking?.status || '') && (
                  <button onClick={handleSaveBooking} disabled={saving || !bkDockType || !bkStartTime || !bkPallets} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>{saving ? 'Enregistrement...' : (editBookingId ? 'Enregistrer' : 'Creer')}</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── DIALOG: Config ─── */}
      {showConfigDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowConfigDialog(false)}>
          <div className="w-full max-w-lg rounded-xl border shadow-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{editConfigId ? 'Modifier' : 'Ajouter'} configuration quai</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type de quai</label><select value={cfgDockType} onChange={(e) => setCfgDockType(e.target.value)} disabled={!!editConfigId} className={inputCls} style={inputStyle}>{['SEC', 'FRAIS', 'GEL', 'FFL'].map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt]}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nb quais</label><input type="number" min={1} value={cfgDockCount} onChange={(e) => setCfgDockCount(e.target.value)} className={inputCls} style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Palettes/heure</label><input type="number" min={1} value={cfgPalletsH} onChange={(e) => setCfgPalletsH(e.target.value)} className={inputCls} style={inputStyle} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Mise a quai (min)</label><input type="number" min={0} value={cfgSetup} onChange={(e) => setCfgSetup(e.target.value)} className={inputCls} style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Depart (min)</label><input type="number" min={0} value={cfgDepart} onChange={(e) => setCfgDepart(e.target.value)} className={inputCls} style={inputStyle} /></div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Horaires d'ouverture</label>
                {cfgSchedules.map((s, i) => (
                  <div key={s.day} className="flex items-center gap-2 mb-1">
                    <span className="text-xs w-8" style={{ color: 'var(--text-primary)' }}>{DAY_LABELS[s.day]}</span>
                    <input type="time" value={s.open} onChange={(e) => { const arr = [...cfgSchedules]; arr[i] = { ...s, open: e.target.value }; setCfgSchedules(arr) }} className="px-2 py-1 rounded text-xs border" style={inputStyle} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>
                    <input type="time" value={s.close} onChange={(e) => { const arr = [...cfgSchedules]; arr[i] = { ...s, close: e.target.value }; setCfgSchedules(arr) }} className="px-2 py-1 rounded text-xs border" style={inputStyle} />
                    <button onClick={() => setCfgSchedules(cfgSchedules.filter((_, j) => j !== i))} className="text-xs" style={{ color: '#ef4444' }}>x</button>
                  </div>
                ))}
                <button onClick={() => { const usedDays = new Set(cfgSchedules.map((s) => s.day)); const nextDay = [0, 1, 2, 3, 4, 5, 6].find((d) => !usedDays.has(d)); if (nextDay !== undefined) setCfgSchedules([...cfgSchedules, { day: nextDay, open: '06:00', close: '14:00' }]) }} className="text-xs mt-1" style={{ color: 'var(--color-primary)' }}>+ Ajouter un jour</button>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowConfigDialog(false)} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>Annuler</button>
              <button onClick={handleSaveConfig} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
