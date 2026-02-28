/* Page Inspections vehicules / Vehicle inspections management page */

import { useState } from 'react'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { DataTable } from '../components/data/DataTable'
import { useApi } from '../hooks/useApi'
import type { VehicleInspection, InspectionTemplate, Vehicle } from '../types'

const CATEGORY_LABELS: Record<string, string> = {
  EXTERIOR: 'Exterieur',
  CABIN: 'Cabine',
  ENGINE: 'Moteur',
  BRAKES: 'Freins',
  TIRES: 'Pneus',
  LIGHTS: 'Eclairage',
  CARGO: 'Cargo',
  REFRIGERATION: 'Froid',
  SAFETY: 'Securite',
  DOCUMENTS: 'Documents',
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TRACTEUR: 'Tracteur',
  SEMI_REMORQUE: 'Semi-remorque',
  PORTEUR: 'Porteur',
  REMORQUE: 'Remorque',
  VL: 'VL',
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

export default function InspectionManagement() {
  const [tab, setTab] = useState<'inspections' | 'templates'>('inspections')
  const { data: vehicles } = useApi<Vehicle>('/vehicles')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Inspections vehicules
      </h1>

      {/* Onglets */}
      <div className="flex gap-1 mb-4">
        {(['inspections', 'templates'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${tab === t ? 'border-b-2' : ''}`}
            style={{
              backgroundColor: tab === t ? 'var(--bg-secondary)' : 'transparent',
              color: tab === t ? 'var(--color-primary)' : 'var(--text-muted)',
              borderColor: tab === t ? 'var(--color-primary)' : 'transparent',
            }}
          >
            {t === 'inspections' ? 'Inspections' : 'Templates'}
          </button>
        ))}
      </div>

      {tab === 'inspections' && <InspectionsList vehicles={vehicles} />}
      {tab === 'templates' && <TemplatesCrud />}
    </div>
  )
}

function InspectionsList({ vehicles }: { vehicles: Vehicle[] }) {
  const [filters, setFilters] = useState({ vehicle_id: '', has_defects: '' })
  const params: Record<string, unknown> = {}
  if (filters.vehicle_id) params.vehicle_id = Number(filters.vehicle_id)
  if (filters.has_defects === 'true') params.has_defects = true

  const { data: inspections, loading } = useApi<VehicleInspection>('/inspections', params)
  const [selected, setSelected] = useState<VehicleInspection | null>(null)

  const columns: Column<VehicleInspection>[] = [
    { key: 'id', label: '#', width: '50px' },
    {
      key: 'vehicle_code', label: 'Vehicule', width: '120px', filterable: true,
      render: (row) => row.vehicle_code || `#${row.vehicle_id}`,
    },
    {
      key: 'inspection_type', label: 'Type', width: '120px', filterable: true,
      render: (row) => row.inspection_type === 'PRE_DEPARTURE' ? 'Pre-depart' :
        row.inspection_type === 'POST_RETURN' ? 'Retour' : 'Periodique',
    },
    {
      key: 'status', label: 'Statut', width: '100px',
      render: (row) => (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: row.status === 'COMPLETED' ? '#22c55e20' : row.status === 'IN_PROGRESS' ? '#f59e0b20' : '#6b728020',
            color: row.status === 'COMPLETED' ? '#22c55e' : row.status === 'IN_PROGRESS' ? '#f59e0b' : '#6b7280',
          }}
        >
          {row.status === 'COMPLETED' ? 'Termine' : row.status === 'IN_PROGRESS' ? 'En cours' : 'Annule'}
        </span>
      ),
    },
    {
      key: 'has_critical_defect', label: 'Defauts', width: '80px',
      render: (row) => row.has_critical_defect
        ? <span className="text-red-500 font-bold">KO</span>
        : <span className="text-green-500">OK</span>,
    },
    { key: 'driver_name', label: 'Chauffeur', width: '120px', filterable: true },
    {
      key: 'started_at', label: 'Date', width: '150px',
      render: (row) => row.started_at?.substring(0, 16).replace('T', ' ') || '—',
    },
    {
      key: 'km_at_inspection', label: 'Km', width: '80px',
      render: (row) => row.km_at_inspection?.toLocaleString() || '—',
    },
  ]

  return (
    <div>
      {/* Filtres */}
      <div className="flex gap-4 mb-4">
        <select
          value={filters.vehicle_id}
          onChange={(e) => setFilters({ ...filters, vehicle_id: e.target.value })}
          className="rounded px-3 py-1.5 text-sm"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
        >
          <option value="">Tous les vehicules</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.code} - {v.name || v.license_plate}</option>
          ))}
        </select>
        <select
          value={filters.has_defects}
          onChange={(e) => setFilters({ ...filters, has_defects: e.target.value })}
          className="rounded px-3 py-1.5 text-sm"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
        >
          <option value="">Toutes les inspections</option>
          <option value="true">Avec defauts critiques</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={inspections}
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
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-lg" style={{ color: 'var(--text-muted)' }}>x</button>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Inspection #{selected.id} — {selected.vehicle_code}
            </h2>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              Type : {selected.inspection_type} | Statut : {selected.status}
            </p>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
              Chauffeur : {selected.driver_name || '—'} | Km : {selected.km_at_inspection?.toLocaleString() || '—'}
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Date : {selected.started_at?.substring(0, 16).replace('T', ' ')}
            </p>

            {selected.remarks && (
              <p className="text-sm mb-4 italic" style={{ color: 'var(--text-muted)' }}>
                Remarques : {selected.remarks}
              </p>
            )}

            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Points de controle ({selected.items?.length || 0})
            </h3>
            <div className="space-y-1 mb-4">
              {(selected.items || []).map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm py-1 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{
                      backgroundColor: item.result === 'OK' ? '#22c55e20' : item.result === 'KO' ? '#ef444420' : '#6b728020',
                      color: item.result === 'OK' ? '#22c55e' : item.result === 'KO' ? '#ef4444' : '#6b7280',
                    }}
                  >
                    {item.result}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                  {item.is_critical && <span className="text-xs text-red-500">(critique)</span>}
                  {item.comment && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— {item.comment}</span>}
                </div>
              ))}
            </div>

            {(selected.photos || []).length > 0 && (
              <>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Photos ({selected.photos.length})
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {selected.photos.map((photo) => (
                    <img
                      key={photo.id}
                      src={`/api/inspections/${selected.id}/photos/${photo.id}`}
                      alt={photo.filename}
                      className="rounded border object-cover w-full h-24"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TemplatesCrud() {
  const columns: Column<InspectionTemplate>[] = [
    { key: 'display_order', label: 'Ordre', width: '60px' },
    { key: 'label', label: 'Libelle', filterable: true },
    {
      key: 'category', label: 'Categorie', width: '110px', filterable: true,
      render: (row) => CATEGORY_LABELS[row.category] || row.category,
      filterValue: (row) => CATEGORY_LABELS[row.category] || row.category,
    },
    {
      key: 'applicable_vehicle_types', label: 'Types vehicule', width: '160px',
      render: (row) => row.applicable_vehicle_types
        ? row.applicable_vehicle_types.split(',').map(t => VEHICLE_TYPE_LABELS[t] || t).join(', ')
        : 'Tous',
    },
    {
      key: 'is_critical', label: 'Critique', width: '70px',
      render: (row) => row.is_critical ? <span className="text-red-500 font-bold">Oui</span> : 'Non',
    },
    {
      key: 'requires_photo', label: 'Photo', width: '60px',
      render: (row) => row.requires_photo ? 'Oui' : 'Non',
    },
    {
      key: 'is_active', label: 'Actif', width: '60px',
      render: (row) => row.is_active ? <span className="text-green-500">Oui</span> : <span className="text-gray-400">Non</span>,
    },
  ]

  const fields: FieldDef[] = [
    { key: 'label', label: 'Libelle', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'category', label: 'Categorie', type: 'select', required: true, options: CATEGORY_OPTIONS },
    { key: 'applicable_vehicle_types', label: 'Types vehicule (CSV, vide=tous)', type: 'text', placeholder: 'TRACTEUR,PORTEUR,SEMI_REMORQUE' },
    { key: 'is_critical', label: 'Critique (bloquant si KO)', type: 'checkbox' },
    { key: 'requires_photo', label: 'Photo requise si KO', type: 'checkbox' },
    { key: 'display_order', label: 'Ordre affichage', type: 'number', defaultValue: 0 },
    { key: 'is_active', label: 'Actif', type: 'checkbox', defaultValue: true },
  ]

  return (
    <CrudPage<InspectionTemplate>
      title=""
      endpoint="/inspections/templates"
      columns={columns}
      fields={fields}
      searchKeys={['label']}
      createTitle="Nouveau template"
      editTitle="Modifier template"
    />
  )
}
