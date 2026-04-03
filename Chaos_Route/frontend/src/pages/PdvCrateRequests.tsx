/* Page demandes de casiers PDV / PDV crate requests page */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuthStore } from '../stores/useAuthStore'
import api from '../services/api'

interface CrateType {
  id: number
  code: string
  name: string
  format: string
  brand: string | null
  sorting_rule: string
  is_active: boolean
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

export default function PdvCrateRequests() {
  const user = useAuthStore((s) => s.user)
  const isPdvUser = !!user?.pdv_id

  // Charger les types de casiers actifs
  const [crateTypes, setCrateTypes] = useState<CrateType[]>([])
  useEffect(() => {
    api.get('/crate-requests/types', { params: { active_only: true } })
      .then(({ data }) => setCrateTypes(data))
      .catch(() => {})
  }, [])

  // Filtres
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterFormat, setFilterFormat] = useState<string>('')

  const requestParams = {
    ...(isPdvUser && user?.pdv_id ? { pdv_id: user.pdv_id } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
  } as Record<string, unknown>

  const { data: requests, refetch } = useApi<CrateRequest>('/crate-requests', requestParams)

  // Formulaire
  const [crateTypeId, setCrateTypeId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Recherche PDV (mode dispatcher)
  const [pdvs, setPdvs] = useState<{ id: number; code: string; name: string }[]>([])
  const [pdvId, setPdvId] = useState<string>('')
  const [pdvSearch, setPdvSearch] = useState('')
  const [pdvDropdownOpen, setPdvDropdownOpen] = useState(false)

  useEffect(() => {
    if (!isPdvUser) {
      api.get('/crate-requests/types', { params: { active_only: true } })
        .then(() => {
          // Charger la liste des PDVs pour le dispatcher
          api.get('/pdvs/').then(({ data }) => {
            setPdvs(data.map((p: any) => ({ id: p.id, code: p.code, name: p.name })))
          }).catch(() => {})
        })
        .catch(() => {})
    }
  }, [isPdvUser])

  const selectedPdv = pdvs.find((p) => String(p.id) === pdvId)
  const filteredPdvs = useMemo(() => {
    if (!pdvSearch.trim()) return pdvs
    const q = pdvSearch.toLowerCase()
    return pdvs.filter((p) => p.code?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q))
  }, [pdvs, pdvSearch])

  // Types filtres par format
  const filteredCrateTypes = useMemo(() => {
    if (!filterFormat) return crateTypes
    return crateTypes.filter((ct) => ct.format === filterFormat)
  }, [crateTypes, filterFormat])

  const formats = useMemo(() => [...new Set(crateTypes.map((ct) => ct.format))], [crateTypes])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const finalPdvId = isPdvUser ? user!.pdv_id : Number(pdvId)
    if (!finalPdvId || !crateTypeId) return

    setSubmitting(true)
    try {
      await api.post('/crate-requests/', {
        pdv_id: finalPdvId,
        crate_type_id: Number(crateTypeId),
        quantity,
        notes: notes || null,
      })
      setCrateTypeId('')
      setQuantity(1)
      setNotes('')
      setPdvId('')
      setPdvSearch('')
      refetch()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    } finally {
      setSubmitting(false)
    }
  }, [isPdvUser, user, pdvId, crateTypeId, quantity, notes, refetch])

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleDateString('fr-FR') } catch { return iso }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Demandes de casiers
      </h1>

      {/* Formulaire de creation */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border p-4 space-y-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Nouvelle demande
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PDV (mode dispatcher) */}
          {!isPdvUser && (
            <div className="relative">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                PDV *
              </label>
              <input type="hidden" required value={pdvId} />
              <input
                type="text"
                value={pdvDropdownOpen ? pdvSearch : selectedPdv ? `${selectedPdv.code} - ${selectedPdv.name}` : ''}
                onChange={(e) => { setPdvSearch(e.target.value); setPdvDropdownOpen(true); if (pdvId) setPdvId('') }}
                onFocus={() => { setPdvDropdownOpen(true); setPdvSearch('') }}
                placeholder="Rechercher..."
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              {pdvDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-lg"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                  {filteredPdvs.slice(0, 50).map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => { setPdvId(String(p.id)); setPdvSearch(''); setPdvDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm hover:brightness-125 cursor-pointer"
                      style={{ color: 'var(--text-primary)' }}>
                      <span className="font-medium">{p.code}</span> <span className="ml-2">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Format (filtre rapide) */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Format
            </label>
            <select
              value={filterFormat}
              onChange={(e) => { setFilterFormat(e.target.value); setCrateTypeId('') }}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="">Tous formats</option>
              {formats.map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f] || f}</option>
              ))}
            </select>
          </div>

          {/* Type de casier */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Type de casier *
            </label>
            <select
              value={crateTypeId}
              onChange={(e) => setCrateTypeId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="">-- Selectionner --</option>
              {(filterFormat ? filteredCrateTypes : crateTypes).map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name} ({FORMAT_LABELS[ct.format] || ct.format})
                </option>
              ))}
            </select>
          </div>

          {/* Quantite */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Quantite (casiers)
            </label>
            <input
              type="number" min={1} max={999} value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Notes (optionnel)
          </label>
          <input
            type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complementaires..."
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        <button type="submit" disabled={submitting}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}>
          {submitting ? 'Envoi...' : 'Creer la demande'}
        </button>
      </form>

      {/* Filtres liste */}
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

      {/* Liste des demandes */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              {!isPdvUser && (
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>PDV</th>
              )}
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Casier</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Format</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Qte</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Demande le</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={isPdvUser ? 6 : 7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucune demande
                </td>
              </tr>
            )}
            {requests.map((req) => {
              const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.REQUESTED
              return (
                <tr key={req.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                  {!isPdvUser && (
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      {req.pdv ? `${req.pdv.code} - ${req.pdv.name}` : req.pdv_id}
                    </td>
                  )}
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.crate_type?.name || req.crate_type_id}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {req.crate_type ? FORMAT_LABELS[req.crate_type.format] || req.crate_type.format : ''}
                  </td>
                  <td className="text-center px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.quantity}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(req.requested_at)}
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
