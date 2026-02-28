/* Page declarations chauffeur / Driver declarations management page */

import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { DataTable } from '../components/data/DataTable'
import type { Column } from '../components/data/DataTable'
import type { Declaration } from '../types'

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ANOMALY:       { label: 'Anomalie',           color: '#f59e0b', bg: '#f59e0b20' },
  BREAKAGE:      { label: 'Casse',              color: '#ef4444', bg: '#ef444420' },
  ACCIDENT:      { label: 'Accident',           color: '#dc2626', bg: '#dc262620' },
  VEHICLE_ISSUE: { label: 'Probleme vehicule',  color: '#8b5cf6', bg: '#8b5cf620' },
  CLIENT_ISSUE:  { label: 'Probleme client',    color: '#3b82f6', bg: '#3b82f620' },
  OTHER:         { label: 'Autre',              color: '#6b7280', bg: '#6b728020' },
}

function defaultDateFrom(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DeclarationManagement() {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(today)
  const [typeFilter, setTypeFilter] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({
    date_from: defaultDateFrom(),
    date_to: today(),
  })

  const { data: declarations, loading } = useApi<Declaration>('/declarations', appliedFilters)
  const [selected, setSelected] = useState<Declaration | null>(null)
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ declarationId: number; photoId: number } | null>(null)

  const handleFilter = () => {
    const params: Record<string, unknown> = {}
    if (dateFrom) params.date_from = dateFrom
    if (dateTo) params.date_to = dateTo
    if (typeFilter) params.declaration_type = typeFilter
    setAppliedFilters(params)
  }

  const columns: Column<Declaration>[] = [
    {
      key: 'created_at', label: 'Date', width: '150px',
      render: (row) => row.created_at?.substring(0, 16).replace('T', ' ') || '—',
    },
    {
      key: 'declaration_type', label: 'Type', width: '150px', filterable: true,
      render: (row) => {
        const t = TYPE_LABELS[row.declaration_type]
        return (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: t?.bg || '#6b728020', color: t?.color || '#6b7280' }}
          >
            {t?.label || row.declaration_type}
          </span>
        )
      },
      filterValue: (row) => TYPE_LABELS[row.declaration_type]?.label || row.declaration_type,
    },
    {
      key: 'driver_name', label: 'Chauffeur', width: '140px', filterable: true,
      render: (row) => row.driver_name || '—',
    },
    {
      key: 'tour_id', label: 'Tour', width: '80px',
      render: (row) => row.tour_id ? `#${row.tour_id}` : '—',
    },
    {
      key: 'description', label: 'Description',
      render: (row) => {
        const desc = row.description || '—'
        return <span title={desc}>{desc.length > 60 ? desc.substring(0, 60) + '...' : desc}</span>
      },
    },
    {
      key: 'photos' as keyof Declaration, label: 'Photos', width: '70px',
      render: (row) => row.photos?.length || 0,
    },
  ]

  const inputStyle = {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Declarations chauffeur
      </h1>

      {/* Filtres */}
      <div className="flex gap-4 mb-4 items-end flex-wrap">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Date debut</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded px-3 py-1.5 text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Date fin</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded px-3 py-1.5 text-sm"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded px-3 py-1.5 text-sm"
            style={inputStyle}
          >
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-1.5 rounded text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          Filtrer
        </button>
      </div>

      <DataTable
        columns={columns}
        data={declarations}
        loading={loading}
        onRowClick={(row) => setSelected(row)}
      />

      {/* Detail panel */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={() => setSelected(null)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-lg overflow-y-auto p-6"
            style={{ backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              x
            </button>

            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Declaration #{selected.id}
            </h2>

            <div className="space-y-1 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <p>
                <span style={{ color: 'var(--text-muted)' }}>Type : </span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: TYPE_LABELS[selected.declaration_type]?.bg || '#6b728020',
                    color: TYPE_LABELS[selected.declaration_type]?.color || '#6b7280',
                  }}
                >
                  {TYPE_LABELS[selected.declaration_type]?.label || selected.declaration_type}
                </span>
              </p>
              <p>Chauffeur : {selected.driver_name || '—'}</p>
              <p>Date : {selected.created_at?.substring(0, 16).replace('T', ' ')}</p>
              <p>Tour : {selected.tour_id ? `#${selected.tour_id}` : '—'}
                {selected.tour_stop_id ? ` (arret #${selected.tour_stop_id})` : ''}</p>
              {(selected.latitude != null && selected.longitude != null) && (
                <p>GPS : {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                  {selected.accuracy != null ? ` (±${selected.accuracy.toFixed(0)}m)` : ''}</p>
              )}
            </div>

            {selected.description && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Description</h3>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                  {selected.description}
                </p>
              </div>
            )}

            {(selected.photos || []).length > 0 && (
              <>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Photos ({selected.photos.length})
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {selected.photos.map((photo) => (
                    <img
                      key={photo.id}
                      src={`/api/declarations/${selected.id}/photos/${photo.id}`}
                      alt={photo.filename}
                      className="rounded border object-cover w-full h-24 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ borderColor: 'var(--border-color)' }}
                      onClick={() => setFullscreenPhoto({ declarationId: selected.id, photoId: photo.id })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modale photo plein ecran */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 cursor-pointer"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:opacity-80"
            onClick={() => setFullscreenPhoto(null)}
          >
            x
          </button>
          <img
            src={`/api/declarations/${fullscreenPhoto.declarationId}/photos/${fullscreenPhoto.photoId}`}
            alt="Photo declaration"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
