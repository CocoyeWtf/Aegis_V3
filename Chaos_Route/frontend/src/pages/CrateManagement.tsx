/* Page gestion demandes de casiers — service vidange / base / Crate request management page */

import { useState, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import api from '../services/api'

interface CrateType {
  id: number
  code: string
  name: string
  format: string
  brand: string | null
}

interface CrateRequest {
  id: number
  pdv_id: number
  crate_type_id: number
  quantity: number
  status: string
  notes: string | null
  requested_at: string
  ordered_at: string | null
  delivered_at: string | null
  pdv: { id: number; code: string; name: string } | null
  crate_type: CrateType | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  REQUESTED: { bg: '#f59e0b', text: '#000' },
  ORDERED: { bg: '#3b82f6', text: '#fff' },
  DELIVERED: { bg: '#22c55e', text: '#fff' },
  CANCELLED: { bg: '#6b7280', text: '#fff' },
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Demande',
  ORDERED: 'Commande',
  DELIVERED: 'Livre',
  CANCELLED: 'Annule',
}

const FORMAT_LABELS: Record<string, string> = {
  '25CL': '25 cl',
  '33CL': '33 cl',
  '75CL': '75 cl',
  '1L': '1 L',
  'FUT6L': 'Fut 6L',
  'OTHER': 'Autre',
}

export default function CrateManagement() {
  const [filterStatus, setFilterStatus] = useState<string>('')

  const params = filterStatus ? { status: filterStatus } : {}
  const { data: requests, refetch } = useApi<CrateRequest>('/crate-requests', params)

  const handleStatusChange = useCallback(async (id: number, newStatus: string) => {
    try {
      await api.put(`/crate-requests/${id}/status`, { status: newStatus })
      refetch()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }, [refetch])

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleDateString('fr-FR') } catch { return iso }
  }

  // Stats
  const requested = requests.filter((r) => r.status === 'REQUESTED').length
  const ordered = requests.filter((r) => r.status === 'ORDERED').length

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Gestion demandes de casiers
      </h1>

      {/* Stats rapides */}
      <div className="flex gap-4">
        <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{requested}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>A traiter</div>
        </div>
        <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{ordered}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Commandees</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>PDV</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Casier</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Format</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Qte</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Demande</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Commande</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Livre</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Notes</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucune demande
                </td>
              </tr>
            )}
            {requests.map((req) => {
              const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.REQUESTED
              return (
                <tr key={req.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.pdv ? `${req.pdv.code} - ${req.pdv.name}` : req.pdv_id}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.crate_type?.name || req.crate_type_id}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {req.crate_type ? FORMAT_LABELS[req.crate_type.format] || req.crate_type.format : ''}
                  </td>
                  <td className="text-center px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                    {req.quantity}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(req.requested_at)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(req.ordered_at)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(req.delivered_at)}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {req.notes || '—'}
                  </td>
                  <td className="text-center px-4 py-3">
                    <div className="flex gap-1 justify-center">
                      {req.status === 'REQUESTED' && (
                        <>
                          <button onClick={() => handleStatusChange(req.id, 'ORDERED')}
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                            Commander
                          </button>
                          <button onClick={() => handleStatusChange(req.id, 'CANCELLED')}
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            Annuler
                          </button>
                        </>
                      )}
                      {req.status === 'ORDERED' && (
                        <button onClick={() => handleStatusChange(req.id, 'DELIVERED')}
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                          Livre
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
