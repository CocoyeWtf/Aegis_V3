/* Store authentification mobile / Mobile auth store (Zustand + SecureStore) */

import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { UserMe } from '../types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserMe | null
  isLoading: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: UserMe) => void
  logout: () => void
  loadTokens: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoading: true,

  setTokens: (access, refresh) => {
    SecureStore.setItemAsync('access_token', access)
    SecureStore.setItemAsync('refresh_token', refresh)
    set({ accessToken: access, refreshToken: refresh })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    SecureStore.deleteItemAsync('access_token')
    SecureStore.deleteItemAsync('refresh_token')
    set({ accessToken: null, refreshToken: null, user: null })
  },

  loadTokens: async () => {
    try {
      const access = await SecureStore.getItemAsync('access_token')
      const refresh = await SecureStore.getItemAsync('refresh_token')
      set({ accessToken: access, refreshToken: refresh, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },
}))
