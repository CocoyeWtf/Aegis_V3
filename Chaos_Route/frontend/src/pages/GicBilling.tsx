/* Facturation GIC — factures immobilisation contenants /
   GIC Billing — container immobilization invoices.
   Génération quadrimestrielle, suivi statut, export CSV. */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api'
import { useAuthStore } from '../stores/useAuthStore'
import type { GicInvoice, GicInvoiceLine } from '../types'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  CONFIRMED: 'Confirmee',
  SENT: 'Envoyee',
  PAID: 'Payee',
  CANCELLED: 'Annulee',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  CONFIRMED: '#3b82f6',
  SENT: '#f97316',
  PAID: '#22c55e',
  CANCELLED: '#ef4444',
}

/* Calcule les périodes quadrimestrielles / Calculate quadrimester periods */
function getQuadrimesterPeriods(year: number) {
  return [
    { label: `${year}-Q1`, start: `${year}-01-01`, end: `${year}-04-30`, display: `Q1 ${year} (Jan-Avr)` },
    { label: `${year}-Q2`, start: `${year}-05-01`, end: `${year}-08-31`, display: `Q2 ${year} (Mai-Aou)` },
    { label: `${year}-Q3`, start: `${year}-09-01`, end: `${year}-12-31`, display: `Q3 ${year} (Sep-Dec)` },
  ]
}

export default function GicBilling() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canCreate = hasPermission('pdv-stock', 'create')
  const canUpdate = hasPermission('pdv-stock', 'update')
  const canDelete = hasPermission('pdv-stock', 'delete')

  const [invoices, setInvoices] = useState<GicInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedLines, setExpandedLines] = useState<GicInvoiceLine[]>([])
  const [loadingLines, setLoadingLines] = useState(false)

  // Génération
  const [showGenerate, setShowGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genPeriod, setGenPeriod] = useState('')
  const [genNotes, setGenNotes] = useState('')

  const currentYear = new Date().getFullYear()
  const periods = useMemo(() => [
    ...getQuadrimesterPeriods(currentYear - 1),
    ...getQuadrimesterPeriods(currentYear),
    ...getQuadrimesterPeriods(currentYear + 1),
  ], [currentYear])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/gic-invoices/')
      setInvoices(res.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  /* Expand / collapse detail */
  const toggleDetail = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setLoadingLines(true)
    try {
      const res = await api.get(`/gic-invoices/${id}`)
      setExpandedLines(res.data.lines || [])
    } catch { setExpandedLines([]) }
    finally { setLoadingLines(false) }
  }

  /* Générer facture / Generate invoice */
  const handleGenerate = async () => {
    const period = periods.find((p) => p.label === genPeriod)
    if (!period) return
    setGenerating(true)
    try {
      await api.post('/gic-invoices/generate/', {
        period_label: period.label,
        period_start: period.start,
        period_end: period.end,
        notes: genNotes || null,
      })
      setShowGenerate(false)
      setGenPeriod('')
      setGenNotes('')
      fetchInvoices()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(msg)
    } finally { setGenerating(false) }
  }

  /* Changer statut / Change status */
  const changeStatus = async (id: number, status: string) => {
    try {
      await api.put(`/gic-invoices/${id}/status`, { status })
      fetchInvoices()
    } catch { /* silent */ }
  }

  /* Supprimer / Delete */
  const deleteInvoice = async (id: number) => {
    if (!confirm('Supprimer cette facture brouillon ?')) return
    try {
      await api.delete(`/gic-invoices/${id}`)
      if (expandedId === id) setExpandedId(null)
      fetchInvoices()
    } catch { /* silent */ }
  }

  /* Export CSV */
  const exportCsv = async (id: number, label: string) => {
    try {
      const res = await api.get(`/gic-invoices/${id}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `GIC_${label}_${id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Facturation GIC — Immobilisation contenants
        </h1>
        {canCreate && (
          <button
            onClick={() => setShowGenerate(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          >
            + Generer une facture
          </button>
        )}
      </div>

      {/* Dialog génération */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl border p-6 w-full max-w-md" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Generer facture GIC</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Periode quadrimestrielle</label>
                <select value={genPeriod} onChange={(e) => setGenPeriod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <option value="">Choisir...</option>
                  {periods.map((p) => (
                    <option key={p.label} value={p.label}>{p.display}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Notes (optionnel)</label>
                <textarea value={genNotes} onChange={(e) => setGenNotes(e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                La facture sera generee a partir des depassements PUO actuels (snapshot).
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowGenerate(false)}
                className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button onClick={handleGenerate} disabled={!genPeriod || generating}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: !genPeriod || generating ? 0.5 : 1 }}>
                {generating ? 'Generation...' : 'Generer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des factures */}
      {loading ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          Aucune facture GIC. Cliquez sur "Generer une facture" pour commencer.
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              {/* Header facture */}
              <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:opacity-90"
                onClick={() => toggleDetail(inv.id)}>
                <span className="text-lg" style={{ color: 'var(--text-muted)' }}>
                  {expandedId === inv.id ? '▼' : '▶'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {inv.period_label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {inv.period_start} → {inv.period_end}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: STATUS_COLORS[inv.status] + '20', color: STATUS_COLORS[inv.status] }}>
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{inv.pdv_count} PDV</span>
                    <span>{inv.line_count} lignes</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>+{inv.total_overage_units} unites</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                      {inv.total_overage_value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); exportCsv(inv.id, inv.period_label) }}
                    className="px-2 py-1 rounded text-xs border hover:opacity-80"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                    title="Exporter CSV">
                    CSV
                  </button>
                  {canUpdate && inv.status === 'DRAFT' && (
                    <button onClick={(e) => { e.stopPropagation(); changeStatus(inv.id, 'CONFIRMED') }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: '#3b82f620', color: '#3b82f6' }}>
                      Confirmer
                    </button>
                  )}
                  {canUpdate && inv.status === 'CONFIRMED' && (
                    <button onClick={(e) => { e.stopPropagation(); changeStatus(inv.id, 'SENT') }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: '#f9731620', color: '#f97316' }}>
                      Envoyer
                    </button>
                  )}
                  {canUpdate && inv.status === 'SENT' && (
                    <button onClick={(e) => { e.stopPropagation(); changeStatus(inv.id, 'PAID') }}
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}>
                      Payer
                    </button>
                  )}
                  {canDelete && inv.status === 'DRAFT' && (
                    <button onClick={(e) => { e.stopPropagation(); deleteInvoice(inv.id) }}
                      className="px-2 py-1 rounded text-xs"
                      style={{ color: '#ef4444' }}
                      title="Supprimer">
                      X
                    </button>
                  )}
                </div>
              </div>

              {/* Détail lignes / Line detail */}
              {expandedId === inv.id && (
                <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
                  {loadingLines ? (
                    <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
                  ) : expandedLines.length === 0 ? (
                    <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Aucune ligne</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <th className="text-left px-3 py-1.5 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>PDV</th>
                            <th className="text-left px-3 py-1.5 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Type support</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Stock</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>PUO</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-xs" style={{ color: '#ef4444' }}>Exces</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-xs" style={{ color: 'var(--text-secondary)' }}>Val. unit.</th>
                            <th className="text-right px-3 py-1.5 font-semibold text-xs" style={{ color: '#f59e0b' }}>Valeur EUR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedLines.map((line) => (
                            <tr key={line.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                              <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>
                                {line.pdv_code} — {line.pdv_name}
                              </td>
                              <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {line.support_type_code}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                                {line.current_stock}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                                {line.puo}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-bold" style={{ color: '#ef4444' }}>
                                +{line.overage}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                                {line.unit_value.toFixed(2)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: '#f59e0b' }}>
                                {line.overage_value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2" style={{ borderColor: 'var(--text-muted)' }}>
                            <td colSpan={4} className="px-3 py-2 font-bold text-xs" style={{ color: 'var(--text-primary)' }}>
                              TOTAL
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: '#ef4444' }}>
                              +{inv.total_overage_units}
                            </td>
                            <td />
                            <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: '#f59e0b' }}>
                              {inv.total_overage_value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {inv.notes && (
                    <div className="mt-2 text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                      Notes: {inv.notes}
                    </div>
                  )}
                  <div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Genere le {new Date(inv.generated_at).toLocaleString('fr-FR')}
                    {inv.generated_by && <> par {inv.generated_by}</>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
