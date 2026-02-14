/* Store de la carte / Map store */

import { create } from 'zustand'

interface MapState {
  center: [number, number]
  zoom: number
  showBases: boolean
  showPdvs: boolean
  showSuppliers: boolean
  showRoutes: boolean
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
  toggleLayer: (layer: 'showBases' | 'showPdvs' | 'showSuppliers' | 'showRoutes') => void
}

export const useMapStore = create<MapState>((set) => ({
  center: [46.603354, 1.888334], // France center
  zoom: 6,
  showBases: true,
  showPdvs: true,
  showSuppliers: true,
  showRoutes: true,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  toggleLayer: (layer) => set((state) => ({ [layer]: !state[layer] })),
}))
