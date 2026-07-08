/* Guard de route authentifiée / Authenticated route guard.
   Les jetons sont en cookies HttpOnly (invisibles au JS) : la présence du
   profil utilisateur sert de signal de session ; une session expirée sera
   rattrapée par le refresh silencieux ou le retour au login sur 401. */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
