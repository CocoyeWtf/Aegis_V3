/* Image chargée via une requête AUTHENTIFIÉE (blob), pour les endpoints protégés
   par JWT + cloisonnement tenant. Un <img src="/api/..."> classique n'envoie pas
   le token → 401. On récupère donc le blob via l'instance axios (Bearer) et on
   l'affiche en object URL, révoqué au démontage. /
   Image loaded via an authenticated blob request (Bearer token). */

import { useEffect, useState } from 'react'
import api from '../../services/api'

interface AuthImageProps {
  /** Chemin RELATIF à la baseURL /api (ex. "/declarations/12/photos/3"). */
  path: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler<HTMLImageElement>
  title?: string
}

export function AuthImage({ path, alt = '', className, style, onClick, title }: AuthImageProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let alive = true
    setFailed(false)
    setUrl(null)
    api.get(path, { responseType: 'blob' })
      .then((res) => {
        if (!alive) return
        objectUrl = URL.createObjectURL(res.data as Blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path])

  if (failed) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' }} title={title}>
        ✕
      </div>
    )
  }
  if (!url) {
    return <div className={className} style={{ ...style, backgroundColor: 'var(--bg-tertiary)' }} title={title} />
  }
  return <img src={url} alt={alt} className={className} style={style} onClick={onClick} title={title} />
}
