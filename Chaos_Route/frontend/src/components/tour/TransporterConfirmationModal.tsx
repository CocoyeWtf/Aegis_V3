/* Mail de confirmation des tournées attribuées, transporteur par transporteur /
   Assigned-tours confirmation email, one carrier at a time. */

import { useState, useCallback, useEffect } from 'react'
import api from '../../services/api'

export interface ConfirmTransporter {
  carrierId: number
  name: string
  email?: string | null
  tourCount: number
}

interface Preview {
  carrier_id: number
  carrier_name: string
  to: string | null
  subject: string
  html: string
  text: string
  tour_count: number
}

interface Props {
  date: string
  transporters: ConfirmTransporter[]
  onClose: () => void
}

export function TransporterConfirmationModal({ date, transporters, onClose }: Props) {
  const [selected, setSelected] = useState<number | null>(transporters[0]?.carrierId ?? null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const loadPreview = useCallback(async (carrierId: number) => {
    setSelected(carrierId)
    setPreview(null)
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.get<Preview>('/tours/transporter-confirmation', {
        params: { date, carrier_id: carrierId },
      })
      setPreview(data)
    } catch {
      setError("Impossible de charger l'aperçu du mail.")
    } finally {
      setLoading(false)
    }
  }, [date])

  /* Charger l'aperçu du premier transporteur à l'ouverture / Load first preview on open */
  useEffect(() => {
    if (selected != null) loadPreview(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    if (selected == null) return
    setSending(true)
    setError(null)
    try {
      await api.post('/tours/transporter-confirmation/send', null, {
        params: { date, carrier_id: selected },
      })
      setSent((prev) => new Set(prev).add(selected))
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || "Échec de l'envoi du mail.")
    } finally {
      setSending(false)
    }
  }

  const selectedTransporter = transporters.find((t) => t.carrierId === selected)
  const alreadySent = selected != null && sent.has(selected)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl border shadow-xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête / Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Confirmation Mail — tournées attribuées du {date}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none px-2 hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Liste transporteurs / Carrier list */}
          <div className="w-56 shrink-0 border-r overflow-y-auto" style={{ borderColor: 'var(--border-color)' }}>
            {transporters.length === 0 && (
              <p className="text-xs p-3" style={{ color: 'var(--text-muted)' }}>
                Aucun transporteur avec des tournées planifiées ce jour.
              </p>
            )}
            {transporters.map((tr) => (
              <button
                key={tr.carrierId}
                onClick={() => loadPreview(tr.carrierId)}
                className="w-full text-left px-3 py-2 border-b transition-all hover:opacity-90"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: selected === tr.carrierId ? 'rgba(14,165,233,0.12)' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{tr.name}</span>
                  {sent.has(tr.carrierId) && (
                    <span className="text-[10px] font-bold" style={{ color: 'var(--color-success)' }}>✓ envoyé</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{tr.tourCount} tournée(s)</span>
                  {!tr.email && <span style={{ color: 'var(--color-danger)' }}>· pas d'email</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Aperçu / Preview */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
              {loading && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Chargement de l'aperçu…</p>}
              {!loading && preview && (
                <>
                  <div className="text-xs mb-2 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
                    <div><span className="font-semibold">À :</span> {preview.to || <span style={{ color: 'var(--color-danger)' }}>— (email manquant dans la fiche transporteur)</span>}</div>
                    <div><span className="font-semibold">Objet :</span> {preview.subject}</div>
                  </div>
                  {preview.tour_count === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                      Aucune tournée attribuée à ce transporteur pour cette date.
                    </p>
                  ) : (
                    <div
                      className="rounded border p-3 bg-white text-black overflow-x-auto"
                      style={{ borderColor: 'var(--border-color)' }}
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                    />
                  )}
                </>
              )}
            </div>

            {/* Pied : indication + envoi / Footer: ready indication + send */}
            <div className="px-4 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-xs min-w-0">
                {error && <span style={{ color: 'var(--color-danger)' }}>{error}</span>}
                {!error && alreadySent && (
                  <span style={{ color: 'var(--color-success)' }}>✓ Mail envoyé à {preview?.to}.</span>
                )}
                {!error && !alreadySent && preview && preview.tour_count > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Ce mail est validé et prêt à être transféré au transporteur.
                  </span>
                )}
              </div>
              <button
                onClick={send}
                disabled={sending || alreadySent || !preview || preview.tour_count === 0 || !preview.to}
                className="h-8 shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: '#0ea5e9' }}
                title={!preview?.to ? "Aucune adresse email dans la fiche transporteur" : 'Envoyer au transporteur'}
              >
                {sending ? '…' : alreadySent ? 'Envoyé' : `Envoyer à ${selectedTransporter?.name ?? ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
