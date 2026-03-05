/* Registre CMR / CMR Waybill Registry — recherche et classification des CMR archivés */

import { useState, useEffect } from 'react'
import api from '../services/api'
import type { WaybillArchive, CMRStatus } from '../types'

const STATUS_LABELS: Record<CMRStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Brouillon', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  ISSUED: { label: 'Émis', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  DELIVERED: { label: 'Livré', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  CANCELLED: { label: 'Annulé', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

export default function WaybillRegistry() {
  const [archives, setArchives] = useState<WaybillArchive[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedArchive, setSelectedArchive] = useState<WaybillArchive | null>(null)

  const loadArchives = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await api.get(`/waybill-archives/?${params.toString()}`)
      setArchives(res.data)
    } catch (e) {
      console.error('Failed to load CMR archives', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArchives()
  }, [statusFilter, dateFrom, dateTo])

  const handleSearch = () => loadArchives()

  const parseSnapshot = (json: string | null | undefined): Record<string, unknown> | null => {
    if (!json) return null
    try { return JSON.parse(json) } catch { return null }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Registre CMR
        </h1>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {archives.length} document{archives.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filtres / Filters */}
      <div
        className="flex items-end gap-3 flex-wrap mb-4 p-4 rounded-xl border"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Recherche N° CMR
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="CMR-2026-..."
              className="px-3 py-1.5 rounded-lg text-sm border outline-none w-48"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              OK
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Statut
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border outline-none"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">Tous</option>
            <option value="ISSUED">Émis</option>
            <option value="DELIVERED">Livré</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Du
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border outline-none"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Au
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border outline-none"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Tableau / Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>N° CMR</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Tour</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Transporteur</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Chauffeur</th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Statut</th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Émis le</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    Chargement...
                  </td>
                </tr>
              ) : archives.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    Aucun CMR trouvé
                  </td>
                </tr>
              ) : archives.map((a) => {
                const snap = parseSnapshot(a.snapshot_json)
                const tourCode = (snap?.tour_code as string) || `Tour #${a.tour_id}`
                const transporter = ((snap?.contract as Record<string, unknown>)?.transporter_name as string) || '—'
                const driver = (snap?.driver_name as string) || '—'
                const st = STATUS_LABELS[a.status] || STATUS_LABELS.DRAFT

                return (
                  <tr
                    key={a.id}
                    className="border-t cursor-pointer transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border-color)' }}
                    onClick={() => setSelectedArchive(selectedArchive?.id === a.id ? null : a)}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: '#cc0000' }}>
                      {a.cmr_number}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tourCode}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {a.establishment_date
                        ? new Date(a.establishment_date + 'T00:00:00').toLocaleDateString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {transporter}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      {driver}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-bold"
                        style={{ backgroundColor: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {a.issued_at
                        ? new Date(a.issued_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Détail / Detail panel */}
      {selectedArchive && (
        <div
          className="mt-4 p-4 rounded-xl border"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: '#cc0000' }}>
              {selectedArchive.cmr_number} — Détails
            </h3>
            <button
              onClick={() => setSelectedArchive(null)}
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Fermer
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Lieu d'établissement :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.establishment_place || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Date d'établissement :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.establishment_date || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Instructions expéditeur :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.sender_instructions || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Réserves transporteur :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.reservations || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Documents annexés :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.attached_documents || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Conventions particulières :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.special_agreements || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Destinataire (réception) :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.recipient_name || '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Remarques livraison :</span><br />
              <span style={{ color: 'var(--text-primary)' }}>{selectedArchive.delivery_remarks || '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
