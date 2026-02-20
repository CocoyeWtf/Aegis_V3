/* Utilitaires calcul de retard / Delay calculation utilities */

import type { Tour, TourStop } from '../types'
import { parseTime, formatTime } from './tourTimeUtils'

/* --- Retard / Delay --- */

/** Retard en minutes (0 si pas de retard ou données manquantes) / Delay in minutes */
export function getDelayMinutes(tour: Tour): number {
  if (!tour.barrier_exit_time || !tour.departure_time) return 0
  const exit = parseTime(tour.barrier_exit_time)
  const planned = parseTime(tour.departure_time)
  return Math.max(0, exit - planned)
}

export type DelayLevel = 'on_time' | 'warning' | 'critical'

export function getDelayLevel(delayMinutes: number): DelayLevel {
  if (delayMinutes <= 0) return 'on_time'
  if (delayMinutes <= 15) return 'warning'
  return 'critical'
}

export const DELAY_COLORS: Record<DelayLevel, string> = {
  on_time: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
}

/* --- Tour enrichi / Enriched tour --- */

export interface EstimatedStop extends TourStop {
  estimated_arrival: string | null
  estimated_departure: string | null
}

export interface TourWithDelay extends Tour {
  delay_minutes: number
  delay_level: DelayLevel
  estimated_stops: EstimatedStop[]
  estimated_return: string | null
  actual_departure: string | null
}

function addMinutes(time: string | undefined | null, delta: number): string | null {
  if (!time) return null
  return formatTime(parseTime(time) + delta)
}

/** Calculer retard et heures estimées pour un tour / Compute delay and estimated times */
export function computeTourDelay(tour: Tour): TourWithDelay {
  const delay = getDelayMinutes(tour)
  const level = getDelayLevel(delay)

  const estimated_stops: EstimatedStop[] = tour.stops.map((stop) => ({
    ...stop,
    estimated_arrival: delay > 0 ? addMinutes(stop.arrival_time, delay) : (stop.arrival_time ?? null),
    estimated_departure: delay > 0 ? addMinutes(stop.departure_time, delay) : (stop.departure_time ?? null),
  }))

  return {
    ...tour,
    delay_minutes: delay,
    delay_level: level,
    estimated_stops,
    estimated_return: delay > 0 ? addMinutes(tour.return_time, delay) : (tour.return_time ?? null),
    actual_departure: tour.barrier_exit_time || tour.departure_time || null,
  }
}

/* --- Impact 2e tour / Second tour impact --- */

export interface TourImpact {
  delayedTour: TourWithDelay
  impactedTour: TourWithDelay
  overlapMinutes: number
}

/** Détecter les impacts de retard sur le 2e tour du même contrat / Detect delay cascade */
export function detectSecondTourImpacts(tours: TourWithDelay[]): TourImpact[] {
  const impacts: TourImpact[] = []

  // Grouper par contrat / Group by contract
  const byContract = new Map<number, TourWithDelay[]>()
  for (const t of tours) {
    if (t.contract_id == null) continue
    const list = byContract.get(t.contract_id) || []
    list.push(t)
    byContract.set(t.contract_id, list)
  }

  for (const [, contractTours] of byContract) {
    if (contractTours.length < 2) continue
    contractTours.sort((a, b) => (parseTime(a.departure_time!) || 0) - (parseTime(b.departure_time!) || 0))

    for (let i = 0; i < contractTours.length - 1; i++) {
      const current = contractTours[i]
      const next = contractTours[i + 1]
      if (current.delay_minutes <= 0 || !current.estimated_return || !next.departure_time) continue

      const estReturn = parseTime(current.estimated_return)
      const nextDeparture = parseTime(next.departure_time)
      if (estReturn > nextDeparture) {
        impacts.push({
          delayedTour: current,
          impactedTour: next,
          overlapMinutes: estReturn - nextDeparture,
        })
      }
    }
  }

  return impacts
}
