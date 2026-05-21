/* Store imprimante portable / Portable printer store.

   Persiste le choix de l'imprimante Bluetooth de l'utilisateur (adresse MAC,
   nom et protocole : ZPL pour Zebra, TSPL pour TSC).

   Persists the user's Bluetooth printer selection (MAC address, name, and
   protocol: ZPL for Zebra, TSPL for TSC).
*/

import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

export type PrinterProtocol = 'ZPL' | 'TSPL'

export interface SavedPrinter {
  address: string
  name: string
  protocol: PrinterProtocol
}

interface PrinterState {
  printer: SavedPrinter | null
  isLoading: boolean
  load: () => Promise<void>
  setPrinter: (p: SavedPrinter) => Promise<void>
  clearPrinter: () => Promise<void>
}

const STORAGE_KEY = 'cmro_printer_config'

export const usePrinterStore = create<PrinterState>((set) => ({
  printer: null,
  isLoading: true,

  load: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SavedPrinter
        if (parsed.address && parsed.name && (parsed.protocol === 'ZPL' || parsed.protocol === 'TSPL')) {
          set({ printer: parsed, isLoading: false })
          return
        }
      }
    } catch {
      // Ignore : pas de config sauvegardee ou JSON invalide
    }
    set({ printer: null, isLoading: false })
  },

  setPrinter: async (p) => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(p))
    set({ printer: p })
  },

  clearPrinter: async () => {
    await SecureStore.deleteItemAsync(STORAGE_KEY)
    set({ printer: null })
  },
}))
