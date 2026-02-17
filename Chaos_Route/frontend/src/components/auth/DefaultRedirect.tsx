/* Redirige vers la première page accessible si pas de permission dashboard /
/* Redirects to first accessible page if no dashboard permission */

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { getDefaultRoute } from '../../utils/getDefaultRoute'

export function DefaultRedirect({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (!user) return null

  if (!hasPermission('dashboard', 'read')) {
    const route = getDefaultRoute(user)
    if (route !== '/') {
      return <Navigate to={route} replace />
    }
  }

  return <>{children}</>
}
