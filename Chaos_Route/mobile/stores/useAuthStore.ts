/* Store authentification mobile / Mobile auth store (Zustand + SecureStore) */

import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import axios from 'axios'
import type { UserMe } from '../types'
import { API_BASE_URL } from '../constants/config'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserMe | null
  isLoading: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: UserMe) => void
  logout: () => void
  loadTokens: () => Promise<void>
  /** Restaurer la session : token + user via /auth/me / Restore session: token + user via /auth/me */
  loadSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
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

  loadSession: async () => {
    try {
      const access = await SecureStore.getItemAsync('access_token')
      const refresh = await SecureStore.getItemAsync('refresh_token')
      set({ accessToken: access, refreshToken: refresh })
      if (!access) {
        set({ isLoading: false })
        return
      }
      // Re-hydrater le user via /auth/me — pas via api.ts pour eviter cycle d'interceptors
      // au boot. Si le token est expire, on logout silencieusement.
      try {
        const res = await axios.get(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${access}` },
          timeout: 8000,
        })
        set({ user: res.data })
      } catch {
        // Token invalide ou serveur injoignable : on garde le token mais pas le user
        // (le user pourra retenter ou re-login)
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))
