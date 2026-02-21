/* Page demandes de reprise PDV / PDV pickup requests page */

import { useState, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuthStore } from '../stores/useAuthStore'
import api from '../services/api'
import { PickupLabelPrint } from '../components/pickup/PickupLabelPrint'
import type { PickupRequest, PickupTypeEnum, SupportType, PDV } from '../types'

const PICKUP_TYPE_OPTIONS: { value: PickupTypeEnum; label: string }[] = [
  { value: 'CONTAINER', label: 'Contenants' },
  { value: 'CARDBOARD', label: 'Balles carton' },
  { value: 'MERCHANDISE', label: 'Retour marchandise' },
  { value: 'CONSIGNMENT', label: 'Consignes bieres' },
]

const PICKUP_TYPE_LABELS: Record<string, string> = {
  CONTAINER: 'Contenants',
  CARDBOARD: 'Balles carton',
  MERCHANDISE: 'Retour marchandise',
  CONSIGNMENT: 'Consignes bieres',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  REQUESTED: { bg: '#6b7280', text: '#fff' },
  PLANNED: { bg: '#f59e0b', text: '#000' },
  PICKED_UP: { bg: '#3b82f6', text: '#fff' },
  RECEIVED: { bg: '#22c55e', text: '#fff' },
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Demande',
  PLANNED: 'Planifie',
  PICKED_UP: 'Recupere',
  RECEIVED: 'Recu',
}

export default function PdvPickupRequests() {
  const user = useAuthStore((s) => s.user)
  const isPdvUser = !!user?.pdv_id

  const { data: supportTypes } = useApi<SupportType>('/support-types', { is_active: true })
  const { data: pdvs } = useApi<PDV>('/pdvs')

  const requestParams = isPdvUser ? { pdv_id: user.pdv_id } : undefined
  const { data: requests, refetch } = useApi<PickupRequest>('/pickup-requests', requestParams)

  // Formulaire
  const [pdvId, setPdvId] = useState<string>('')
  const [supportTypeId, setSupportTypeId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [availabilityDate, setAvailabilityDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [pickupType, setPickupType] = useState<PickupTypeEnum>('CONTAINER')
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Impression
  const [printRequest, setPrintRequest] = useState<PickupRequest | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const finalPdvId = isPdvUser ? user!.pdv_id : Number(pdvId)
    if (!finalPdvId || !supportTypeId) return

    setSubmitting(true)
    try {
      await api.post('/pickup-requests/', {
        pdv_id: finalPdvId,
        support_type_id: Number(supportTypeId),
        quantity,
        availability_date: availabilityDate,
        pickup_type: pickupType,
        notes: notes || null,
      })
      setNotes('')
      setQuantity(1)
      setSupportTypeId('')
      setPdvId('')
      refetch()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur lors de la creation'
      alert(detail)
    } finally {
      setSubmitting(false)
    }
  }, [isPdvUser, user, pdvId, supportTypeId, quantity, availabilityDate, pickupType, notes, refetch])

  const handlePrint = useCallback(async (req: PickupRequest) => {
    // Charger le detail avec labels
    const { data } = await api.get<PickupRequest>(`/pickup-requests/${req.id}`)
    setPrintRequest(data)
  }, [])

  // Mode impression
  if (printRequest) {
    return (
      <div className="p-6">
        <PickupLabelPrint
          labels={printRequest.labels || []}
          pdvCode={printRequest.pdv?.code || ''}
          pdvName={printRequest.pdv?.name || ''}
          supportTypeName={printRequest.support_type?.name || ''}
          pickupType={printRequest.pickup_type}
          onClose={() => setPrintRequest(null)}
        />
      </div>
    )
  }

  const selectedSt = supportTypes.find((st) => String(st.id) === supportTypeId)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Demandes de reprise
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
          {/* PDV select (dispatcher mode) */}
          {!isPdvUser && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                PDV
              </label>
              <select
                value={pdvId}
                onChange={(e) => setPdvId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">-- Selectionner --</option>
                {pdvs.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type de reprise */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Type de reprise
            </label>
            <select
              value={pickupType}
              onChange={(e) => setPickupType(e.target.value as PickupTypeEnum)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {PICKUP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Type de support */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Type de support
            </label>
            <select
              value={supportTypeId}
              onChange={(e) => setSupportTypeId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">-- Selectionner --</option>
              {supportTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.code} - {st.name} {st.unit_label ? `(${st.unit_label})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Quantite */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Quantite (unites)
              {selectedSt && <span className="ml-1 text-xs opacity-70">= {quantity * selectedSt.unit_quantity} pieces</span>}
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Date disponibilite */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Date de disponibilite
            </label>
            <input
              type="date"
              value={availabilityDate}
              onChange={(e) => setAvailabilityDate(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Notes (optionnel)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complementaires..."
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {submitting ? 'Envoi...' : 'Creer la demande'}
        </button>
      </form>

      {/* Liste des demandes */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>PDV</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Reprise</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Support</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Qte</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Date dispo</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Notes</th>
              <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucune demande
                </td>
              </tr>
            )}
            {requests.map((req) => {
              const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.REQUESTED
              return (
                <tr
                  key={req.id}
                  className="border-t"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.pdv ? `${req.pdv.code} - ${req.pdv.name}` : req.pdv_id}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {PICKUP_TYPE_LABELS[req.pickup_type] || req.pickup_type}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.support_type?.name || req.support_type_id}
                  </td>
                  <td className="text-center px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.quantity}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {req.availability_date}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                    >
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {req.notes || '—'}
                  </td>
                  <td className="text-center px-4 py-3">
                    <button
                      onClick={() => handlePrint(req)}
                      className="px-3 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                      title="Imprimer les etiquettes"
                    >
                      Etiquettes
                    </button>
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
