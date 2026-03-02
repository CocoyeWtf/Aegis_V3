/* Page demandes de reprise PDV / PDV pickup requests page */

import { useState, useCallback } from 'react'
import { formatDate } from '../utils/tourTimeUtils'
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

  // Filtres liste / List filters
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPickupType, setFilterPickupType] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')

  const requestParams = {
    ...(isPdvUser && user?.pdv_id ? { pdv_id: user.pdv_id } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(filterPickupType ? { pickup_type: filterPickupType } : {}),
  } as Record<string, unknown>

  const { data: requests, refetch } = useApi<PickupRequest>('/pickup-requests', requestParams)

  // Formulaire / Form state
  const [pdvId, setPdvId] = useState<string>('')
  const [supportTypeId, setSupportTypeId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [availabilityDate, setAvailabilityDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [pickupType, setPickupType] = useState<PickupTypeEnum>('CONTAINER')
  const [withContent, setWithContent] = useState(false)
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Impression / Print
  const [printRequest, setPrintRequest] = useState<PickupRequest | null>(null)

  const selectedSt = supportTypes.find((st) => String(st.id) === supportTypeId)
  const showWithContent = pickupType === 'CONSIGNMENT' && !!selectedSt?.content_item_label

  // Presets rapides : supports avec contenu consigne / Quick presets: supports with consignment content
  const consignmentPresets = supportTypes.filter((st) => st.content_item_label && st.unit_value != null)

  // Valeur estimee en direct / Real-time estimated value
  // quantity × unit_quantity × (unit_value + with_content × content_items_per_unit × content_item_value)
  const estimatedValue =
    selectedSt?.unit_value != null
      ? quantity *
        (selectedSt.unit_quantity ?? 1) *
        (selectedSt.unit_value +
          (withContent && selectedSt.content_items_per_unit && selectedSt.content_item_value
            ? selectedSt.content_items_per_unit * selectedSt.content_item_value
            : 0))
      : null

  const applyPreset = useCallback((st: SupportType) => {
    setSupportTypeId(String(st.id))
    setPickupType('CONSIGNMENT')
    setQuantity(1)
    setWithContent(true)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
          with_content: showWithContent ? withContent : false,
          notes: notes || null,
        })
        setNotes('')
        setQuantity(1)
        setSupportTypeId('')
        setPdvId('')
        setWithContent(false)
        refetch()
      } catch (err: unknown) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          'Erreur lors de la creation'
        alert(detail)
      } finally {
        setSubmitting(false)
      }
    },
    [isPdvUser, user, pdvId, supportTypeId, quantity, availabilityDate, pickupType, withContent, showWithContent, notes, refetch],
  )

  const handlePrint = useCallback(async (req: PickupRequest) => {
    const { data } = await api.get<PickupRequest>(`/pickup-requests/${req.id}`)
    setPrintRequest(data)
  }, [])

  const handleExportCsv = useCallback(async () => {
    const params: Record<string, unknown> = {}
    if (isPdvUser && user?.pdv_id) params.pdv_id = user.pdv_id
    if (filterStatus) params.status = filterStatus
    if (filterPickupType) params.pickup_type = filterPickupType
    if (filterDateFrom) params.date_from = filterDateFrom
    if (filterDateTo) params.date_to = filterDateTo

    try {
      const response = await api.get('/pickup-requests/export/csv', {
        params,
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8-sig' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reprises_export_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert("Erreur lors de l'export CSV")
    }
  }, [isPdvUser, user, filterStatus, filterPickupType, filterDateFrom, filterDateTo])

  // Total valeur consignes filtrées / Filtered consignment value total
  const totalConsignmentValue = requests.reduce(
    (sum, r) => (r.total_declared_value != null ? sum + r.total_declared_value : sum),
    0,
  )
  const hasAnyValue = requests.some((r) => r.total_declared_value != null)

  // Mode impression / Print mode
  if (printRequest) {
    return (
      <div className="p-6">
        <PickupLabelPrint
          labels={printRequest.labels || []}
          pdvCode={printRequest.pdv?.code || ''}
          pdvName={printRequest.pdv?.name || ''}
          supportTypeName={printRequest.support_type?.name || ''}
          pickupType={printRequest.pickup_type}
          supportTypeImageUrl={
            printRequest.support_type?.image_path
              ? `/api/support-types/${printRequest.support_type.id}/image`
              : null
          }
          onClose={() => setPrintRequest(null)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Demandes de reprise
      </h1>

      {/* Formulaire de creation / Creation form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border p-4 space-y-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Nouvelle demande
        </h2>

        {/* Presets rapides / Quick presets (PDV users only) */}
        {isPdvUser && consignmentPresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Preset rapide :
            </span>
            {consignmentPresets.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => applyPreset(st)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)',
                }}
              >
                ⚡ {st.name}
                {st.content_item_label ? ` + ${st.content_item_label}s vides` : ''}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PDV select (mode dispatcher) */}
          {!isPdvUser && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
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
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Type de reprise */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Type de reprise
            </label>
            <select
              value={pickupType}
              onChange={(e) => {
                setPickupType(e.target.value as PickupTypeEnum)
                setWithContent(false)
              }}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {PICKUP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type de support */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Type de support
            </label>
            <select
              value={supportTypeId}
              onChange={(e) => {
                setSupportTypeId(e.target.value)
                setWithContent(false)
              }}
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
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Quantite (unites)
              {selectedSt && (
                <span className="ml-1 text-xs opacity-70">
                  = {quantity * selectedSt.unit_quantity} pieces
                </span>
              )}
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

          {/* Date de disponibilite */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
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

        {/* Checkbox avec contenu / With content checkbox */}
        {showWithContent && (
          <label
            className="flex items-center gap-2 cursor-pointer"
            style={{ color: 'var(--text-primary)' }}
          >
            <input
              type="checkbox"
              checked={withContent}
              onChange={(e) => setWithContent(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Avec {selectedSt!.content_item_label}s
              {selectedSt!.content_items_per_unit && selectedSt!.content_item_value
                ? ` (+ ${selectedSt!.content_items_per_unit} × ${String(selectedSt!.content_item_value)} € / unite)`
                : ''}
            </span>
          </label>
        )}

        {/* Valeur estimee / Estimated value preview */}
        {estimatedValue != null && (
          <div className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            Valeur declaree estimee : {estimatedValue.toFixed(2)} €
          </div>
        )}

        {/* Notes */}
        <div>
          <label
            className="block text-sm font-medium mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
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

      {/* Filtres + Export CSV / Filters + CSV export */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={filterPickupType}
          onChange={(e) => setFilterPickupType(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">Tous types</option>
          {PICKUP_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Export :
        </span>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          title="Date dispo depuis (export CSV)"
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          title="Date dispo jusqu'a (export CSV)"
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />

        <div className="ml-auto">
          <button
            onClick={handleExportCsv}
            className="px-4 py-1.5 rounded-lg text-sm font-medium border"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Liste des demandes / Request list */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                PDV
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Reprise
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Support
              </th>
              <th
                className="text-center px-4 py-3 font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Qte
              </th>
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Valeur
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Date dispo
              </th>
              <th
                className="text-center px-4 py-3 font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Statut
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Notes
              </th>
              <th
                className="text-center px-4 py-3 font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucune demande
                </td>
              </tr>
            )}
            {requests.map((req) => {
              const statusStyle = STATUS_COLORS[req.status] || STATUS_COLORS.REQUESTED
              const isReceived = req.status === 'RECEIVED'
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
                    {req.with_content && req.support_type?.content_item_label && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        + {req.support_type.content_item_label}s
                      </span>
                    )}
                  </td>
                  <td
                    className="text-center px-4 py-3"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {req.quantity}
                  </td>
                  <td
                    className="text-right px-4 py-3 font-medium tabular-nums"
                    style={{
                      color:
                        req.total_declared_value != null
                          ? isReceived
                            ? '#22c55e'
                            : 'var(--text-primary)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {req.total_declared_value != null
                      ? `${req.total_declared_value.toFixed(2)} €`
                      : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    {formatDate(req.availability_date)}
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
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                      }}
                      title="Imprimer les etiquettes"
                    >
                      Etiquettes
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {hasAnyValue && (
            <tfoot>
              <tr
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderTop: '2px solid var(--border-color)',
                }}
              >
                <td
                  colSpan={4}
                  className="px-4 py-3 text-sm font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Total consignes ({requests.filter((r) => r.total_declared_value != null).length}{' '}
                  reprises)
                </td>
                <td
                  className="text-right px-4 py-3 text-sm font-bold tabular-nums"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {totalConsignmentValue.toFixed(2)} €
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
