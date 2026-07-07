/* Capture de contexte pour les tickets (la partie « intelligente ») :
   - fil d'Ariane des écrans + erreurs console + infos techniques ;
   - « dashcam » : buffer glissant des dernières interactions (clics, saisies
     MASQUÉES, navigation, erreurs, échecs réseau, notes utilisateur) pour retracer
     ce qui s'est passé AVANT le signalement — sans interroger l'utilisateur et
     sans capturer de données personnelles. /
   Context capture for tickets: breadcrumb + console errors + a rolling event
   buffer (dashcam) so a bug can be understood from what happened just before. */

interface Crumb { path: string; ts: number }
type SessionEventType = 'click' | 'input' | 'route' | 'error' | 'network' | 'note'
interface SessionEvent { ts: number; type: SessionEventType; msg: string }

const MAX_CRUMBS = 12
const MAX_ERRORS = 10
const MAX_EVENTS = 200
const SESSION_WINDOW_MS = 120_000 // fenêtre exportée : 2 min avant le signalement

const breadcrumb: Crumb[] = []
const errors: string[] = []
const events: SessionEvent[] = []
let installed = false

function pushEvent(type: SessionEventType, msg: string): void {
  const clean = (msg || '').replace(/\s+/g, ' ').trim().slice(0, 200)
  if (!clean) return
  const now = Date.now()
  const last = events[events.length - 1]
  // Dédoublonner les répétitions immédiates (clics/saisies identiques rapprochés)
  if (last && last.type === type && last.msg === clean && now - last.ts < 800) return
  events.push({ ts: now, type, msg: clean })
  if (events.length > MAX_EVENTS) events.shift()
}

/** Enregistrer un changement de route / Record a route change. */
export function recordRoute(path: string): void {
  const last = breadcrumb[breadcrumb.length - 1]
  if (last && last.path === path) return
  breadcrumb.push({ path, ts: Date.now() })
  if (breadcrumb.length > MAX_CRUMBS) breadcrumb.shift()
  pushEvent('route', path)
}

/** Enregistrer un échec réseau (appelé par l'intercepteur axios). /
    Record a failed network call (called by the axios interceptor). */
export function recordNetworkError(method: string, url: string, status: number | string): void {
  pushEvent('network', `${(method || 'get').toUpperCase()} ${url} → ${status}`)
}

/** Épingler une note utilisateur à l'instant courant (annotation multi-points). /
    Pin a user note at the current instant (multi-point annotation). */
export function recordUserNote(note: string): void {
  pushEvent('note', note)
}

function pushError(msg: string): void {
  errors.push(`${new Date().toISOString().slice(11, 19)} ${msg}`.slice(0, 300))
  if (errors.length > MAX_ERRORS) errors.shift()
  pushEvent('error', msg)
}

/* Décrire l'élément cliqué par le libellé de son contrôle (bouton/lien/onglet),
   pas de donnée personnelle. / Describe the clicked element by its control label. */
function describeClick(target: EventTarget | null): string {
  let el = target as HTMLElement | null
  const ctrl = el?.closest?.('button, a, [role="button"], [role="tab"], label, summary, option') as HTMLElement | null
  el = ctrl || el
  if (!el || !el.tagName) return ''
  const tag = el.tagName.toLowerCase()
  const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
    .replace(/\s+/g, ' ').trim().slice(0, 60)
  return label ? `${tag} « ${label} »` : tag
}

/* Décrire une saisie en MASQUANT le texte libre (RGPD) : select/checkbox/nombre/
   date → valeur (choix non sensible, utile au diagnostic) ; texte/mot de passe/
   email… → longueur seulement. / Describe an input, masking free text. */
function describeInput(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const label = (
    el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('placeholder') ||
    (el.labels && el.labels[0]?.textContent) || el.getAttribute('id') || el.tagName
  ).toString().replace(/\s+/g, ' ').trim().slice(0, 40)

  const tag = el.tagName.toLowerCase()
  if (tag === 'select') {
    const sel = el as HTMLSelectElement
    const opt = (sel.options[sel.selectedIndex]?.text || sel.value || '').trim().slice(0, 40)
    return `${label} = « ${opt} »`
  }
  const type = (el.getAttribute('type') || 'text').toLowerCase()
  if (type === 'checkbox' || type === 'radio') {
    return `${label} = ${(el as HTMLInputElement).checked ? 'coché' : 'décoché'}`
  }
  const val = String((el as HTMLInputElement).value ?? '')
  const sensitive = tag === 'textarea' || ['text', 'password', 'email', 'tel', 'search', 'url'].includes(type)
  return sensitive ? `${label} = (${val.length} car.)` : `${label} = ${val.slice(0, 40)}`
}

/** Installer la capture globale (erreurs + interactions), une seule fois. /
    Install global capture (errors + interactions) once. */
export function installErrorCapture(): void {
  if (installed) return
  installed = true

  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    try { pushError(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')) } catch { /* ignore */ }
    origError(...args)
  }
  window.addEventListener('error', (e) => pushError(`window.error: ${e.message}`))
  window.addEventListener('unhandledrejection', (e) => pushError(`unhandledrejection: ${String((e as PromiseRejectionEvent).reason)}`))

  // Dashcam : capture passive des interactions (phase de capture) /
  // Dashcam: passive interaction capture (capture phase)
  document.addEventListener('click', (e) => {
    try { pushEvent('click', describeClick(e.target)) } catch { /* ignore */ }
  }, { capture: true })
  document.addEventListener('change', (e) => {
    try {
      const el = e.target as HTMLElement | null
      if (el && /^(input|select|textarea)$/i.test(el.tagName)) {
        pushEvent('input', describeInput(el as HTMLInputElement))
      }
    } catch { /* ignore */ }
  }, { capture: true })
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
  session: { ago_s: number; type: string; msg: string }[]
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
    session: events
      .filter((e) => now - e.ts <= SESSION_WINDOW_MS)
      .map((e) => ({ ago_s: Math.round((now - e.ts) / 1000), type: e.type, msg: e.msg })),
    region_id: extra?.region_id ?? null,
    country_id: extra?.country_id ?? null,
    captured_at: new Date().toISOString(),
  }
}
