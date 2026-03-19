/* Page reprises fournisseur / Supplier pickup requests page */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import type {
  SupplierPickupRequest, SupplierPickupLine, StockAlert,
  Supplier, SupportType,
} from '../types'

interface Base { id: number; code?: string; name: string }

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyee',
  CONFIRMED: 'Confirmee',
  PICKED_UP: 'Enlevee',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'var(--text-muted)',
  SENT: 'var(--color-primary)',
  CONFIRMED: '#22c55e',
  PICKED_UP: '#6b7280',
}

export default function SupplierPickupRequests() {
  const [requests, setRequests] = useState<SupplierPickupRequest[]>([])
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  // Dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formBaseId, setFormBaseId] = useState<number | ''>('')
  const [formSupplierId, setFormSupplierId] = useState<number | ''>('')
  const [formNotes, setFormNotes] = useState('')
  const [formLines, setFormLines] = useState<{ support_type_id: number; palette_count: number; unit_count: string; notes: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Detail
  const [selectedRequest, setSelectedRequest] = useState<SupplierPickupRequest | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter

      const [reqRes, alertRes, suppRes, baseRes, stRes] = await Promise.all([
        api.get('/supplier-pickups/', { params }),
        api.get('/supplier-pickups/alerts/'),
        api.get('/suppliers/'),
        api.get('/bases/'),
        api.get('/support-types/', { params: { is_active: true } }),
      ])
      setRequests(reqRes.data)
      setAlerts(alertRes.data)
      setSuppliers(suppRes.data)
      setBases(baseRes.data)
      setSupportTypes(stRes.data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Filtrer les types de support lies a un fournisseur / Filter support types linked to a supplier
  const supplierSupportTypes = useCallback((supplierId: number) => {
    return supportTypes.filter((st) => st.supplier_id === supplierId)
  }, [supportTypes])

  const openCreateDialog = (alert?: StockAlert) => {
    setEditingId(null)
    setFormBaseId(alert?.base_id || '')
    setFormSupplierId(alert?.supplier_id || '')
    setFormNotes('')
    if (alert?.supplier_id) {
      const sts = supplierSupportTypes(alert.supplier_id)
      setFormLines(sts.map((st) => {
        const matchingAlert = alerts.find((a) => a.support_type_id === st.id && a.base_id === alert.base_id)
        return {
          support_type_id: st.id,
          palette_count: matchingAlert ? Math.ceil(matchingAlert.current_stock / (st.unit_quantity || 1)) : 0,
          unit_count: matchingAlert ? String(matchingAlert.current_stock) : '',
          notes: '',
        }
      }))
    } else {
      setFormLines([])
    }
    setShowDialog(true)
  }

  const handleSupplierChange = (supplierId: number) => {
    setFormSupplierId(supplierId)
    const sts = supplierSupportTypes(supplierId)
    setFormLines(sts.map((st) => ({
      support_type_id: st.id,
      palette_count: 0,
      unit_count: '',
      notes: '',
    })))
  }

  const handleLinePaletteChange = (idx: number, value: number) => {
    setFormLines((prev) => prev.map((l, i) => i === idx ? { ...l, palette_count: value } : l))
  }

  const handleLineUnitChange = (idx: number, value: string) => {
    setFormLines((prev) => prev.map((l, i) => i === idx ? { ...l, unit_count: value } : l))
  }

  const handleSave = async () => {
    if (!formBaseId || !formSupplierId) return
    const validLines = formLines.filter((l) => l.palette_count > 0)
    if (validLines.length === 0) return

    setSaving(true)
    try {
      const payload = {
        base_id: Number(formBaseId),
        supplier_id: Number(formSupplierId),
        notes: formNotes || null,
        lines: validLines.map((l) => ({
          support_type_id: l.support_type_id,
          palette_count: l.palette_count,
          unit_count: l.unit_count ? Number(l.unit_count) : null,
          notes: l.notes || null,
        })),
      }

      if (editingId) {
        await api.put(`/supplier-pickups/${editingId}`, { ...payload, status: undefined })
      } else {
        await api.post('/supplier-pickups/', payload)
      }
      setShowDialog(false)
      fetchData()
    } catch {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.put(`/supplier-pickups/${id}`, { status: newStatus })
      fetchData()
    } catch {
      alert('Erreur lors du changement de statut')
    }
  }

  const handleSendEmail = async (id: number) => {
    if (!confirm('Envoyer la demande par email au fournisseur ?')) return
    try {
      const res = await api.post(`/supplier-pickups/${id}/send-email`)
      alert(res.data.detail)
      fetchData()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(detail)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette demande ?')) return
    try {
      await api.delete(`/supplier-pickups/${id}`)
      fetchData()
    } catch {
      alert('Erreur lors de la suppression')
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Reprises fournisseurs
        </h1>
        <button
          onClick={() => openCreateDialog()}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          + Nouvelle demande
        </button>
      </div>

      {/* Alertes stock / Stock alerts */}
      {alerts.length > 0 && (
        <div className="rounded-lg border p-4" style={{ backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'var(--color-danger)' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--color-danger)' }}>
            Alertes stock — Seuils depasses ({alerts.length})
          </h2>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div style={{ color: 'var(--text-primary)' }}>
                  <span className="font-medium">{a.base_name}</span> —{' '}
                  <span>{a.support_type_name}</span> ({a.support_type_code}) :{' '}
                  <span className="font-bold" style={{ color: 'var(--color-danger)' }}>
                    {a.current_stock}
                  </span>{' '}
                  / seuil {a.alert_threshold}
                  {a.supplier_name && (
                    <span style={{ color: 'var(--text-muted)' }}> — {a.supplier_name}</span>
                  )}
                </div>
                {a.supplier_id && (
                  <button
                    onClick={() => openCreateDialog(a)}
                    className="px-3 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Creer demande
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres / Filters */}
      <div className="flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        >
          <option value="">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="SENT">Envoyee</option>
          <option value="CONFIRMED">Confirmee</option>
          <option value="PICKED_UP">Enlevee</option>
        </select>
      </div>

      {/* Tableau / Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>#</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Base</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Fournisseur</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Lignes</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune demande</td></tr>
            ) : requests.map((req) => (
              <tr
                key={req.id}
                className="border-t cursor-pointer hover:opacity-80"
                style={{ borderColor: 'var(--border-color)' }}
                onClick={() => setSelectedRequest(req)}
              >
                <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{req.id}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{req.created_at?.slice(0, 10)}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{req.base?.name || '—'}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{req.supplier?.name || '—'}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {req.lines.length} type(s), {req.lines.reduce((s, l) => s + l.palette_count, 0)} pal.
                </td>
                <td className="px-3 py-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${STATUS_COLORS[req.status]}20`, color: STATUS_COLORS[req.status] }}
                  >
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    {req.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleSendEmail(req.id)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                          title="Envoyer par email"
                        >
                          Envoyer
                        </button>
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
                        >
                          Suppr.
                        </button>
                      </>
                    )}
                    {req.status === 'SENT' && (
                      <button
                        onClick={() => handleStatusChange(req.id, 'CONFIRMED')}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: '#22c55e', color: 'white' }}
                      >
                        Confirmer
                      </button>
                    )}
                    {req.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleStatusChange(req.id, 'PICKED_UP')}
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: '#6b7280', color: 'white' }}
                      >
                        Enleve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail dialog */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Demande #{selectedRequest.id}
              </h2>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${STATUS_COLORS[selectedRequest.status]}20`, color: STATUS_COLORS[selectedRequest.status] }}
              >
                {STATUS_LABELS[selectedRequest.status]}
              </span>
            </div>

            <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div><span className="font-medium">Base :</span> {selectedRequest.base?.name}</div>
              <div><span className="font-medium">Fournisseur :</span> {selectedRequest.supplier?.name} ({selectedRequest.supplier?.email || 'pas d\'email'})</div>
              <div><span className="font-medium">Cree le :</span> {selectedRequest.created_at?.slice(0, 10)} par {selectedRequest.created_by_username || '—'}</div>
              {selectedRequest.sent_at && <div><span className="font-medium">Envoye le :</span> {selectedRequest.sent_at.slice(0, 10)}</div>}
              {selectedRequest.confirmed_at && <div><span className="font-medium">Confirme le :</span> {selectedRequest.confirmed_at.slice(0, 10)}</div>}
              {selectedRequest.picked_up_at && <div><span className="font-medium">Enleve le :</span> {selectedRequest.picked_up_at.slice(0, 10)}</div>}
              {selectedRequest.notes && <div><span className="font-medium">Notes :</span> {selectedRequest.notes}</div>}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Contenants</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <th className="text-left px-2 py-1" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="text-right px-2 py-1" style={{ color: 'var(--text-muted)' }}>Palettes</th>
                    <th className="text-right px-2 py-1" style={{ color: 'var(--text-muted)' }}>Unites</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRequest.lines.map((line) => (
                    <tr key={line.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="px-2 py-1" style={{ color: 'var(--text-primary)' }}>
                        {line.support_type_name || '—'} <span style={{ color: 'var(--text-muted)' }}>({line.support_type_code})</span>
                      </td>
                      <td className="px-2 py-1 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{line.palette_count}</td>
                      <td className="px-2 py-1 text-right" style={{ color: 'var(--text-secondary)' }}>{line.unit_count || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDialog(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingId ? 'Modifier la demande' : 'Nouvelle demande de reprise'}
            </h2>

            <div className="space-y-4">
              {/* Base */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Base</label>
                <select
                  value={formBaseId}
                  onChange={(e) => setFormBaseId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selectionner...</option>
                  {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              {/* Fournisseur */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fournisseur</label>
                <select
                  value={formSupplierId}
                  onChange={(e) => handleSupplierChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selectionner...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {/* Lignes / Lines */}
              {formLines.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    Contenants a reprendre
                  </label>
                  <div className="space-y-2">
                    {formLines.map((line, idx) => {
                      const st = supportTypes.find((s) => s.id === line.support_type_id)
                      return (
                        <div key={idx} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <div className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                            {st?.name || '?'} <span style={{ color: 'var(--text-muted)' }}>({st?.code})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Pal.</label>
                            <input
                              type="number"
                              min={0}
                              value={line.palette_count}
                              onChange={(e) => handleLinePaletteChange(idx, Number(e.target.value))}
                              className="w-16 px-2 py-1 rounded text-sm border text-center"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            />
                            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Unit.</label>
                            <input
                              type="number"
                              min={0}
                              value={line.unit_count}
                              onChange={(e) => handleLineUnitChange(idx, e.target.value)}
                              className="w-16 px-2 py-1 rounded text-sm border text-center"
                              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                              placeholder={st ? String((line.palette_count || 0) * (st.unit_quantity || 1)) : ''}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {formSupplierId && formLines.length === 0 && (
                <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  Aucun type de support lie a ce fournisseur. Configurez le lien dans Types de support.
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formBaseId || !formSupplierId || formLines.filter((l) => l.palette_count > 0).length === 0}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
