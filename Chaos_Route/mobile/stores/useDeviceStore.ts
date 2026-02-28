/* Store enregistrement appareil / Device registration store (Zustand + SecureStore) */

import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import api from '../services/api'

interface DeviceState {
  deviceId: string | null        // UUID unique du telephone
  registrationCode: string | null // Code d'enregistrement serveur
  friendlyName: string | null    // Nom de l'appareil (depuis le serveur)
  baseName: string | null        // Nom de la base logistique
  isRegistered: boolean
  isLoading: boolean
  loadDevice: () => Promise<void>
  register: (deviceId: string, registrationCode: string) => Promise<void>
  fetchDeviceInfo: () => Promise<void>
  reset: () => Promise<void>
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  deviceId: null,
  registrationCode: null,
  friendlyName: null,
  baseName: null,
  isRegistered: false,
  isLoading: true,

  loadDevice: async () => {
    try {
      const deviceId = await SecureStore.getItemAsync('device_id')
      const registrationCode = await SecureStore.getItemAsync('registration_code')
      const friendlyName = await SecureStore.getItemAsync('friendly_name')
      const baseName = await SecureStore.getItemAsync('base_name')
      const isRegistered = !!deviceId && !!registrationCode
      set({
        deviceId,
        registrationCode,
        friendlyName,
        baseName,
        isRegistered,
        isLoading: false,
      })
      // Rafraichir depuis le serveur si enregistre / Refresh from server if registered
      if (isRegistered) {
        get().fetchDeviceInfo()
      }
    } catch {
      set({ isLoading: false })
    }
  },

  register: async (deviceId: string, registrationCode: string) => {
    await SecureStore.setItemAsync('device_id', deviceId)
    await SecureStore.setItemAsync('registration_code', registrationCode)
    set({ deviceId, registrationCode, isRegistered: true })
  },

  fetchDeviceInfo: async () => {
    try {
      const { data } = await api.get('/driver/device-info')
      const friendlyName = data.friendly_name || null
      const baseName = data.base_name || null
      // Persister localement / Persist locally
      if (friendlyName) await SecureStore.setItemAsync('friendly_name', friendlyName)
      else await SecureStore.deleteItemAsync('friendly_name')
      if (baseName) await SecureStore.setItemAsync('base_name', baseName)
      else await SecureStore.deleteItemAsync('base_name')
      set({ friendlyName, baseName })
    } catch {
      // Silencieux — utiliser le cache local / Silent — use local cache
    }
  },

  reset: async () => {
    await SecureStore.deleteItemAsync('device_id')
    await SecureStore.deleteItemAsync('registration_code')
    await SecureStore.deleteItemAsync('friendly_name')
    await SecureStore.deleteItemAsync('base_name')
    set({ deviceId: null, registrationCode: null, friendlyName: null, baseName: null, isRegistered: false })
  },
}))

/** Generer ou recuperer l'identifiant unique du telephone / Generate or get unique device UUID */
export async function getOrCreateDeviceUUID(): Promise<string> {
  const existing = await SecureStore.getItemAsync('device_id')
  if (existing) return existing

  const uuid = Crypto.randomUUID()
  return uuid
}
