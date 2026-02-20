/* Store d'authentification / Authentication store */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserInfo {
  id: number
  username: string
  email: string
  is_superadmin: boolean
  pdv_id?: number | null
  permissions: string[] // ["pdvs:read", "pdvs:create", ...] ou ["*:*"]
  roles: { id: number; name: string }[]
  regions: { id: number; name: string }[]
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserInfo | null
  setTokens: (access: string, refresh: string) => void
  setUser: (user: UserInfo) => void
  logout: () => void
  hasPermission: (resource: string, action: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),

      setUser: (user) => set({ user }),

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),

      hasPermission: (resource, action) => {
        const { user } = get()
        if (!user) return false
        if (user.is_superadmin) return true
        if (user.permissions.includes('*:*')) return true
        return user.permissions.includes(`${resource}:${action}`)
      },
    }),
    {
      name: 'chaos-route-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
)
