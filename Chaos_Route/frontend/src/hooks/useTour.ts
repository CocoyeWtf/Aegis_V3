/* Hook pour la gestion des tournées / Tour management hook */

import { useTourStore } from '../stores/useTourStore'

export function useTour() {
  const store = useTourStore()

  const totalEqp = store.currentStops.reduce((sum, s) => sum + s.eqp_count, 0)

  const canAddVolume = (eqpCount: number, vehicleCapacity: number) => {
    return totalEqp + eqpCount <= vehicleCapacity
  }

  return {
    ...store,
    totalEqp,
    canAddVolume,
  }
}
