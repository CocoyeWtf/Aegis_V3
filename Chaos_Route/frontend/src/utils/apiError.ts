/* Extraction d'un message d'erreur lisible depuis une erreur axios/FastAPI.
   Readable error message extraction from an axios/FastAPI error.

   FastAPI renvoie `detail` sous forme de string (HTTPException) OU de tableau
   d'objets de validation (erreurs 422). Sans traitement, `${detail}` affiche
   "[object Object]". Cette fonction couvre les deux cas. */

interface ValidationItem {
  loc?: (string | number)[]
  msg?: string
}

export function getApiErrorMessage(e: unknown, fallback = 'Erreur inconnue'): string {
  const err = e as {
    response?: { data?: { detail?: unknown } }
    message?: string
  }
  const detail = err?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  // Erreurs de validation FastAPI (422) : tableau d'objets {loc, msg}
  if (Array.isArray(detail)) {
    const parts = (detail as ValidationItem[])
      .map((d) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((p) => p !== 'body').join('.') : ''
        return field ? `${field}: ${d.msg ?? ''}`.trim() : (d.msg ?? '')
      })
      .filter(Boolean)
    if (parts.length) return parts.join(' ; ')
  }

  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      /* ignore */
    }
  }

  return err?.message || fallback
}
