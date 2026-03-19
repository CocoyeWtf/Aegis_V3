/* Page demandes d'enlevement fournisseur / Supplier collection requests page
   Appros declarent les besoins, transport planifie. */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import type { Supplier } from '../types'

interface Base { id: number; code: string; name: string }

interface CollectionRequest {
  id: number
  supplier_id: number
  base_id: number
  eqp_count: number
  pickup_date: string
  needed_by_date: string
  status: string
  tour_id?: number | null
  transport_notes?: string | null
  notes?: string | null
  created_by_user_id?: number | null
  created_at: string
  planned_at?: string | null
  picked_up_at?: string | null
  delivered_at?: string | null
  supplier?: { id: number; code: string; name: string } | null
  base?: { id: number; code: string; name: string } | null
  created_by_username?: string | null
  tour_code?: string | null
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Demande',
  PLANNED: 'Planifie',
  PICKED_UP: 'Enleve',
  DELIVERED: 'Livre',
  CANCELLED: 'Annule',
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'var(--color-primary)',
  PLANNED: '#3b82f6',
  PICKED_UP: '#f59e0b',
  DELIVERED: '#22c55e',
  CANCELLED: '#6b7280',
}

function isUrgent(needed_by: string): boolean {
  const diff = (new Date(needed_by).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff <= 2
}

export default function CollectionRequests() {
  const [requests, setRequests] = useState<CollectionRequest[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  // Dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingReq, setEditingReq] = useState<CollectionRequest | null>(null)
  const [formSupplierId, setFormSupplierId] = useState<number | ''>('')
  const [formBaseId, setFormBaseId] = useState<number | ''>('')
  const [formEqp, setFormEqp] = useState('')
  const [formPickupDate, setFormPickupDate] = useState('')
  const [formNeededBy, setFormNeededBy] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formTransportNotes, setFormTransportNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter

      const [reqRes, suppRes, baseRes] = await Promise.all([
        api.get('/collection-requests/', { params }),
        api.get('/suppliers/'),
        api.get('/bases/'),
      ])
      setRequests(reqRes.data)
      setSuppliers(suppRes.data)
      setBases(baseRes.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditingReq(null)
    setFormSupplierId('')
    setFormBaseId('')
    setFormEqp('')
    setFormPickupDate('')
    setFormNeededBy('')
    setFormNotes('')
    setFormTransportNotes('')
    setShowDialog(true)
  }

  const openEdit = (req: CollectionRequest) => {
    setEditingReq(req)
    setFormSupplierId(req.supplier_id)
    setFormBaseId(req.base_id)
    setFormEqp(String(req.eqp_count))
    setFormPickupDate(req.pickup_date)
    setFormNeededBy(req.needed_by_date)
    setFormNotes(req.notes || '')
    setFormTransportNotes(req.transport_notes || '')
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formSupplierId || !formBaseId || !formEqp || !formPickupDate || !formNeededBy) return
    setSaving(true)
    try {
      if (editingReq) {
        await api.put(`/collection-requests/${editingReq.id}`, {
          eqp_count: Number(formEqp),
          pickup_date: formPickupDate,
          needed_by_date: formNeededBy,
          notes: formNotes || null,
          transport_notes: formTransportNotes || null,
        })
      } else {
        await api.post('/collection-requests/', {
          supplier_id: Number(formSupplierId),
          base_id: Number(formBaseId),
          eqp_count: Number(formEqp),
          pickup_date: formPickupDate,
          needed_by_date: formNeededBy,
          notes: formNotes || null,
        })
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
      await api.put(`/collection-requests/${id}`, { status: newStatus })
      fetchData()
    } catch {
      alert('Erreur')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette demande ?')) return
    try {
      await api.delete(`/collection-requests/${id}`)
      fetchData()
    } catch {
      alert('Erreur')
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'REQUESTED').length
  const totalEqp = requests
    .filter((r) => r.status === 'REQUESTED' || r.status === 'PLANNED')
    .reduce((s, r) => s + r.eqp_count, 0)

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Enlevements fournisseurs
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {pendingCount} en attente — {totalEqp.toFixed(1)} eq. a planifier
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          + Nouvelle demande
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border"
          style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
        >
          <option value="">Tous les statuts</option>
          <option value="REQUESTED">Demande</option>
          <option value="PLANNED">Planifie</option>
          <option value="PICKED_UP">Enleve</option>
          <option value="DELIVERED">Livre</option>
          <option value="CANCELLED">Annule</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Fournisseur</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Base dest.</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Eq.</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Enlevement</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Besoin base</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Tournee</th>
              <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Notes</th>
              <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune demande</td></tr>
            ) : requests.map((req) => (
              <tr
                key={req.id}
                className="border-t hover:opacity-80"
                style={{
                  borderColor: 'var(--border-color)',
                  backgroundColor: isUrgent(req.needed_by_date) && req.status === 'REQUESTED'
                    ? 'rgba(239,68,68,0.05)' : undefined,
                }}
              >
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                  {req.supplier?.name || '—'}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                  {req.base?.name || '—'}
                </td>
                <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                  {req.eqp_count}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                  {req.pickup_date}
                </td>
                <td className="px-3 py-2" style={{
                  color: isUrgent(req.needed_by_date) && req.status === 'REQUESTED'
                    ? 'var(--color-danger)' : 'var(--text-primary)',
                  fontWeight: isUrgent(req.needed_by_date) && req.status === 'REQUESTED' ? 600 : 400,
                }}>
                  {req.needed_by_date}
                  {isUrgent(req.needed_by_date) && req.status === 'REQUESTED' && ' !'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${STATUS_COLORS[req.status]}20`, color: STATUS_COLORS[req.status] }}
                  >
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                  {req.tour_code || '—'}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }} title={req.notes || ''}>
                  {req.notes || '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex gap-1 justify-end">
                    {req.status === 'REQUESTED' && (
                      <>
                        <button
                          onClick={() => openEdit(req)}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        >
                          Editer
                        </button>
                        <button
                          onClick={() => handleStatusChange(req.id, 'PLANNED')}
                          className="px-2 py-1 rounded text-xs text-white"
                          style={{ backgroundColor: '#3b82f6' }}
                        >
                          Planifier
                        </button>
                        <button
                          onClick={() => handleDelete(req.id)}
                          className="px-2 py-1 rounded text-xs text-white"
                          style={{ backgroundColor: 'var(--color-danger)' }}
                        >
                          Suppr.
                        </button>
                      </>
                    )}
                    {req.status === 'PLANNED' && (
                      <button
                        onClick={() => handleStatusChange(req.id, 'PICKED_UP')}
                        className="px-2 py-1 rounded text-xs text-white"
                        style={{ backgroundColor: '#f59e0b' }}
                      >
                        Enleve
                      </button>
                    )}
                    {req.status === 'PICKED_UP' && (
                      <button
                        onClick={() => handleStatusChange(req.id, 'DELIVERED')}
                        className="px-2 py-1 rounded text-xs text-white"
                        style={{ backgroundColor: '#22c55e' }}
                      >
                        Livre
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog creation/edition */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingReq ? 'Modifier la demande' : 'Nouvelle demande d\'enlevement'}
            </h2>

            <div className="space-y-3">
              {/* Fournisseur */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Fournisseur</label>
                <select
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(Number(e.target.value))}
                  disabled={!!editingReq}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selectionner...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {/* Base destination */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Base destination</label>
                <select
                  value={formBaseId}
                  onChange={(e) => setFormBaseId(Number(e.target.value))}
                  disabled={!!editingReq}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selectionner...</option>
                  {bases.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </div>

              {/* Equivalents */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nombre d'equivalents palette</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={formEqp}
                  onChange={(e) => setFormEqp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Date enlevement possible</label>
                  <input
                    type="date"
                    value={formPickupDate}
                    onChange={(e) => setFormPickupDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Besoin sur base au plus tard</label>
                  <input
                    type="date"
                    value={formNeededBy}
                    onChange={(e) => setFormNeededBy(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes appro</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Notes transport (edit only) */}
              {editingReq && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notes transport</label>
                  <textarea
                    value={formTransportNotes}
                    onChange={(e) => setFormTransportNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              )}
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
                disabled={saving || !formSupplierId || !formBaseId || !formEqp || !formPickupDate || !formNeededBy}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? 'Enregistrement...' : editingReq ? 'Modifier' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
