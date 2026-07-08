/* Store d'authentification / Authentication store.

   STIME A4 : les jetons ne sont PLUS stockés côté JS (ni localStorage, ni
   mémoire) — ils vivent dans des cookies HttpOnly posés par le backend,
   inexfiltrables par XSS. Seul le profil utilisateur (non secret) est
   conservé pour l'UX au rechargement. */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserInfo {
  id: number
  username: string
  email: string
  is_superadmin: boolean
  must_change_password?: boolean
  mfa_enabled?: boolean
  pdv_id?: number | null
  supplier_id?: number | null
  badge_code?: string | null
  default_route?: string | null
  permissions: string[] // ["pdvs:read", "pdvs:create", ...] ou ["*:*"]
  roles: { id: number; name: string }[]
  regions: { id: number; name: string }[]
}

interface AuthState {
  user: UserInfo | null
  setUser: (user: UserInfo) => void
  logout: () => void
  hasPermission: (resource: string, action: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,

      setUser: (user) => set({ user }),

      /* Nettoyage local uniquement — la révocation serveur des jetons est
         faite par l'appel POST /auth/logout (cf. Header / api.ts). */
      logout: () => set({ user: null }),

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
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
