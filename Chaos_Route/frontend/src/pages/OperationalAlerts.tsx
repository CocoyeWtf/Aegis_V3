/* Page Alertes Operationnelles / Operational Alerts page */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface AlertComment {
  id: number
  user_name: string | null
  text: string
  created_at: string | null
}

interface Alert {
  id: number
  alert_type: string
  status: string
  priority: string
  title: string
  message: string | null
  tour_code: string | null
  pdv_code: string | null
  date: string | null
  freed_eqp: number | null
  created_by_name: string | null
  created_at: string | null
  resolved_by_name: string | null
  resolved_at: string | null
  comments: AlertComment[]
}

const STATUS_LABELS: Record<string, string> = { PENDING: 'En attente', ACKNOWLEDGED: 'Pris en charge', RESOLVED: 'Résolu' }
const STATUS_COLORS: Record<string, string> = { PENDING: '#ef4444', ACKNOWLEDGED: '#f59e0b', RESOLVED: '#22c55e' }
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute' }
const TYPE_LABELS: Record<string, string> = {
  VOLUMES_RELEASED: 'Volumes libérés',
  STOP_ADDED: 'PDV ajouté',
  TOUR_MODIFIED: 'Tour modifié',
  CAPACITY_WARNING: 'Capacité',
  DELIVERY_WINDOW: 'Fenêtre livraison',
  CUSTOM: 'Manuel',
}

function formatDT(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export default function OperationalAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (filter) params.status = filter
      const { data } = await api.get<Alert[]>('/alerts/', { params })
      setAlerts(data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleAcknowledge = async (id: number) => {
    await api.put(`/alerts/${id}/acknowledge`)
    await load()
  }

  const handleResolve = async (id: number) => {
    await api.put(`/alerts/${id}/resolve`)
    await load()
  }

  const handleAddComment = async (id: number) => {
    const text = commentText[id]?.trim()
    if (!text) return
    await api.post(`/alerts/${id}/comments`, { text })
    setCommentText((prev) => ({ ...prev, [id]: '' }))
    await load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Alertes opérationnelles</h1>
        <div className="flex gap-2">
          {['', 'PENDING', 'ACKNOWLEDGED', 'RESOLVED'].map((s) => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filter === s ? 'text-white' : ''}`}
              style={{
                backgroundColor: filter === s ? (STATUS_COLORS[s] || 'var(--color-primary)') : 'var(--bg-secondary)',
                borderColor: STATUS_COLORS[s] || 'var(--border-color)',
                color: filter === s ? '#fff' : 'var(--text-secondary)',
              }}
              onClick={() => setFilter(s)}
            >
              {s === '' ? 'Toutes' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Chargement...</p>
      ) : alerts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Aucune alerte.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: alert.status === 'PENDING' ? '#ef444460' : 'var(--border-color)',
                borderLeftWidth: 4,
                borderLeftColor: STATUS_COLORS[alert.status] || 'var(--border-color)',
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase mr-2"
                    style={{ backgroundColor: `${STATUS_COLORS[alert.status]}20`, color: STATUS_COLORS[alert.status] }}
                  >
                    {STATUS_LABELS[alert.status]}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded mr-2" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {TYPE_LABELS[alert.alert_type] || alert.alert_type}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {PRIORITY_LABELS[alert.priority]}
                  </span>
                </div>
                <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {formatDT(alert.created_at)}
                </span>
              </div>

              {/* Titre + message */}
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{alert.title}</h3>
              {alert.message && <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{alert.message}</p>}

              {/* Contexte */}
              <div className="flex flex-wrap gap-3 text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
                {alert.tour_code && <span>Tour: <strong style={{ color: 'var(--text-primary)' }}>{alert.tour_code}</strong></span>}
                {alert.pdv_code && <span>PDV: <strong style={{ color: 'var(--text-primary)' }}>{alert.pdv_code}</strong></span>}
                {alert.date && <span>Date: {alert.date}</span>}
                {alert.freed_eqp != null && <span>EQC libérés: <strong style={{ color: 'var(--color-danger)' }}>{alert.freed_eqp}</strong></span>}
                {alert.created_by_name && <span>Par: {alert.created_by_name}</span>}
                {alert.resolved_by_name && <span>Résolu par: {alert.resolved_by_name} ({formatDT(alert.resolved_at)})</span>}
              </div>

              {/* Commentaires */}
              {alert.comments.length > 0 && (
                <div className="mb-3 space-y-1">
                  {alert.comments.map((c) => (
                    <div key={c.id} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{c.user_name || 'Système'}</span>
                      <span className="ml-2" style={{ color: 'var(--text-muted)' }}>{formatDT(c.created_at)}</span>
                      <p className="mt-0.5" style={{ color: 'var(--text-primary)' }}>{c.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                {alert.status === 'PENDING' && (
                  <button
                    className="text-[10px] px-2 py-1 rounded border font-semibold transition-all hover:opacity-80"
                    style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    Prendre en charge
                  </button>
                )}
                {alert.status !== 'RESOLVED' && (
                  <button
                    className="text-[10px] px-2 py-1 rounded border font-semibold transition-all hover:opacity-80"
                    style={{ borderColor: '#22c55e', color: '#22c55e' }}
                    onClick={() => handleResolve(alert.id)}
                  >
                    Résoudre
                  </button>
                )}
                <div className="flex-1 flex gap-1">
                  <input
                    type="text"
                    value={commentText[alert.id] || ''}
                    onChange={(e) => setCommentText((prev) => ({ ...prev, [alert.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(alert.id)}
                    placeholder="Ajouter un commentaire..."
                    className="flex-1 px-2 py-1 rounded border text-xs"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                  <button
                    className="text-[10px] px-2 py-1 rounded font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    onClick={() => handleAddComment(alert.id)}
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
