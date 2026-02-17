/* Guard de route authentifiée / Authenticated route guard */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
