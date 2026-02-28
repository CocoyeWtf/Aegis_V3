/* Page Vehicules / Vehicle management page */

import { useState, useCallback } from 'react'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import { VehicleQRLabel } from '../components/print/VehicleQRLabel'
import api from '../services/api'
import type { Vehicle, Region } from '../types'

const VEHICLE_TYPES = [
  { value: 'TRACTEUR', label: 'Tracteur' },
  { value: 'SEMI_REMORQUE', label: 'Semi-remorque' },
  { value: 'PORTEUR', label: 'Porteur' },
  { value: 'REMORQUE', label: 'Remorque' },
  { value: 'VL', label: 'VL' },
]

const VEHICLE_STATUSES = [
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'MAINTENANCE', label: 'En entretien' },
  { value: 'OUT_OF_SERVICE', label: 'Hors service' },
  { value: 'DISPOSED', label: 'Vendu/Reforme' },
]

const FUEL_TYPES = [
  { value: 'DIESEL', label: 'Diesel' },
  { value: 'ESSENCE', label: 'Essence' },
  { value: 'GNV', label: 'GNV' },
  { value: 'ELECTRIQUE', label: 'Electrique' },
  { value: 'HYBRIDE', label: 'Hybride' },
]

const OWNERSHIP_TYPES = [
  { value: 'OWNED', label: 'Propriete' },
  { value: 'LEASED', label: 'Leasing (LLD)' },
  { value: 'RENTED', label: 'Location courte duree' },
]

const TEMP_TYPES = [
  { value: 'SEC', label: 'Sec' },
  { value: 'FRAIS', label: 'Frais' },
  { value: 'GEL', label: 'Gel' },
  { value: 'BI_TEMP', label: 'Bi-temperature' },
  { value: 'TRI_TEMP', label: 'Tri-temperature' },
]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  MAINTENANCE: '#f59e0b',
  OUT_OF_SERVICE: '#ef4444',
  DISPOSED: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  MAINTENANCE: 'Entretien',
  OUT_OF_SERVICE: 'Hors service',
  DISPOSED: 'Reforme',
}

const TYPE_LABELS: Record<string, string> = {
  TRACTEUR: 'Tracteur',
  SEMI_REMORQUE: 'Semi-remorque',
  PORTEUR: 'Porteur',
  REMORQUE: 'Remorque',
  VL: 'VL',
  SEMI: 'Semi (legacy)',
  PORTEUR_REMORQUE: 'Port.+Rem. (legacy)',
  CITY: 'City (legacy)',
}

const OWNERSHIP_LABELS: Record<string, string> = {
  OWNED: 'Propriete',
  LEASED: 'LLD',
  RENTED: 'Location',
}

export default function VehicleManagement() {
  const { data: regions } = useApi<Region>('/regions')
  const [qrVehicle, setQrVehicle] = useState<Vehicle | null>(null)

  const handleRegenerate = useCallback(async () => {
    if (!qrVehicle) return
    const { data } = await api.post<Vehicle>(`/vehicles/${qrVehicle.id}/regenerate-qr`)
    setQrVehicle(data)
  }, [qrVehicle])

  const columns: Column<Vehicle>[] = [
    { key: 'code', label: 'Code', width: '80px', filterable: true },
    { key: 'name', label: 'Nom', filterable: true },
    { key: 'license_plate', label: 'Immatriculation', width: '120px', filterable: true },
    {
      key: 'fleet_vehicle_type', label: 'Type', width: '120px', filterable: true,
      render: (row) => TYPE_LABELS[row.fleet_vehicle_type] || row.fleet_vehicle_type,
      filterValue: (row) => TYPE_LABELS[row.fleet_vehicle_type] || row.fleet_vehicle_type,
    },
    {
      key: 'status', label: 'Statut', width: '100px', filterable: true,
      render: (row) => (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: STATUS_COLORS[row.status] + '20', color: STATUS_COLORS[row.status] }}
        >
          {STATUS_LABELS[row.status] || row.status}
        </span>
      ),
      filterValue: (row) => STATUS_LABELS[row.status] || row.status,
    },
    {
      key: 'ownership_type', label: 'Propriete', width: '90px', filterable: true,
      render: (row) => OWNERSHIP_LABELS[row.ownership_type || ''] || '—',
      filterValue: (row) => OWNERSHIP_LABELS[row.ownership_type || ''] || '',
    },
    { key: 'brand', label: 'Marque', width: '100px', filterable: true },
    {
      key: 'current_km', label: 'Km', width: '90px',
      render: (row) => row.current_km ? row.current_km.toLocaleString() : '—',
    },
    {
      key: 'region_id', label: 'Region', width: '100px', filterable: true,
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
      filterValue: (row) => regions.find((r) => r.id === row.region_id)?.name || '',
    },
    {
      key: 'qr_code' as keyof Vehicle, label: 'QR', width: '60px',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); setQrVehicle(row) }}
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          title="Voir QR vehicule"
        >
          QR
        </button>
      ),
    },
  ]

  const fields: FieldDef[] = [
    // Identification
    { key: 'code', label: 'Code vehicule', type: 'text', required: true },
    { key: 'name', label: 'Nom / Designation', type: 'text' },
    { key: 'license_plate', label: 'Immatriculation', type: 'text' },
    { key: 'vin', label: 'N° de chassis (VIN)', type: 'text' },
    { key: 'brand', label: 'Marque', type: 'text' },
    { key: 'model', label: 'Modele', type: 'text' },
    // Classification
    { key: 'fleet_vehicle_type', label: 'Type de vehicule', type: 'select', required: true, options: VEHICLE_TYPES },
    { key: 'status', label: 'Statut', type: 'select', options: VEHICLE_STATUSES, defaultValue: 'ACTIVE' },
    { key: 'fuel_type', label: 'Carburant', type: 'select', options: FUEL_TYPES },
    // Capacite
    { key: 'temperature_type', label: 'Temperature', type: 'select', options: TEMP_TYPES },
    { key: 'capacity_eqp', label: 'Capacite EQP', type: 'number' },
    { key: 'capacity_weight_kg', label: 'Capacite poids (kg)', type: 'number' },
    { key: 'has_tailgate', label: 'Hayon', type: 'checkbox' },
    // Dates
    { key: 'first_registration_date', label: 'Date 1ere immatriculation', type: 'date' },
    { key: 'acquisition_date', label: 'Date acquisition', type: 'date' },
    // Km
    { key: 'current_km', label: 'Km actuels', type: 'number' },
    // Detention
    { key: 'ownership_type', label: 'Mode de detention', type: 'select', options: OWNERSHIP_TYPES },
    // Leasing (visible si LEASED)
    { key: 'lessor_name', label: 'Loueur', type: 'text', hidden: (d) => d.ownership_type !== 'LEASED' },
    { key: 'lease_start_date', label: 'Debut leasing', type: 'date', hidden: (d) => d.ownership_type !== 'LEASED' },
    { key: 'lease_end_date', label: 'Fin leasing', type: 'date', hidden: (d) => d.ownership_type !== 'LEASED' },
    { key: 'monthly_lease_cost', label: 'Loyer mensuel (EUR)', type: 'number', step: 0.01, hidden: (d) => d.ownership_type !== 'LEASED' },
    { key: 'lease_contract_ref', label: 'Ref contrat leasing', type: 'text', hidden: (d) => d.ownership_type !== 'LEASED' },
    // Amortissement (visible si OWNED)
    { key: 'purchase_price', label: 'Prix d\'achat (EUR)', type: 'number', step: 0.01, hidden: (d) => d.ownership_type !== 'OWNED' },
    { key: 'depreciation_years', label: 'Duree amortissement (ans)', type: 'number', hidden: (d) => d.ownership_type !== 'OWNED' },
    { key: 'residual_value', label: 'Valeur residuelle (EUR)', type: 'number', step: 0.01, hidden: (d) => d.ownership_type !== 'OWNED' },
    // Assurance
    { key: 'insurance_company', label: 'Assureur', type: 'text' },
    { key: 'insurance_policy_number', label: 'N° police', type: 'text' },
    { key: 'insurance_start_date', label: 'Debut assurance', type: 'date' },
    { key: 'insurance_end_date', label: 'Fin assurance', type: 'date' },
    { key: 'insurance_annual_cost', label: 'Cout annuel assurance (EUR)', type: 'number', step: 0.01 },
    // Reglementaire
    { key: 'last_technical_inspection_date', label: 'Dernier controle technique', type: 'date' },
    { key: 'next_technical_inspection_date', label: 'Prochain controle technique', type: 'date' },
    { key: 'tachograph_type', label: 'Type tachographe', type: 'text', placeholder: 'ANALOG / DIGITAL / SMART' },
    { key: 'tachograph_next_calibration', label: 'Prochaine calibration tacho', type: 'date' },
    // Region
    {
      key: 'region_id', label: 'Region', type: 'select',
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
    // Notes
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <>
      <CrudPage<Vehicle>
        title="Vehicules"
        endpoint="/vehicles"
        columns={columns}
        fields={fields}
        searchKeys={['code', 'name', 'license_plate', 'brand']}
        createTitle="Nouveau vehicule"
        editTitle="Modifier vehicule"
        exportEntity="vehicles"
        transformPayload={(d) => ({
          ...d,
          region_id: d.region_id ? Number(d.region_id) : null,
          capacity_eqp: d.capacity_eqp ? Number(d.capacity_eqp) : null,
          capacity_weight_kg: d.capacity_weight_kg ? Number(d.capacity_weight_kg) : null,
          current_km: d.current_km ? Number(d.current_km) : null,
          monthly_lease_cost: d.monthly_lease_cost ? Number(d.monthly_lease_cost) : null,
          purchase_price: d.purchase_price ? Number(d.purchase_price) : null,
          depreciation_years: d.depreciation_years ? Number(d.depreciation_years) : null,
          residual_value: d.residual_value ? Number(d.residual_value) : null,
          insurance_annual_cost: d.insurance_annual_cost ? Number(d.insurance_annual_cost) : null,
        })}
      />

      {/* Modal QR vehicule / Vehicle QR modal */}
      {qrVehicle && qrVehicle.qr_code && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
          onClick={() => setQrVehicle(null)}
        >
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <VehicleQRLabel
              qrCode={qrVehicle.qr_code}
              vehicleCode={qrVehicle.code}
              licensePlate={qrVehicle.license_plate}
              vehicleType={qrVehicle.fleet_vehicle_type}
              onClose={() => setQrVehicle(null)}
              onRegenerate={handleRegenerate}
            />
          </div>
        </div>
      )}
    </>
  )
}
