/* Utilitaires temps pour tours / Tour time utility helpers */

export const DEFAULT_DOCK_TIME = 15
export const DEFAULT_UNLOAD_PER_EQP = 2  // minutes par EQC / minutes per EQC (nom hérité)

/* Facteur de conversion : 1 EQP = 1.64 EQC / Conversion factor: 1 EQP = 1.64 EQC */
export const EQC_PER_EQP = 1.64

export interface StopTimeline {
  pdv_id: number
  arrival_time: string
  departure_time: string
  travel_minutes: number
  unload_minutes: number
  distance_km: number
}

/* Convertir HH:MM ou YYYY-MM-DDTHH:MM en minutes / Convert HH:MM or datetime to minutes */
export function parseTime(t: string): number {
  const timePart = t.includes('T') ? t.split('T')[1] : t
  const [h, m] = timePart.split(':').map(Number)
  return h * 60 + m
}

/* Afficher un datetime ou HH:MM de façon lisible / Display datetime or HH:MM in readable format */
export function displayDateTime(dt: string | undefined | null): string {
  if (!dt) return '—'
  if (dt.includes('T')) {
    const [date, time] = dt.split('T')
    const [, month, day] = date.split('-')
    return `${day}/${month} ${time}`
  }
  return dt
}

/* Générer le datetime-local courant / Generate current datetime-local value */
export function nowDateTimeLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da}T${h}:${mi}`
}

/* Convertir minutes en HH:MM / Convert minutes to HH:MM */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/* Formater une durée en Xh ou XhMM / Format duration as Xh or XhMM */
export function formatDuration(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}
