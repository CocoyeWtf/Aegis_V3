/* Déterminer la première route accessible selon les permissions /
/* Determine the first accessible route based on user permissions */

import type { UserInfo } from '../stores/useAuthStore'

const routePermissions: { path: string; resource: string }[] = [
  { path: '/', resource: 'dashboard' },
  { path: '/countries', resource: 'countries' },
  { path: '/bases', resource: 'bases' },
  { path: '/pdvs', resource: 'pdvs' },
  { path: '/suppliers', resource: 'suppliers' },
  { path: '/volumes', resource: 'volumes' },
  { path: '/contracts', resource: 'contracts' },
  { path: '/distances', resource: 'distances' },
  { path: '/base-activities', resource: 'base-activities' },
  { path: '/parameters', resource: 'parameters' },
  { path: '/tour-planning', resource: 'tour-planning' },
  { path: '/tour-history', resource: 'tour-history' },
  { path: '/admin/users', resource: 'users' },
  { path: '/admin/roles', resource: 'roles' },
]

function userHasPermission(user: UserInfo, resource: string, action: string): boolean {
  if (user.is_superadmin) return true
  if (user.permissions.includes('*:*')) return true
  return user.permissions.includes(`${resource}:${action}`)
}

export function getDefaultRoute(user: UserInfo): string {
  for (const r of routePermissions) {
    if (userHasPermission(user, r.resource, 'read')) {
      return r.path
    }
  }
  return '/'
}
