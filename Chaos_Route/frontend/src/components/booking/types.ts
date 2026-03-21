/* Types et constantes du module booking / Booking module types and constants */

export interface Base { id: number; code: string; name: string }

export interface DockSchedule {
  id: number; dock_config_id: number; day_of_week: number
  open_time: string; close_time: string
}

export interface DockConfig {
  id: number; base_id: number; dock_type: string; dock_count: number
  pallets_per_hour: number; setup_minutes: number; departure_minutes: number
  schedules: DockSchedule[]; base_name?: string
}

export interface BookingOrder {
  id: number; booking_id: number; order_number: string
  pallet_count?: number; supplier_name?: string; reconciled: boolean
  delivery_date_required?: string; delivery_time_requested?: string
}

export interface BookingCheckin {
  id: number; booking_id: number; license_plate: string
  phone_number: string; driver_name?: string; checkin_time: string
}

export interface BookingRefusal {
  id: number; booking_id: number; reason: string
  refused_by_user_id: number; timestamp: string; notes?: string
}

export interface DockScheduleOverride {
  id: number; dock_config_id: number; override_date: string
  is_closed: boolean; open_time?: string; close_time?: string
  dock_count?: number; notes?: string
}

export interface DayAvailability {
  date: string; dock_type: string; is_closed: boolean
  open_time?: string; close_time?: string; dock_count: number
  has_override: boolean; booking_count: number; pallet_total: number
}

export interface Booking {
  id: number; base_id: number; dock_type: string; dock_number?: number
  booking_date: string; start_time: string; end_time: string
  pallet_count: number; estimated_duration_minutes: number
  status: string; is_locked: boolean; supplier_name?: string
  temperature_type?: string; notes?: string; created_by_user_id?: number
  is_pickup: boolean; pickup_date?: string; pickup_address?: string
  pickup_status?: string; carrier_id?: number; carrier_name?: string
  carrier_price?: number; carrier_ref?: string; pickup_notes?: string
  is_internal_fleet?: boolean
  orders: BookingOrder[]; checkin?: BookingCheckin; refusal?: BookingRefusal
}

export interface SuggestedSlot {
  start_time: string; end_time: string; dock_number: number
  score: number; reason: string
}

export interface DockColumn { dockType: string; dockNumber: number; label: string; color: string }

export const DOCK_TYPE_LABELS: Record<string, string> = {
  SEC: 'Sec', FRAIS: 'Frais', GEL: 'Gel', FFL: 'FFL',
}
export const DOCK_TYPE_COLORS: Record<string, string> = {
  SEC: '#a3a3a3', FRAIS: '#3b82f6', GEL: '#8b5cf6', FFL: '#22c55e',
}
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Planifie', CONFIRMED: 'Confirme', CHECKED_IN: 'Arrive sur site',
  AT_DOCK: 'A quai', UNLOADING: 'Dechargement', DOCK_LEFT: 'Parti du quai',
  COMPLETED: 'Parti du site', CANCELLED: 'Annule',
  REFUSED: 'Refuse', NO_SHOW: 'Absent',
}
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#737373', CONFIRMED: '#f97316', CHECKED_IN: '#3b82f6',
  AT_DOCK: '#f59e0b', UNLOADING: '#a855f7', DOCK_LEFT: '#06b6d4',
  COMPLETED: '#22c55e', CANCELLED: '#6b7280',
  REFUSED: '#ef4444', NO_SHOW: '#ef4444',
}
export const PICKUP_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', ASSIGNED: 'Transporteur assigne', PICKED_UP: 'Enleve',
  IN_TRANSIT: 'En transit', DELIVERED: 'Livre sur base', CANCELLED: 'Annule',
}
export const PICKUP_STATUS_COLORS: Record<string, string> = {
  PENDING: '#737373', ASSIGNED: '#f97316', PICKED_UP: '#3b82f6',
  IN_TRANSIT: '#a855f7', DELIVERED: '#22c55e', CANCELLED: '#6b7280',
}
export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
export const MONTH_NAMES = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']

export function timeToMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export function minutesToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }

export function formatDateFr(dateStr: string) {
  const d = new Date(dateStr)
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}
