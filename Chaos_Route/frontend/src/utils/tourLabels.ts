/* Calcul des labels tour par température / Tour labels by temperature class */

import type { PdvDeliveryEntry } from '../types'

const TEMP_LABELS: Record<string, string> = { SEC: 'Sec', FRAIS: 'Frais', GEL: 'Gel' }

/**
 * Génère un label par tour_id basé sur la classe température.
 * Ex: 2 tours SEC + 1 FRAIS → Map { 10: "Sec 1", 20: "Sec 2", 30: "Frais" }
 */
export function computeTourLabels(deliveries: PdvDeliveryEntry[]): Map<number, string> {
  /* Dédupliquer par tour_id, garder la première température */
  const seen = new Map<number, string>()
  for (const d of deliveries) {
    if (!seen.has(d.tour_id)) {
      seen.set(d.tour_id, d.temperature_classes?.[0] ?? 'SEC')
    }
  }

  /* Compter les occurrences par classe température */
  const countByClass = new Map<string, number>()
  for (const cls of seen.values()) {
    countByClass.set(cls, (countByClass.get(cls) ?? 0) + 1)
  }

  /* Assigner les labels avec numérotation si nécessaire */
  const indexByClass = new Map<string, number>()
  const result = new Map<number, string>()

  for (const [tourId, cls] of seen) {
    const label = TEMP_LABELS[cls] ?? cls
    const total = countByClass.get(cls) ?? 1
    if (total === 1) {
      result.set(tourId, label)
    } else {
      const idx = (indexByClass.get(cls) ?? 0) + 1
      indexByClass.set(cls, idx)
      result.set(tourId, `${label} ${idx}`)
    }
  }

  return result
}
