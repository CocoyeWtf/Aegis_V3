/* Store de la carte / Map store */

import { create } from 'zustand'

interface MapState {
  center: [number, number]
  zoom: number
  showBases: boolean
  showPdvs: boolean
  showSuppliers: boolean
  showRoutes: boolean
  showPdvLabels: boolean
  setCenter: (center: [number, number]) => void
  setZoom: (zoom: number) => void
  toggleLayer: (layer: 'showBases' | 'showPdvs' | 'showSuppliers' | 'showRoutes' | 'showPdvLabels') => void
}

export const useMapStore = create<MapState>((set) => ({
  center: [50.5, 4.35], // Belgique center
  zoom: 8,
  showBases: true,
  showPdvs: true,
  showSuppliers: true,
  showRoutes: true,
  showPdvLabels: false,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  toggleLayer: (layer) => set((state) => ({ [layer]: !state[layer] })),
}))
