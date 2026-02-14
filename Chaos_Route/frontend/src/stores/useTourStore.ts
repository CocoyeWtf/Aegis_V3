/* Store de gestion des tournées / Tour management store */

import { create } from 'zustand'
import type { Tour, TourStop, Volume } from '../types'

interface TourState {
  currentTour: Partial<Tour> | null
  currentStops: TourStop[]
  availableVolumes: Volume[]
  setCurrentTour: (tour: Partial<Tour> | null) => void
  addStop: (stop: TourStop) => void
  removeStop: (pdvId: number) => void
  reorderStops: (stops: TourStop[]) => void
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

  removeStop: (pdvId) =>
    set((state) => ({
      currentStops: state.currentStops
        .filter((s) => s.pdv_id !== pdvId)
        .map((s, i) => ({ ...s, sequence_order: i + 1 })),
    })),

  reorderStops: (stops) => set({ currentStops: stops }),

  setAvailableVolumes: (volumes) => set({ availableVolumes: volumes }),

  resetTour: () => set({ currentTour: null, currentStops: [], availableVolumes: [] }),
}))
