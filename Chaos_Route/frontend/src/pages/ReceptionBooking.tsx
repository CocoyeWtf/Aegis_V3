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
  refused_by_user_id: number; timestamp: string; notes?: string
}

interface DockScheduleOverride {
  id: number; dock_config_id: number; override_date: string
  is_closed: boolean; open_time?: string; close_time?: string
  dock_count?: number; notes?: string
}

interface DayAvailability {
  date: string; dock_type: string; is_closed: boolean
  open_time?: string; close_time?: string; dock_count: number
  has_override: boolean; booking_count: number; pallet_total: number
}

interface Booking {
  id: number; base_id: number; dock_type: string; dock_number?: number
  booking_date: string; start_time: string; end_time: string
  pallet_count: number; estimated_duration_minutes: number
  status: string; is_locked: boolean; supplier_name?: string
  temperature_type?: string; notes?: string; created_by_user_id?: number
  orders: BookingOrder[]; checkin?: BookingCheckin; refusal?: BookingRefusal
}

interface SuggestedSlot {
  start_time: string; end_time: string; dock_number: number
  score: number; reason: string
}

const DOCK_TYPE_LABELS: Record<string, string> = {
  SEC: 'Sec', FRAIS: 'Frais', GEL: 'Gel', FFL: 'FFL',
}
const DOCK_TYPE_COLORS: Record<string, string> = {
  SEC: '#a3a3a3', FRAIS: '#3b82f6', GEL: '#8b5cf6', FFL: '#22c55e',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Planifie', CONFIRMED: 'Confirme', CHECKED_IN: 'Arrive sur site',
  AT_DOCK: 'A quai', UNLOADING: 'Dechargement', DOCK_LEFT: 'Parti du quai',
  COMPLETED: 'Parti du site', CANCELLED: 'Annule',
  REFUSED: 'Refuse', NO_SHOW: 'Absent',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#737373', CONFIRMED: '#f97316', CHECKED_IN: '#3b82f6',
  AT_DOCK: '#f59e0b', UNLOADING: '#a855f7', DOCK_LEFT: '#06b6d4',
  COMPLETED: '#22c55e', CANCELLED: '#6b7280',
  REFUSED: '#ef4444', NO_SHOW: '#ef4444',
}
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function timeToMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minutesToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTH_NAMES = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']

function formatDateFr(dateStr: string) {
  const d = new Date(dateStr)
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

export default function ReceptionBooking() {
  const user = useAuthStore((s) => s.user)
  const [bases, setBases] = useState<Base[]>([])
  const [configs, setConfigs] = useState<DockConfig[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [overrides, setOverrides] = useState<DockScheduleOverride[]>([])
  const [calendarData, setCalendarData] = useState<DayAvailability[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedBaseId, setSelectedBaseId] = useState<number | ''>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedDockType, setSelectedDockType] = useState<string>('')
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM

  // Helpers permissions par role / Permission helpers per role
  const hasPerm = useCallback((resource: string, action: string) => {
    if (!user) return false
    if (user.is_superadmin) return true
    return user.permissions.includes(`${resource}:${action}`) || user.permissions.includes('*:*')
  }, [user])

  const isAppros = useMemo(() => hasPerm('booking-appros', 'update'), [hasPerm])
  const isGate = useMemo(() => hasPerm('booking-gate', 'update'), [hasPerm])
  const isReception = useMemo(() => hasPerm('booking-reception', 'update'), [hasPerm])

  // Verifier si l'utilisateur peut modifier un booking / Check if user can edit a booking
  const canEdit = useCallback((b: Booking) => {
    if (!user) return false
    if (user.is_superadmin) return true
    if (b.created_by_user_id === user.id && isAppros) return true
    return isAppros
  }, [user, isAppros])

  // Dialogs
  const [tab, setTab] = useState<'planning' | 'config' | 'import' | 'calendar'>('planning')
  const [showBookDialog, setShowBookDialog] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  // Booking form (create + edit)
  const [editBookingId, setEditBookingId] = useState<number | null>(null)
  const [bkDockType, setBkDockType] = useState('')
  const [bkStartTime, setBkStartTime] = useState('')
  const [bkPallets, setBkPallets] = useState('')
  const [bkSupplier, setBkSupplier] = useState('')
  const [bkOrderNum, setBkOrderNum] = useState('')
  const [bkLocked, setBkLocked] = useState(false)
  const [bkDockNum, setBkDockNum] = useState('')
  const [bkNotes, setBkNotes] = useState('')
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

  // Garde : check-in
  const [gateOrderNum, setGateOrderNum] = useState('')
  const [gatePlate, setGatePlate] = useState('')
  const [gatePhone, setGatePhone] = useState('')
  const [gateDriverName, setGateDriverName] = useState('')
  const [gateCheckinResult, setGateCheckinResult] = useState<string | null>(null)

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

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch en parallele, chaque appel independant / Parallel fetch, each independent
      const [baseRes, configRes, bookingRes] = await Promise.all([
        api.get('/bases/').catch(() => ({ data: [] })),
        api.get('/reception-booking/dock-configs/', { params: { base_id: selectedBaseId || undefined } }).catch(() => ({ data: [] })),
        api.get('/reception-booking/bookings/', {
          params: { base_id: selectedBaseId || undefined, date: selectedDate },
        }).catch(() => ({ data: [] })),
      ])
      setBases(baseRes.data)
      setConfigs(configRes.data)
      setBookings(bookingRes.data)
      // Fetch overrides separement / Fetch overrides separately
      if (selectedBaseId) {
        try {
          const ovRes = await api.get('/reception-booking/schedule-overrides/', {
            params: { base_id: selectedBaseId, date_from: selectedDate.slice(0, 8) + '01', date_to: selectedDate.slice(0, 8) + '31' },
          })
          setOverrides(ovRes.data)
        } catch { setOverrides([]) }
      } else {
        setOverrides([])
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [selectedBaseId, selectedDate])

  useEffect(() => { fetchData() }, [fetchData])

  // Charger les creneaux recommandes / Fetch suggested slots
  useEffect(() => {
    if (!showBookDialog || editBookingId || !selectedBaseId || !bkDockType || !bkPallets) {
      setSuggestions([])
      return
    }
    const pallets = Number(bkPallets)
    if (pallets <= 0) { setSuggestions([]); return }

    let cancelled = false
    setLoadingSuggestions(true)
    api.get('/reception-booking/suggested-slots/', {
      params: { base_id: selectedBaseId, date: selectedDate, dock_type: bkDockType, pallet_count: pallets },
    }).then((res) => {
      if (!cancelled) setSuggestions(res.data)
    }).catch(() => {
      if (!cancelled) setSuggestions([])
    }).finally(() => {
      if (!cancelled) setLoadingSuggestions(false)
    })
    return () => { cancelled = true }
  }, [showBookDialog, editBookingId, selectedBaseId, selectedDate, bkDockType, bkPallets])

  // Charger calendrier quand onglet calendrier actif / Load calendar when calendar tab active
  const fetchCalendar = useCallback(async () => {
    if (!selectedBaseId) return
    try {
      const res = await api.get('/reception-booking/calendar-availability/', {
        params: { base_id: selectedBaseId, year_month: calendarMonth },
      })
      setCalendarData(res.data)
    } catch { /* silent */ }
  }, [selectedBaseId, calendarMonth])

  useEffect(() => { if (tab === 'calendar') fetchCalendar() }, [tab, fetchCalendar])

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

  // ─── Planning unifie : toutes les colonnes = quais physiques ───
  interface DockColumn { dockType: string; dockNumber: number; label: string; color: string }

  const { columns, timeSlots, earliest, latest } = useMemo(() => {
    const cols: DockColumn[] = []
    let earliest = 24 * 60
    let latest = 0

    const typesToShow = selectedDockType ? [selectedDockType] : dockTypes

    for (const dt of typesToShow) {
      const cfg = baseConfigs.find((c) => c.dock_type === dt)
      if (!cfg) continue

      // Resoudre horaire : override > template semaine / Resolve: override > weekly template
      const ov = overrides.find((o) => o.dock_config_id === cfg.id && o.override_date === selectedDate)
      if (ov && ov.is_closed) continue // Ferme ce jour

      const schedule = cfg.schedules.find((s) => s.day_of_week === selectedDow)
      if (!schedule && !ov) continue

      const openTime = ov?.open_time || schedule?.open_time
      const closeTime = ov?.close_time || schedule?.close_time
      if (!openTime || !closeTime) continue
      const dockCount = ov?.dock_count ?? cfg.dock_count

      const open = timeToMinutes(openTime)
      const close = timeToMinutes(closeTime)
      if (open < earliest) earliest = open
      if (close > latest) latest = close

      for (let d = 1; d <= dockCount; d++) {
        cols.push({
          dockType: dt, dockNumber: d,
          label: `${DOCK_TYPE_LABELS[dt] || dt} Q${d}`,
          color: DOCK_TYPE_COLORS[dt] || '#737373',
        })
      }
    }

    const slots: string[] = []
    let cur = earliest
    while (cur + 15 <= latest) {
      slots.push(minutesToTime(cur))
      cur += 15
    }

    return { columns: cols, timeSlots: slots, earliest, latest }
  }, [baseConfigs, dockTypes, selectedDockType, selectedDow, selectedDate, overrides])

  // Matrice booking : [slotIndex][colIndex] / Booking matrix
  const bookingMatrix = useMemo(() => {
    return timeSlots.map((slotTime) => {
      const slotMin = timeToMinutes(slotTime)
      return columns.map((col) => {
        return bookings.find((b) => {
          if (b.dock_type !== col.dockType || b.dock_number !== col.dockNumber) return false
          const bStart = timeToMinutes(b.start_time)
          const bEnd = timeToMinutes(b.end_time)
          return bStart <= slotMin && bEnd > slotMin
        }) || null
      })
    })
  }, [bookings, timeSlots, columns])

  // ─── Handlers ───
  const handleSaveBooking = async () => {
    if (!bkDockType || !bkStartTime || !bkPallets) return
    if (!editBookingId && !selectedBaseId) {
      alert('Veuillez selectionner une base avant de creer un booking.')
      return
    }
    setSaving(true)
    try {
      if (editBookingId) {
        await api.put(`/reception-booking/bookings/${editBookingId}`, {
          dock_type: bkDockType,
          dock_number: bkDockNum ? Number(bkDockNum) : null,
          start_time: bkStartTime,
          pallet_count: Number(bkPallets),
          supplier_name: bkSupplier || null,
          is_locked: bkLocked,
          notes: bkNotes || null,
        })
      } else {
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
      }
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
      } else if (action === 'unloading') {
        await api.post(`/reception-booking/bookings/${bookingId}/unloading`)
      } else if (action === 'dock-left') {
        await api.post(`/reception-booking/bookings/${bookingId}/dock-left`)
      } else if (action === 'site-departure') {
        await api.post(`/reception-booking/bookings/${bookingId}/site-departure`)
      } else if (action === 'refuse') {
        const reason = prompt('Motif du refus (obligatoire) :')
        if (!reason) return
        await api.post(`/reception-booking/bookings/${bookingId}/refuse`, { reason })
      } else if (action === 'cancel') {
        await api.put(`/reception-booking/bookings/${bookingId}`, { status: 'CANCELLED' })
      }
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }

  const handleDeleteBooking = async (bookingId: number) => {
    if (!window.confirm('Supprimer definitivement ce booking ?')) return
    try {
      await api.delete(`/reception-booking/bookings/${bookingId}`)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur suppression'
      alert(detail)
    }
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

  const openNewBooking = (dockType?: string, startTime?: string) => {
    setEditBookingId(null)
    setBkDockType(dockType || dockTypes[0] || 'SEC')
    setBkStartTime(startTime || timeSlots[0] || '06:00')
    setBkPallets(''); setBkSupplier(''); setBkOrderNum('')
    setBkLocked(false); setBkNotes('')
    setBkDockNum('')  // Toujours auto-assignation
    setShowBookDialog(true)
  }

  const openEditBooking = (b: Booking) => {
    setEditBookingId(b.id)
    setBkDockType(b.dock_type)
    setBkStartTime(b.start_time)
    setBkPallets(String(b.pallet_count))
    setBkSupplier(b.supplier_name || '')
    setBkOrderNum(b.orders.map((o) => o.order_number).join(', '))
    setBkLocked(b.is_locked)
    setBkNotes(b.notes || '')
    setBkDockNum(b.dock_number ? String(b.dock_number) : '')
    setShowBookDialog(true)
  }

  // ─── Garde handlers ───
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

  // Bookings par statut pour les vues garde/reception / Bookings by status for role views
  const checkedInBookings = useMemo(() => bookings.filter((b) => b.status === 'CHECKED_IN'), [bookings])
  const atDockBookings = useMemo(() => bookings.filter((b) => ['AT_DOCK', 'UNLOADING'].includes(b.status)), [bookings])
  const dockLeftBookings = useMemo(() => bookings.filter((b) => b.status === 'DOCK_LEFT'), [bookings])

  // ─── Override handlers ───
  const openOverrideDialog = (dateStr: string, dockConfigId?: number) => {
    setOvDate(dateStr)
    setOvConfigId(dockConfigId || (baseConfigs[0]?.id ?? ''))
    // Chercher un override existant / Look for existing override
    const existing = overrides.find((o) => o.override_date === dateStr && (dockConfigId ? o.dock_config_id === dockConfigId : true))
    if (existing) {
      setEditOverrideId(existing.id)
      setOvConfigId(existing.dock_config_id)
      setOvClosed(existing.is_closed)
      setOvOpenTime(existing.open_time || '')
      setOvCloseTime(existing.close_time || '')
      setOvDockCount(existing.dock_count != null ? String(existing.dock_count) : '')
      setOvNotes(existing.notes || '')
    } else {
      setEditOverrideId(null)
      setOvClosed(false)
      setOvOpenTime(''); setOvCloseTime(''); setOvDockCount(''); setOvNotes('')
    }
    setShowOverrideDialog(true)
  }

  const handleSaveOverride = async () => {
    if (!ovConfigId || !ovDate) return
    setSaving(true)
    try {
      const payload = {
        dock_config_id: Number(ovConfigId),
        override_date: ovDate,
        is_closed: ovClosed,
        open_time: ovOpenTime || null,
        close_time: ovCloseTime || null,
        dock_count: ovDockCount ? Number(ovDockCount) : null,
        notes: ovNotes || null,
      }
      if (editOverrideId) {
        await api.put(`/reception-booking/schedule-overrides/${editOverrideId}`, payload)
      } else {
        await api.post('/reception-booking/schedule-overrides/', payload)
      }
      setShowOverrideDialog(false)
      fetchData()
      if (tab === 'calendar') fetchCalendar()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally { setSaving(false) }
  }

  const handleDeleteOverride = async () => {
    if (!editOverrideId || !window.confirm('Supprimer cette exception ?')) return
    try {
      await api.delete(`/reception-booking/schedule-overrides/${editOverrideId}`)
      setShowOverrideDialog(false)
      fetchData()
      if (tab === 'calendar') fetchCalendar()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }

  // ─── Render helpers ───
  const renderBookingBlock = (booking: Booking, slotTime: string) => {
    // Afficher seulement sur le premier creneau du booking / Only show on first slot
    if (booking.start_time !== slotTime) return (
      <div className="h-full rounded" style={{ backgroundColor: `${STATUS_COLORS[booking.status]}15` }} />
    )

    const slotsSpan = Math.ceil(booking.estimated_duration_minutes / 15)
    const color = STATUS_COLORS[booking.status] || '#737373'

    const isDead = ['CANCELLED', 'REFUSED'].includes(booking.status)

    return (
      <div
        className="rounded px-1.5 py-1 text-xs cursor-pointer overflow-hidden"
        style={{
          backgroundColor: `${color}${isDead ? '10' : '20'}`,
          borderLeft: `3px solid ${color}`,
          minHeight: `${slotsSpan * 28}px`,
          position: 'relative',
          opacity: isDead ? 0.6 : 1,
          textDecoration: booking.status === 'CANCELLED' ? 'line-through' : undefined,
        }}
        title={`${booking.supplier_name || '?'} — ${booking.pallet_count} pal. — ${booking.start_time}-${booking.end_time}${isDead ? ` [${STATUS_LABELS[booking.status]}]` : ''}`}
        onClick={(e) => { e.stopPropagation(); openEditBooking(booking) }}
      >
        <div className="flex items-center gap-1">
          {/* Indicateurs visuels / Visual indicators */}
          {booking.orders.some((o) => o.reconciled) && (
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} title="Rapproche avec import" />
          )}
          {booking.is_locked && (
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} title="Verrouille — ne pas deplacer/refuser" />
          )}
          {booking.notes && (
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#3b82f6' }} title="Note" />
          )}
          <span className="font-bold truncate" style={{ color }}>{booking.supplier_name || 'Sans nom'}</span>
        </div>
        <div className="truncate" style={{ color: 'var(--text-primary)' }}>
          {booking.orders.map((o) => o.order_number).join(', ') || '—'} · {booking.pallet_count} pal.
        </div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {booking.start_time}-{booking.end_time} · {STATUS_LABELS[booking.status]}
          {booking.is_locked && ' · Verrouille'}
        </div>
        {booking.notes && (
          <div className="text-[10px] truncate italic" style={{ color: 'var(--text-muted)' }}>{booking.notes}</div>
        )}
        {booking.refusal && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: '#ef4444' }}>
            Refuse : {booking.refusal.reason}
          </div>
        )}
        {booking.checkin && (
          <div className="text-[10px] mt-0.5" style={{ color: '#3b82f6' }}>
            Arrive {booking.checkin.checkin_time.slice(11, 16)} · {booking.checkin.license_plate}
          </div>
        )}
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
          <button onClick={() => setTab('calendar')}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: tab === 'calendar' ? 'var(--color-primary)' : 'var(--bg-tertiary)', color: tab === 'calendar' ? 'white' : 'var(--text-primary)' }}>
            Calendrier
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
        <span className="text-sm font-semibold px-3 py-1" style={{ color: 'var(--text-primary)' }}>
          {formatDateFr(selectedDate)}
        </span>
      </div>

      {/* ─── VUE GARDE (si uniquement garde, pas appros/reception) ─── */}
      {isGate && !isAppros && !isReception && (
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
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="Scanner ou saisir" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Plaque immatriculation *</label>
                <input type="text" value={gatePlate} onChange={(e) => setGatePlate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Telephone *</label>
                <input type="text" value={gatePhone} onChange={(e) => setGatePhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nom chauffeur</label>
                <input type="text" value={gateDriverName} onChange={(e) => setGateDriverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
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

          {/* En attente depart (DOCK_LEFT → COMPLETED) */}
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
                        <span className="text-xs" style={{ color: '#3b82f6' }}>
                          {b.checkin.license_plate}
                        </span>
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
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Situation du jour
            </h2>
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
      )}

      {/* ─── FILE D'ATTENTE RECEPTION (bandeau au-dessus du planning) ─── */}
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
                <span className="text-xs font-bold" style={{ color: STATUS_COLORS.CHECKED_IN }}>
                  {b.supplier_name || 'Sans nom'}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {b.pallet_count} pal. · {b.start_time}
                </span>
                {b.checkin && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {b.checkin.license_plate}
                  </span>
                )}
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
                <button onClick={() => setTab('config')} className="ml-2 underline" style={{ color: 'var(--color-primary)' }}>
                  Configurer semaine type
                </button>
                {isReception && (
                  <button onClick={() => openOverrideDialog(selectedDate)} className="ml-2 underline" style={{ color: 'var(--color-primary)' }}>
                    Ouvrir ce jour (exception)
                  </button>
                )}
              </div>
              {/* Bookings existants sans planning / Existing bookings without planning grid */}
              {bookings.length > 0 && (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                    {bookings.length} booking(s) existant(s) ce jour
                  </div>
                  <div className="space-y-2">
                    {bookings.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: 'var(--bg-tertiary)', borderLeft: `4px solid ${STATUS_COLORS[b.status] || '#737373'}` }}
                        onClick={() => openEditBooking(b)}>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: STATUS_COLORS[b.status] || '#737373' }}>
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {b.supplier_name || 'Sans nom'}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {b.start_time}-{b.end_time} · {b.pallet_count} pal. · {DOCK_TYPE_LABELS[b.dock_type] || b.dock_type}
                          {b.dock_number ? ` Q${b.dock_number}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {columns.length > 0 && timeSlots.length > 0 && (
            <div className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>

              {/* Legende indicateurs / Indicators legend */}
              <div className="flex items-center gap-4 px-4 py-2 border-b"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Legende</span>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Rapproche</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Verrouille</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Note</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: '#ef444430', border: '1px solid #ef4444' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Refuse</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 rounded-sm" style={{ backgroundColor: '#6b728030', border: '1px solid #6b7280' }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Annule</span>
                </div>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {minutesToTime(earliest)} - {minutesToTime(latest)}
                </span>
              </div>

              <div className="overflow-x-auto" style={{ padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  {/* Colonne horaires / Time column */}
                  <div style={{ width: '52px', flexShrink: 0, paddingTop: '52px' }}>
                    {timeSlots.map((slotTime) => {
                      const isHour = slotTime.endsWith(':00')
                      return (
                        <div key={slotTime} style={{
                          height: '28px', lineHeight: '28px',
                          fontSize: '10px', fontWeight: isHour ? 700 : 400,
                          color: isHour ? 'var(--text-primary)' : 'var(--text-muted)',
                          textAlign: 'right', paddingRight: '6px',
                        }}>
                          {slotTime}
                        </div>
                      )
                    })}
                  </div>

                  {/* Colonnes quais / Dock columns as cards */}
                  {columns.map((col, ci) => (
                    <div key={ci} style={{
                      flex: '1', minWidth: '110px',
                      border: `2px solid ${DOCK_TYPE_COLORS[col.dockType] || 'var(--color-primary)'}`,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: 'var(--bg-primary)',
                    }}>
                      {/* En-tete quai / Dock header — couleur par type */}
                      <div style={{
                        background: `linear-gradient(135deg, ${DOCK_TYPE_COLORS[col.dockType] || '#737373'}, ${DOCK_TYPE_COLORS[col.dockType] || '#737373'}cc)`,
                        padding: '10px 6px',
                        textAlign: 'center',
                      }}>
                        <div style={{ color: 'white', fontSize: '15px', fontWeight: 700 }}>
                          Quai n&deg;{col.dockNumber}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>
                          {DOCK_TYPE_LABELS[col.dockType] || col.dockType}
                        </div>
                      </div>

                      {/* Créneaux / Time slots */}
                      {timeSlots.map((slotTime, si) => {
                        const isHour = slotTime.endsWith(':00')
                        const isHalf = slotTime.endsWith(':30')
                        const booking = bookingMatrix[si]?.[ci] || null
                        return (
                          <div
                            key={slotTime}
                            style={{
                              height: '28px',
                              borderTop: isHour ? '1px solid var(--border-color)' : (isHalf ? '1px dashed var(--border-color)' : '1px solid transparent'),
                              backgroundColor: isHour ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                              cursor: booking || !selectedBaseId ? 'default' : 'pointer',
                              padding: '0 3px',
                            }}
                            onClick={() => !booking && selectedBaseId && openNewBooking(col.dockType, slotTime)}
                          >
                            {booking ? renderBookingBlock(booking, slotTime) : null}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Compteur bookings du jour / Day booking counter */}
          {bookings.length > 0 && (
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{bookings.length} booking(s)</span>
              <span>{bookings.reduce((s, b) => s + b.pallet_count, 0)} palettes</span>
              <span>{bookings.filter((b) => b.status === 'REFUSED').length} refuse(s)</span>
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

      {/* ─── TAB: CALENDRIER ─── */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          {!selectedBaseId ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Selectionnez une base pour voir le calendrier.</div>
          ) : (
            <>
              {/* Navigation mois */}
              <div className="flex items-center gap-3">
                <button onClick={() => {
                  const [y, m] = calendarMonth.split('-').map(Number)
                  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
                  setCalendarMonth(prev)
                }} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>&lt;</button>
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {(() => { const [y, m] = calendarMonth.split('-').map(Number); return `${MONTH_NAMES[m - 1]} ${y}` })()}
                </span>
                <button onClick={() => {
                  const [y, m] = calendarMonth.split('-').map(Number)
                  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
                  setCalendarMonth(next)
                }} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>&gt;</button>
              </div>

              {/* Grille calendrier */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                {/* En-tete jours / Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="text-xs font-semibold text-center py-2" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                      {d}
                    </div>
                  ))}
                </div>
                {/* Cellules jours / Day cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {(() => {
                    const [year, month] = calendarMonth.split('-').map(Number)
                    const firstDay = new Date(year, month - 1, 1).getDay()
                    const startOffset = (firstDay + 6) % 7 // 0=Lundi
                    const daysInMonth = new Date(year, month, 0).getDate()
                    const cells = []

                    // Cellules vides avant le 1er du mois
                    for (let i = 0; i < startOffset; i++) {
                      cells.push(<div key={`e-${i}`} style={{ borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', minHeight: '80px' }} />)
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const dayData = calendarData.filter((d) => d.date === dateStr)
                      const isToday = dateStr === new Date().toISOString().slice(0, 10)
                      const isWeekend = ((startOffset + day - 1) % 7) >= 5

                      cells.push(
                        <div key={day}
                          className="p-1.5 cursor-pointer hover:opacity-80"
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            borderRight: '1px solid var(--border-color)',
                            minHeight: '80px',
                            backgroundColor: isToday ? 'var(--color-primary)08' : (isWeekend ? 'var(--bg-tertiary)' : 'var(--bg-primary)'),
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold cursor-pointer hover:underline" style={{
                              color: isToday ? 'var(--color-primary)' : 'var(--text-primary)',
                            }} onClick={() => { setSelectedDate(dateStr); setTab('planning') }}>
                              {day}
                            </span>
                            {isReception && baseConfigs.length > 0 && (
                              <button
                                className="text-[8px] px-1 rounded hover:opacity-80"
                                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                onClick={(e) => { e.stopPropagation(); openOverrideDialog(dateStr) }}
                                title="Ajouter/modifier exception"
                              >+</button>
                            )}
                          </div>
                          {dayData.length === 0 && (
                            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>-</div>
                          )}
                          {dayData.map((dd) => {
                            const cfgForType = baseConfigs.find((c) => c.dock_type === dd.dock_type)
                            return (
                            <div key={dd.dock_type} className="text-[9px] flex items-center gap-1 mb-0.5 group cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); if (cfgForType) openOverrideDialog(dateStr, cfgForType.id) }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: DOCK_TYPE_COLORS[dd.dock_type] || '#737373' }} />
                              {dd.is_closed ? (
                                <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>Ferme</span>
                              ) : (
                                <span style={{ color: 'var(--text-primary)' }}>
                                  {dd.open_time?.slice(0, 5)}-{dd.close_time?.slice(0, 5)} · {dd.dock_count}q
                                  {dd.booking_count > 0 && <span style={{ color: 'var(--color-primary)' }}> · {dd.booking_count}bk</span>}
                                </span>
                              )}
                              {dd.has_override && (
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} title="Exception" />
                              )}
                            </div>
                            )
                          })}
                        </div>
                      )
                    }

                    // Cellules vides apres la fin du mois
                    const total = startOffset + daysInMonth
                    const remaining = total % 7 === 0 ? 0 : 7 - (total % 7)
                    for (let i = 0; i < remaining; i++) {
                      cells.push(<div key={`f-${i}`} style={{ borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', minHeight: '80px' }} />)
                    }

                    return cells
                  })()}
                </div>
              </div>

              {/* Legende */}
              <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {baseConfigs.map((cfg) => (
                  <div key={cfg.dock_type} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DOCK_TYPE_COLORS[cfg.dock_type] }} />
                    <span>{DOCK_TYPE_LABELS[cfg.dock_type]} ({cfg.dock_count} quais)</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                  <span>Exception</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── DIALOG: Override (exception calendrier) ─── */}
      {showOverrideDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowOverrideDialog(false)}>
          <div className="w-full max-w-md rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editOverrideId ? 'Modifier exception' : 'Nouvelle exception'}
            </h2>
            <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              {formatDateFr(ovDate)}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type de quai</label>
                <select value={ovConfigId} onChange={(e) => setOvConfigId(Number(e.target.value) || '')}
                  disabled={!!editOverrideId}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="">-- Choisir --</option>
                  {baseConfigs.map((c) => (
                    <option key={c.id} value={c.id}>{DOCK_TYPE_LABELS[c.dock_type] || c.dock_type} ({c.dock_count} quais)</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={ovClosed} onChange={(e) => setOvClosed(e.target.checked)} />
                Ferme ce jour (aucune reception)
              </label>
              {!ovClosed && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Ouverture</label>
                      <input type="time" value={ovOpenTime} onChange={(e) => setOvOpenTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        placeholder="Defaut semaine type" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fermeture</label>
                      <input type="time" value={ovCloseTime} onChange={(e) => setOvCloseTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                        placeholder="Defaut semaine type" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nombre de quais (vide = defaut)</label>
                    <input type="number" min={0} value={ovDockCount} onChange={(e) => setOvDockCount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm border"
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Motif / notes</label>
                <input type="text" value={ovNotes} onChange={(e) => setOvNotes(e.target.value)}
                  placeholder="ex: Inventaire, jour ferie..."
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-5 flex justify-between">
              <div>
                {editOverrideId && (
                  <button onClick={handleDeleteOverride}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ color: '#ef4444', border: '1px solid #ef444440' }}>
                    Supprimer
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowOverrideDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                  Annuler
                </button>
                <button onClick={handleSaveOverride}
                  disabled={saving || !ovConfigId || !ovDate}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIALOG: New Booking ─── */}
      {showBookDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowBookDialog(false)}>
          <div className="w-full max-w-md rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}>
            {(() => {
              const editedBooking = editBookingId ? bookings.find((b) => b.id === editBookingId) : null
              const readOnly = editedBooking ? !canEdit(editedBooking) : false
              return (<>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {readOnly ? 'Detail booking' : (editBookingId ? 'Modifier booking' : 'Nouveau booking')}
            </h2>
            {/* Infos statut si edition / Status info when editing */}
            {editedBooking && (
              <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: STATUS_COLORS[editedBooking.status] || '#737373' }}>
                  {STATUS_LABELS[editedBooking.status] || editedBooking.status}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {editedBooking.start_time}-{editedBooking.end_time} · {editedBooking.estimated_duration_minutes} min · {editedBooking.pallet_count} pal.
                </span>
                {editedBooking.checkin && (
                  <span className="text-xs" style={{ color: '#3b82f6' }}>
                    Plaque: {editedBooking.checkin.license_plate}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type quai <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={bkDockType} onChange={(e) => setBkDockType(e.target.value)} disabled={readOnly}
                    className="w-full px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                    {dockTypes.map((dt) => <option key={dt} value={dt}>{DOCK_TYPE_LABELS[dt]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Heure debut <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="time" step={900} value={bkStartTime} onChange={(e) => setBkStartTime(e.target.value)} disabled={readOnly}
                    className="w-full px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: !bkStartTime ? '#ef4444' : 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nb palettes <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" min={1} value={bkPallets} onChange={(e) => setBkPallets(e.target.value)} disabled={readOnly}
                    className="w-full px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    Quai {editBookingId ? '' : '(auto)'}
                  </label>
                  {editBookingId ? (
                    <div className="w-full px-3 py-2 rounded-lg text-sm border"
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                      {bkDockNum ? `Q${bkDockNum}` : 'Non assigne'}
                    </div>
                  ) : (
                    <div className="w-full px-3 py-2 rounded-lg text-sm border"
                      style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                      Attribution automatique
                    </div>
                  )}
                </div>
              </div>
              {/* Creneaux recommandes — seulement en creation / Suggested slots — create only */}
              {!editBookingId && bkPallets && Number(bkPallets) > 0 && (
                <div className="rounded-lg border p-3" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary)08' }}>
                  <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
                    Creneaux recommandes
                  </div>
                  {loadingSuggestions && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Calcul en cours...</div>
                  )}
                  {!loadingSuggestions && suggestions.length === 0 && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Aucune suggestion disponible</div>
                  )}
                  {!loadingSuggestions && suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s, i) => (
                        <button key={i}
                          onClick={() => setBkStartTime(s.start_time)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                          style={{
                            borderColor: bkStartTime === s.start_time ? 'var(--color-primary)' : 'var(--border-color)',
                            backgroundColor: bkStartTime === s.start_time ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                            color: bkStartTime === s.start_time ? 'white' : 'var(--text-primary)',
                          }}>
                          <span className="font-bold">{s.start_time}-{s.end_time}</span>
                          <span className="ml-1.5 opacity-70">Q{s.dock_number}</span>
                          <span className="ml-1.5 opacity-60">({s.reason})</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Ou choisissez un horaire libre ci-dessus
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fournisseur</label>
                <input type="text" value={bkSupplier} onChange={(e) => setBkSupplier(e.target.value)} disabled={readOnly}
                  className="w-full px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>N° commande (Rd)</label>
                <input type="text" value={bkOrderNum} onChange={(e) => setBkOrderNum(e.target.value)} disabled={readOnly}
                  className="w-full px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={bkLocked} onChange={(e) => setBkLocked(e.target.checked)} disabled={readOnly} />
                Non deplacable (risque rupture)
              </label>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea rows={2} value={bkNotes} onChange={(e) => setBkNotes(e.target.value)} disabled={readOnly}
                  className="w-full px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>

              {/* Refusal info si refuse / Refusal info if refused */}
              {editedBooking?.refusal && (
                <div className="px-3 py-2 rounded-lg border" style={{ borderColor: '#ef4444', backgroundColor: '#ef444410' }}>
                  <div className="text-xs font-medium" style={{ color: '#ef4444' }}>Motif du refus :</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{editedBooking.refusal.reason}</div>
                  {editedBooking.refusal.notes && (
                    <div className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>{editedBooking.refusal.notes}</div>
                  )}
                </div>
              )}
            </div>

            {/* Boutons actions par role / Action buttons per role */}
            {editedBooking && (
              <div className="mt-4 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
                {/* ── RECEPTION : assigner quai (CHECKED_IN → AT_DOCK) ── */}
                {isReception && editedBooking.status === 'CHECKED_IN' && (
                  <button onClick={() => { handleBookingAction(editedBooking.id, 'at-dock'); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS.AT_DOCK }}>
                    Assigner quai
                  </button>
                )}
                {/* ── RECEPTION : debut dechargement (AT_DOCK → UNLOADING) ── */}
                {isReception && editedBooking.status === 'AT_DOCK' && (
                  <button onClick={() => { handleBookingAction(editedBooking.id, 'unloading'); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS.UNLOADING }}>
                    Debut dechargement
                  </button>
                )}
                {/* ── RECEPTION : parti du quai (AT_DOCK|UNLOADING → DOCK_LEFT) ── */}
                {isReception && ['AT_DOCK', 'UNLOADING'].includes(editedBooking.status) && (
                  <button onClick={() => { handleBookingAction(editedBooking.id, 'dock-left'); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS.DOCK_LEFT }}>
                    Parti du quai
                  </button>
                )}
                {/* ── GARDE : parti du site (DOCK_LEFT → COMPLETED) ── */}
                {isGate && editedBooking.status === 'DOCK_LEFT' && (
                  <button onClick={() => { handleBookingAction(editedBooking.id, 'site-departure'); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS.COMPLETED }}>
                    Parti du site
                  </button>
                )}
                {/* ── RECEPTION : refuser (DRAFT/CONFIRMED/CHECKED_IN) ── */}
                {isReception && ['DRAFT', 'CONFIRMED', 'CHECKED_IN'].includes(editedBooking.status) && (
                  <button onClick={() => { handleBookingAction(editedBooking.id, 'refuse'); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: '#ef4444' }}>
                    Refuser
                  </button>
                )}
                {/* ── APPROS : annuler (si pas deja termine/annule/refuse) ── */}
                {isAppros && !['COMPLETED', 'CANCELLED', 'REFUSED', 'DOCK_LEFT'].includes(editedBooking.status) && (
                  <button onClick={() => { handleBookingAction(editedBooking.id, 'cancel'); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: '#6b7280', color: '#6b7280' }}>
                    Annuler
                  </button>
                )}
                {/* ── APPROS : supprimer ── */}
                {canEdit(editedBooking) && (
                  <button onClick={() => { handleDeleteBooking(editedBooking.id); setShowBookDialog(false) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium ml-auto"
                    style={{ color: '#ef4444', border: '1px solid #ef444440' }}>
                    Supprimer
                  </button>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowBookDialog(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                Fermer
              </button>
              {!readOnly && !['COMPLETED', 'CANCELLED', 'REFUSED', 'DOCK_LEFT'].includes(editedBooking?.status || '') && (
                <button onClick={handleSaveBooking}
                  disabled={saving || !bkDockType || !bkStartTime || !bkPallets}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {saving ? 'Enregistrement...' : (editBookingId ? 'Enregistrer' : 'Creer')}
                </button>
              )}
            </div>
              </>)
            })()}
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
