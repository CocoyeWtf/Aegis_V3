/* Store enregistrement appareil / Device registration store (Zustand + SecureStore) */

import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'

interface DeviceState {
  deviceId: string | null        // UUID unique du telephone
  registrationCode: string | null // Code d'enregistrement serveur
  isRegistered: boolean
  isLoading: boolean
  loadDevice: () => Promise<void>
  register: (deviceId: string, registrationCode: string) => Promise<void>
  reset: () => Promise<void>
}

export const useDeviceStore = create<DeviceState>((set) => ({
  deviceId: null,
  registrationCode: null,
  isRegistered: false,
  isLoading: true,

  loadDevice: async () => {
    try {
      const deviceId = await SecureStore.getItemAsync('device_id')
      const registrationCode = await SecureStore.getItemAsync('registration_code')
      set({
        deviceId,
        registrationCode,
        isRegistered: !!deviceId && !!registrationCode,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  register: async (deviceId: string, registrationCode: string) => {
    await SecureStore.setItemAsync('device_id', deviceId)
    await SecureStore.setItemAsync('registration_code', registrationCode)
    set({ deviceId, registrationCode, isRegistered: true })
  },

  reset: async () => {
    await SecureStore.deleteItemAsync('device_id')
    await SecureStore.deleteItemAsync('registration_code')
    set({ deviceId: null, registrationCode: null, isRegistered: false })
  },
}))

/** Generer ou recuperer l'identifiant unique du telephone / Generate or get unique device UUID */
export async function getOrCreateDeviceUUID(): Promise<string> {
  const existing = await SecureStore.getItemAsync('device_id')
  if (existing) return existing

  const uuid = Crypto.randomUUID()
  return uuid
}
