/* Redirige vers la première page accessible si pas de permission dashboard /
/* Redirects to first accessible page if no dashboard permission */

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { getDefaultRoute } from '../../utils/getDefaultRoute'

export function DefaultRedirect({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)

  if (!user) return null

  /* Rediriger vers la route par defaut configurée ou la première accessible */
  if (user.default_route) {
    return <Navigate to={user.default_route} replace />
  }

  if (!hasPermission('dashboard', 'read')) {
    const route = getDefaultRoute(user)
    if (route !== '/') {
      return <Navigate to={route} replace />
    }
  }

  return <>{children}</>
}
