/* Store de gestion des tournées / Tour management store */

import { create } from 'zustand'
import type { Tour, TourStop, Volume } from '../types'

/* Identité d'un stop : le volume source (unique) si présent, sinon le PDV
   (cas reprise/pickup où il n'y a qu'un stop par PDV). Permet de retirer/
   modifier UN segment précis même quand un PDV a plusieurs volumes de même
   eqc. / Stop identity: source volume if any, else pdv_id. */
export type StopKey = Pick<TourStop, 'pdv_id' | 'volume_id'>

const stopMatchesKey = (s: TourStop, k: StopKey): boolean =>
  k.volume_id != null ? s.volume_id === k.volume_id : s.pdv_id === k.pdv_id

interface TourState {
  currentTour: Partial<Tour> | null
  currentStops: TourStop[]
  availableVolumes: Volume[]
  setCurrentTour: (tour: Partial<Tour> | null) => void
  addStop: (stop: TourStop) => void
  removeStop: (key: StopKey) => void
  reorderStops: (stops: TourStop[]) => void
  updateStop: (key: StopKey, data: Partial<TourStop>) => void
  setAvailableVolumes: (volumes: Volume[]) => void
  resetTour: () => void
}

export const useTourStore = create<TourState>((set) => ({
  currentTour: null,
  currentStops: [],
  availableVolumes: [],

  setCurrentTour: (tour) => set({ currentTour: tour }),

  addStop: (stop) =>
    set((state) => ({
      currentStops: [...state.currentStops, { ...stop, sequence_order: state.currentStops.length + 1 }],
    })),

  removeStop: (key) =>
    set((state) => ({
      currentStops: state.currentStops
        .filter((s) => !stopMatchesKey(s, key))
        .map((s, i) => ({ ...s, sequence_order: i + 1 })),
    })),

  reorderStops: (stops) => set({ currentStops: stops }),

  updateStop: (key, data) =>
    set((state) => ({
      currentStops: state.currentStops.map((s) =>
        stopMatchesKey(s, key) ? { ...s, ...data } : s
      ),
    })),

  setAvailableVolumes: (volumes) => set({ availableVolumes: volumes }),

  resetTour: () => set({ currentTour: null, currentStops: [], availableVolumes: [] }),
}))
