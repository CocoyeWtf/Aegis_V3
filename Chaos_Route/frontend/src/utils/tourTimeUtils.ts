/* Utilitaires temps pour tours / Tour time utility helpers */

export const DEFAULT_DOCK_TIME = 10
export const DEFAULT_UNLOAD_PER_EQP = 3

export interface StopTimeline {
  pdv_id: number
  arrival_time: string
  departure_time: string
  travel_minutes: number
  unload_minutes: number
  distance_km: number
}

/* Convertir HH:MM en minutes / Convert HH:MM to minutes */
export function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
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
