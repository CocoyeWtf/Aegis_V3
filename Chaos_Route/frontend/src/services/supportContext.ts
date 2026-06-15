/* Capture de contexte pour les tickets (la partie « intelligente ») :
   fil d'Ariane des dernières actions/écrans + erreurs console + infos techniques,
   pour comprendre le bug sans interroger l'utilisateur. /
   Context capture for tickets: breadcrumb of recent screens + console errors +
   technical info, so a bug can be understood without quizzing the user. */

interface Crumb { path: string; ts: number }

const MAX_CRUMBS = 12
const MAX_ERRORS = 10

const breadcrumb: Crumb[] = []
const errors: string[] = []
let installed = false

/** Enregistrer un changement de route / Record a route change. */
export function recordRoute(path: string): void {
  const last = breadcrumb[breadcrumb.length - 1]
  if (last && last.path === path) return
  breadcrumb.push({ path, ts: Date.now() })
  if (breadcrumb.length > MAX_CRUMBS) breadcrumb.shift()
}

/** Installer la capture globale des erreurs (une seule fois) / Install global error capture once. */
export function installErrorCapture(): void {
  if (installed) return
  installed = true
  const push = (msg: string) => {
    errors.push(`${new Date().toISOString().slice(11, 19)} ${msg}`.slice(0, 300))
    if (errors.length > MAX_ERRORS) errors.shift()
  }
  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try { push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')) } catch { /* ignore */ }
    origError(...args)
  }
  window.addEventListener('error', (e) => push(`window.error: ${e.message}`))
  window.addEventListener('unhandledrejection', (e) => push(`unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`))
}

export interface SupportContext {
  route: string
  app_version: string
  user_agent: string
  platform: string
  language: string
  screen: string
  breadcrumb: { path: string; ago_s: number }[]
  recent_errors: string[]
  region_id?: number | null
  country_id?: number | null
  captured_at: string
}

/** Construire l'objet de contexte joint au ticket / Build the context object. */
export function captureContext(extra?: { region_id?: number | null; country_id?: number | null }): SupportContext {
  const now = Date.now()
  return {
    route: window.location.pathname + window.location.search,
    app_version: (import.meta.env.VITE_APP_VERSION as string) || 'web',
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    breadcrumb: breadcrumb.map((c) => ({ path: c.path, ago_s: Math.round((now - c.ts) / 1000) })),
    recent_errors: [...errors],
    region_id: extra?.region_id ?? null,
    country_id: extra?.country_id ?? null,
    captured_at: new Date().toISOString(),
  }
}
