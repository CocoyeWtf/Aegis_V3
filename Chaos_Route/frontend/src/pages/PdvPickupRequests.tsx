/* Page demandes de reprise PDV / PDV pickup requests page */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { formatDate } from '../utils/tourTimeUtils'
import { useApi } from '../hooks/useApi'
import { useAuthStore } from '../stores/useAuthStore'
import api from '../services/api'
import { PickupLabelPrint } from '../components/pickup/PickupLabelPrint'
import type { PickupRequest, PickupTypeEnum, SupportType } from '../types'

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

function ControlPhotoModal({ labelCode, onClose }: { labelCode: string; onClose: () => void }) {
  const [evidence, setEvidence] = useState<{ id: number; timestamp: string; latitude: number | null; longitude: number | null } | null>(null)

  useEffect(() => {
    api.get('/control-evidences/by-labels', { params: { label_codes: labelCode } })
      .then(({ data }) => {
        const ev = data[labelCode]
        if (ev) setEvidence(ev)
      })
      .catch(() => {})
  }, [labelCode])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-4 max-w-2xl w-full mx-4"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Photo de controle
          </h3>
          <button onClick={onClose} className="text-lg px-2" style={{ color: 'var(--text-muted)' }}>
            &times;
          </button>
        </div>
        <div className="text-xs space-y-1 mb-3" style={{ color: 'var(--text-muted)' }}>
          <div><strong>Etiquette :</strong> {labelCode}</div>
          {evidence && <div><strong>Date :</strong> {formatDate(evidence.timestamp)}</div>}
          {evidence?.latitude != null && evidence?.longitude != null && (
            <div><strong>GPS :</strong> {evidence.latitude.toFixed(5)}, {evidence.longitude.toFixed(5)}</div>
          )}
        </div>
        {evidence ? (
          <img
            src={`/api/control-evidences/${evidence.id}/photo`}
            alt="Photo controle"
            className="w-full rounded-lg"
            style={{ maxHeight: '60vh', objectFit: 'contain', backgroundColor: '#000' }}
          />
        ) : (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
        )}
      </div>
    </div>
  )
}

export default function PdvPickupRequests() {
  const user = useAuthStore((s) => s.user)
  const isPdvUser = !!user?.pdv_id

  // Charger les données de formulaire via endpoint dédié (pas besoin de support-types:read)
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [pdvs, setPdvs] = useState<{ id: number; code: string; name: string }[]>([])
  useEffect(() => {
    api.get('/pickup-requests/form-data/').then(({ data }) => {
      setSupportTypes(data.support_types ?? [])
      setPdvs(data.pdvs ?? [])
    }).catch(() => { /* silently fail */ })
  }, [])

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
  const [pickupType, setPickupType] = useState<string>('')
  const [withContent, setWithContent] = useState(false)
  const [notes, setNotes] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Impression / Print
  const [printRequest, setPrintRequest] = useState<PickupRequest | null>(null)

  // Modal photo controle / Control photo modal
  const [photoModal, setPhotoModal] = useState<{ labelCode: string } | null>(null)

  /* Prefixes de code par type de reprise / Code prefixes per pickup type */
  const PICKUP_TYPE_PREFIXES: Record<string, string[]> = {
    CONTAINER: ['PA', 'CO'],   // Palettes + Combis/Rolls
    CARDBOARD: ['RE'],         // Balles carton/plastique
    CONSIGNMENT: ['SF'],       // Casiers biere
    MERCHANDISE: [],           // Pas de support type
  }

  /* Support types filtres selon le type de reprise / Filtered by pickup type */
  const filteredSupportTypes = useMemo(() => {
    if (!pickupType) return supportTypes
    const prefixes = PICKUP_TYPE_PREFIXES[pickupType] ?? []
    if (prefixes.length === 0) return []
    return supportTypes.filter((st) => prefixes.some((p) => st.code.startsWith(p)))
  }, [supportTypes, pickupType])

  const needsSupportType = pickupType !== 'MERCHANDISE'
  const selectedSt = supportTypes.find((st) => String(st.id) === supportTypeId)
  const showWithContent = pickupType === 'CONSIGNMENT' && !!selectedSt?.content_item_label

  // Recherche PDV / PDV search
  const [pdvSearch, setPdvSearch] = useState('')
  const [pdvDropdownOpen, setPdvDropdownOpen] = useState(false)
  const pdvSearchRef = useRef<HTMLDivElement>(null)

  const selectedPdv = pdvs.find((p) => String(p.id) === pdvId)

  const filteredPdvs = useMemo(() => {
    if (!pdvSearch.trim()) return pdvs
    const q = pdvSearch.toLowerCase()
    return pdvs.filter(
      (p) => p.code?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q),
    )
  }, [pdvs, pdvSearch])

  // Fermer dropdown au clic exterieur / Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pdvSearchRef.current && !pdvSearchRef.current.contains(e.target as Node)) {
        setPdvDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const finalPdvId = isPdvUser ? user!.pdv_id : Number(pdvId)
      if (!finalPdvId || !pickupType) return
      if (needsSupportType && !supportTypeId) return

      setSubmitting(true)
      try {
        await api.post('/pickup-requests/', {
          pdv_id: finalPdvId,
          support_type_id: supportTypeId ? Number(supportTypeId) : null,
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
        setPdvSearch('')
        setPickupType('')
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
    [isPdvUser, user, pdvId, supportTypeId, quantity, availabilityDate, pickupType, withContent, showWithContent, needsSupportType, notes, refetch],
  )

  const handlePrint = useCallback(async (req: PickupRequest) => {
    const { data } = await api.get<PickupRequest>(`/pickup-requests/${req.id}`)
    setPrintRequest(data)
  }, [])

  const handlePrinted = useCallback(async (reqId: number) => {
    await api.post(`/pickup-requests/${reqId}/printed`)
    refetch()
  }, [refetch])

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
          onPrinted={() => handlePrinted(printRequest.id)}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Demandes de reprise
      </h1>

      {/* Modal photo controle / Control photo modal */}
      {photoModal && (
        <ControlPhotoModal labelCode={photoModal.labelCode} onClose={() => setPhotoModal(null)} />
      )}

      {/* Formulaire de creation / Creation form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border p-4 space-y-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Nouvelle demande
        </h2>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* PDV recherche (mode dispatcher) / PDV search (dispatcher mode) */}
          {!isPdvUser && (
            <div ref={pdvSearchRef} className="relative">
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                PDV *
              </label>
              {/* Champ caché pour validation HTML / Hidden input for HTML validation */}
              <input type="hidden" required value={pdvId} />
              <input
                type="text"
                value={pdvDropdownOpen ? pdvSearch : selectedPdv ? `${selectedPdv.code} - ${selectedPdv.name}` : ''}
                onChange={(e) => {
                  setPdvSearch(e.target.value)
                  setPdvDropdownOpen(true)
                  if (pdvId) setPdvId('')
                }}
                onFocus={() => {
                  setPdvDropdownOpen(true)
                  setPdvSearch('')
                }}
                placeholder="Rechercher par numero ou nom..."
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: !pdvId && pdvSearch ? '#ef4444' : 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
              {selectedPdv && !pdvDropdownOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPdvId('')
                    setPdvSearch('')
                    setPdvDropdownOpen(true)
                  }}
                  className="absolute right-2 top-[34px] text-xs px-1.5 py-0.5 rounded"
                  style={{ color: 'var(--text-muted)' }}
                  title="Effacer la selection"
                >
                  ✕
                </button>
              )}
              {pdvDropdownOpen && (
                <div
                  className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-lg"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                  }}
                >
                  {filteredPdvs.length === 0 ? (
                    <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      Aucun PDV trouve
                    </div>
                  ) : (
                    filteredPdvs.slice(0, 50).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPdvId(String(p.id))
                          setPdvSearch('')
                          setPdvDropdownOpen(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:brightness-125 cursor-pointer"
                        style={{
                          backgroundColor: String(p.id) === pdvId ? 'var(--bg-tertiary)' : 'transparent',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span className="font-medium">{p.code}</span>
                        <span className="ml-2">{p.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Type de reprise */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Type de reprise *
            </label>
            <select
              value={pickupType}
              onChange={(e) => {
                setPickupType(e.target.value as PickupTypeEnum)
                setSupportTypeId('')
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
              {PICKUP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type de support (masque pour MERCHANDISE) */}
          {needsSupportType && (
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Type de support *
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
              {filteredSupportTypes.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.code} - {st.name} {!isPdvUser && st.unit_value != null ? `(${st.unit_value} €)` : ''}
                </option>
              ))}
            </select>
          </div>
          )}

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
              {!isPdvUser && selectedSt!.content_items_per_unit && selectedSt!.content_item_value
                ? ` (+ ${selectedSt!.content_items_per_unit} × ${String(selectedSt!.content_item_value)} € / unite)`
                : ''}
            </span>
          </label>
        )}

        {/* Valeur estimee / Estimated value preview (masque pour PDV) */}
        {!isPdvUser && estimatedValue != null && (
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
              {!isPdvUser && (
              <th
                className="text-right px-4 py-3 font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Valeur
              </th>
              )}
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                Date dispo
              </th>
              <th
                className="text-center px-4 py-3 font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                Statut / Progression
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
                <td colSpan={isPdvUser ? 8 : 9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
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
                  {!isPdvUser && (
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
                  )}
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
                    {(req.total_labels ?? 0) > 0 && (req.picked_up_count ?? 0) + (req.received_count ?? 0) > 0 && (
                      <div className="mt-1 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {(req.pending_count ?? 0) > 0 && (
                          <span style={{ color: '#6b7280' }}>
                            {req.pending_count} attente
                          </span>
                        )}
                        {(req.pending_count ?? 0) > 0 && (req.picked_up_count ?? 0) > 0 && ' · '}
                        {(req.picked_up_count ?? 0) > 0 && (
                          <span style={{ color: '#3b82f6' }}>
                            {req.picked_up_count} chauffeur
                          </span>
                        )}
                        {((req.pending_count ?? 0) > 0 || (req.picked_up_count ?? 0) > 0) && (req.received_count ?? 0) > 0 && ' · '}
                        {(req.received_count ?? 0) > 0 && (
                          <span style={{ color: '#22c55e' }}>
                            {req.received_count} base
                          </span>
                        )}
                        <span style={{ color: 'var(--text-muted)' }}> / {req.total_labels}</span>
                        {/* Alerte reprise partielle PDV */}
                        {(req.pending_count ?? 0) > 0 && (req.picked_up_count ?? 0) > 0 && (
                          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 10 }}>
                            Reprise partielle PDV
                          </div>
                        )}
                        {/* Alerte ecart chauffeur/base : des labels repris par chauffeur + certains recus base mais pas tous */}
                        {(req.picked_up_count ?? 0) > 0 && (req.received_count ?? 0) > 0 && (
                          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 10 }}>
                            {req.picked_up_count} en transit (ecart)
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {req.notes || '—'}
                  </td>
                  <td className="text-center px-4 py-3">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      {req.status === 'PICKED_UP' || req.status === 'RECEIVED' ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scanne</span>
                      ) : (
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
                      )}
                      {(req.print_count ?? 0) > 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {req.print_count}x imprime
                        </span>
                      )}
                      {/* Badge photo controle / Control photo badge */}
                      {((req as any).evidence_label_codes || []).length > 0 && (
                        <button
                          onClick={() => setPhotoModal({ labelCode: (req as any).evidence_label_codes[0] })}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}
                          title="Voir la photo de controle"
                        >
                          Photo
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {!isPdvUser && hasAnyValue && (
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
