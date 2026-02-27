/* Page Gestion de flotte / Fleet management page */

import { useState, useEffect } from 'react'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import api from '../services/api'
import type {
  Vehicle,
  VehicleSummary,
  MaintenanceRecord,
  MaintenanceScheduleRule,
  FuelEntry,
  VehicleModificationEntry,
  VehicleCostEntry,
  FleetDashboard,
  VehicleTCOItem,
} from '../types'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

/* ─── Labels ─── */

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  OIL_CHANGE: 'Vidange',
  BRAKE_SERVICE: 'Freins',
  TIRE_REPLACEMENT: 'Pneus',
  TECHNICAL_INSPECTION: 'Controle technique',
  TACHOGRAPH_CALIBRATION: 'Calibration tacho',
  REFRIGERATION_SERVICE: 'Entretien froid',
  GENERAL_SERVICE: 'Revision generale',
  REPAIR: 'Reparation',
  BODYWORK: 'Carrosserie',
  OTHER: 'Autre',
}

const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Planifie',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Termine',
  CANCELLED: 'Annule',
}

const MAINTENANCE_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#22c55e',
  CANCELLED: '#6b7280',
}

const COST_CATEGORY_LABELS: Record<string, string> = {
  INSURANCE: 'Assurance',
  TAX: 'Taxe',
  FINE: 'Amende',
  TOLL: 'Peage',
  PARKING: 'Parking',
  OTHER: 'Autre',
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TRACTEUR: 'Tracteur',
  SEMI_REMORQUE: 'Semi-remorque',
  PORTEUR: 'Porteur',
  REMORQUE: 'Remorque',
  VL: 'VL',
}

const MAINTENANCE_TYPE_OPTIONS = Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const MAINTENANCE_STATUS_OPTIONS = Object.entries(MAINTENANCE_STATUS_LABELS).map(([value, label]) => ({ value, label }))
const COST_CATEGORY_OPTIONS = Object.entries(COST_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const VEHICLE_TYPE_OPTIONS = Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => ({ value, label }))

type TabKey = 'maintenance' | 'fuel' | 'modifications' | 'costs' | 'rules' | 'tco'

export default function FleetManagement() {
  const [tab, setTab] = useState<TabKey>('maintenance')
  const { data: vehicles } = useApi<Vehicle>('/vehicles')

  const vehicleOptions = vehicles.map((v) => ({
    value: String(v.id),
    label: `${v.code} - ${v.name || v.license_plate || ''}`,
  }))

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'maintenance', label: 'Entretiens' },
    { key: 'fuel', label: 'Carburant' },
    { key: 'modifications', label: 'Modifications' },
    { key: 'costs', label: 'Couts divers' },
    { key: 'rules', label: 'Regles planification' },
    { key: 'tco', label: 'Tableau de bord TCO' },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Gestion de flotte
      </h1>

      {/* Onglets */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${tab === t.key ? 'border-b-2' : ''}`}
            style={{
              backgroundColor: tab === t.key ? 'var(--bg-secondary)' : 'transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--text-muted)',
              borderColor: tab === t.key ? 'var(--color-primary)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'maintenance' && <MaintenanceCrud vehicleOptions={vehicleOptions} />}
      {tab === 'fuel' && <FuelCrud vehicleOptions={vehicleOptions} />}
      {tab === 'modifications' && <ModificationsCrud vehicleOptions={vehicleOptions} />}
      {tab === 'costs' && <CostsCrud vehicleOptions={vehicleOptions} />}
      {tab === 'rules' && <ScheduleRulesCrud />}
      {tab === 'tco' && <TCODashboard />}
    </div>
  )
}

/* ─── Entretiens / Maintenance ─── */

function MaintenanceCrud({ vehicleOptions }: { vehicleOptions: { value: string; label: string }[] }) {
  const columns: Column<MaintenanceRecord>[] = [
    { key: 'id', label: '#', width: '50px' },
    {
      key: 'vehicle_id', label: 'Vehicule', width: '120px', filterable: true,
      render: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || `#${row.vehicle_id}`,
      filterValue: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || '',
    },
    {
      key: 'maintenance_type', label: 'Type', width: '130px', filterable: true,
      render: (row) => MAINTENANCE_TYPE_LABELS[row.maintenance_type] || row.maintenance_type,
      filterValue: (row) => MAINTENANCE_TYPE_LABELS[row.maintenance_type] || row.maintenance_type,
    },
    {
      key: 'status', label: 'Statut', width: '100px', filterable: true,
      render: (row) => (
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            backgroundColor: (MAINTENANCE_STATUS_COLORS[row.status] || '#6b7280') + '20',
            color: MAINTENANCE_STATUS_COLORS[row.status] || '#6b7280',
          }}
        >
          {MAINTENANCE_STATUS_LABELS[row.status] || row.status}
        </span>
      ),
      filterValue: (row) => MAINTENANCE_STATUS_LABELS[row.status] || row.status,
    },
    { key: 'provider_name', label: 'Prestataire', width: '120px', filterable: true },
    { key: 'scheduled_date', label: 'Date prevue', width: '100px' },
    { key: 'completed_date', label: 'Date realisee', width: '100px' },
    {
      key: 'cost_total', label: 'Cout total', width: '90px',
      render: (row) => row.cost_total != null ? `${row.cost_total.toLocaleString()} €` : '—',
    },
    { key: 'invoice_ref', label: 'Facture', width: '100px' },
  ]

  const fields: FieldDef[] = [
    { key: 'vehicle_id', label: 'Vehicule', type: 'select', required: true, options: vehicleOptions },
    { key: 'maintenance_type', label: 'Type entretien', type: 'select', required: true, options: MAINTENANCE_TYPE_OPTIONS },
    { key: 'status', label: 'Statut', type: 'select', options: MAINTENANCE_STATUS_OPTIONS, defaultValue: 'SCHEDULED' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'provider_name', label: 'Prestataire', type: 'text' },
    { key: 'scheduled_date', label: 'Date prevue', type: 'date' },
    { key: 'scheduled_km', label: 'Km prevu', type: 'number' },
    { key: 'completed_date', label: 'Date realisee', type: 'date' },
    { key: 'km_at_service', label: 'Km lors entretien', type: 'number' },
    { key: 'cost_parts', label: 'Cout pieces (EUR)', type: 'number', step: 0.01 },
    { key: 'cost_labor', label: 'Cout main d\'oeuvre (EUR)', type: 'number', step: 0.01 },
    { key: 'cost_total', label: 'Cout total (EUR)', type: 'number', step: 0.01 },
    { key: 'invoice_ref', label: 'Ref facture', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <CrudPage<MaintenanceRecord>
      title=""
      endpoint="/fleet/maintenance"
      columns={columns}
      fields={fields}
      searchKeys={['provider_name', 'description']}
      createTitle="Nouvel entretien"
      editTitle="Modifier entretien"
      transformPayload={(d) => ({
        ...d,
        vehicle_id: d.vehicle_id ? Number(d.vehicle_id) : null,
        scheduled_km: d.scheduled_km ? Number(d.scheduled_km) : null,
        km_at_service: d.km_at_service ? Number(d.km_at_service) : null,
        cost_parts: d.cost_parts ? Number(d.cost_parts) : null,
        cost_labor: d.cost_labor ? Number(d.cost_labor) : null,
        cost_total: d.cost_total ? Number(d.cost_total) : null,
      })}
    />
  )
}

/* ─── Carburant / Fuel ─── */

function FuelCrud({ vehicleOptions }: { vehicleOptions: { value: string; label: string }[] }) {
  const columns: Column<FuelEntry>[] = [
    { key: 'id', label: '#', width: '50px' },
    {
      key: 'vehicle_id', label: 'Vehicule', width: '120px', filterable: true,
      render: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || `#${row.vehicle_id}`,
      filterValue: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || '',
    },
    { key: 'date', label: 'Date', width: '100px' },
    {
      key: 'km_at_fill', label: 'Km', width: '80px',
      render: (row) => row.km_at_fill?.toLocaleString() || '—',
    },
    {
      key: 'liters', label: 'Litres', width: '80px',
      render: (row) => `${row.liters.toFixed(1)} L`,
    },
    {
      key: 'price_per_liter', label: 'Prix/L', width: '80px',
      render: (row) => row.price_per_liter != null ? `${row.price_per_liter.toFixed(3)} €` : '—',
    },
    {
      key: 'total_cost', label: 'Total', width: '90px',
      render: (row) => row.total_cost != null ? `${row.total_cost.toFixed(2)} €` : '—',
    },
    {
      key: 'is_full_tank', label: 'Plein', width: '60px',
      render: (row) => row.is_full_tank ? 'Oui' : 'Non',
    },
    { key: 'station_name', label: 'Station', width: '120px', filterable: true },
    { key: 'driver_name', label: 'Chauffeur', width: '110px', filterable: true },
  ]

  const fields: FieldDef[] = [
    { key: 'vehicle_id', label: 'Vehicule', type: 'select', required: true, options: vehicleOptions },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'km_at_fill', label: 'Km au plein', type: 'number' },
    { key: 'liters', label: 'Litres', type: 'number', step: 0.1, required: true },
    { key: 'price_per_liter', label: 'Prix par litre (EUR)', type: 'number', step: 0.001 },
    { key: 'total_cost', label: 'Cout total (EUR)', type: 'number', step: 0.01 },
    { key: 'is_full_tank', label: 'Plein complet', type: 'checkbox', defaultValue: true },
    { key: 'station_name', label: 'Station', type: 'text' },
    { key: 'driver_name', label: 'Chauffeur', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <CrudPage<FuelEntry>
      title=""
      endpoint="/fleet/fuel"
      columns={columns}
      fields={fields}
      searchKeys={['station_name', 'driver_name']}
      createTitle="Nouveau plein"
      editTitle="Modifier plein"
      transformPayload={(d) => ({
        ...d,
        vehicle_id: d.vehicle_id ? Number(d.vehicle_id) : null,
        km_at_fill: d.km_at_fill ? Number(d.km_at_fill) : null,
        liters: d.liters ? Number(d.liters) : null,
        price_per_liter: d.price_per_liter ? Number(d.price_per_liter) : null,
        total_cost: d.total_cost ? Number(d.total_cost) : null,
      })}
    />
  )
}

/* ─── Modifications ─── */

function ModificationsCrud({ vehicleOptions }: { vehicleOptions: { value: string; label: string }[] }) {
  const columns: Column<VehicleModificationEntry>[] = [
    { key: 'id', label: '#', width: '50px' },
    {
      key: 'vehicle_id', label: 'Vehicule', width: '120px', filterable: true,
      render: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || `#${row.vehicle_id}`,
      filterValue: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || '',
    },
    { key: 'date', label: 'Date', width: '100px' },
    { key: 'description', label: 'Description', filterable: true },
    {
      key: 'cost', label: 'Cout', width: '90px',
      render: (row) => row.cost != null ? `${row.cost.toLocaleString()} €` : '—',
    },
    { key: 'provider_name', label: 'Prestataire', width: '120px', filterable: true },
    { key: 'invoice_ref', label: 'Facture', width: '100px' },
  ]

  const fields: FieldDef[] = [
    { key: 'vehicle_id', label: 'Vehicule', type: 'select', required: true, options: vehicleOptions },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'cost', label: 'Cout (EUR)', type: 'number', step: 0.01 },
    { key: 'provider_name', label: 'Prestataire', type: 'text' },
    { key: 'invoice_ref', label: 'Ref facture', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <CrudPage<VehicleModificationEntry>
      title=""
      endpoint="/fleet/modifications"
      columns={columns}
      fields={fields}
      searchKeys={['description', 'provider_name']}
      createTitle="Nouvelle modification"
      editTitle="Modifier modification"
      transformPayload={(d) => ({
        ...d,
        vehicle_id: d.vehicle_id ? Number(d.vehicle_id) : null,
        cost: d.cost ? Number(d.cost) : null,
      })}
    />
  )
}

/* ─── Couts divers / Misc costs ─── */

function CostsCrud({ vehicleOptions }: { vehicleOptions: { value: string; label: string }[] }) {
  const columns: Column<VehicleCostEntry>[] = [
    { key: 'id', label: '#', width: '50px' },
    {
      key: 'vehicle_id', label: 'Vehicule', width: '120px', filterable: true,
      render: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || `#${row.vehicle_id}`,
      filterValue: (row) => vehicleOptions.find((v) => v.value === String(row.vehicle_id))?.label || '',
    },
    {
      key: 'category', label: 'Categorie', width: '100px', filterable: true,
      render: (row) => COST_CATEGORY_LABELS[row.category] || row.category,
      filterValue: (row) => COST_CATEGORY_LABELS[row.category] || row.category,
    },
    { key: 'date', label: 'Date', width: '100px' },
    { key: 'description', label: 'Description', filterable: true },
    {
      key: 'amount', label: 'Montant', width: '90px',
      render: (row) => `${row.amount.toLocaleString()} €`,
    },
    { key: 'invoice_ref', label: 'Facture', width: '100px' },
  ]

  const fields: FieldDef[] = [
    { key: 'vehicle_id', label: 'Vehicule', type: 'select', required: true, options: vehicleOptions },
    { key: 'category', label: 'Categorie', type: 'select', required: true, options: COST_CATEGORY_OPTIONS },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'amount', label: 'Montant (EUR)', type: 'number', step: 0.01, required: true },
    { key: 'invoice_ref', label: 'Ref facture', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <CrudPage<VehicleCostEntry>
      title=""
      endpoint="/fleet/costs"
      columns={columns}
      fields={fields}
      searchKeys={['description']}
      createTitle="Nouveau cout"
      editTitle="Modifier cout"
      transformPayload={(d) => ({
        ...d,
        vehicle_id: d.vehicle_id ? Number(d.vehicle_id) : null,
        amount: d.amount ? Number(d.amount) : null,
      })}
    />
  )
}

/* ─── Regles de planification / Schedule Rules ─── */

function ScheduleRulesCrud() {
  const columns: Column<MaintenanceScheduleRule>[] = [
    { key: 'id', label: '#', width: '50px' },
    { key: 'label', label: 'Libelle', filterable: true },
    {
      key: 'maintenance_type', label: 'Type', width: '130px', filterable: true,
      render: (row) => MAINTENANCE_TYPE_LABELS[row.maintenance_type] || row.maintenance_type,
      filterValue: (row) => MAINTENANCE_TYPE_LABELS[row.maintenance_type] || row.maintenance_type,
    },
    {
      key: 'applicable_vehicle_types', label: 'Types vehicule', width: '160px',
      render: (row) => row.applicable_vehicle_types
        ? row.applicable_vehicle_types.split(',').map((t) => VEHICLE_TYPE_LABELS[t] || t).join(', ')
        : 'Tous',
    },
    {
      key: 'interval_km', label: 'Intervalle km', width: '110px',
      render: (row) => row.interval_km ? `${row.interval_km.toLocaleString()} km` : '—',
    },
    {
      key: 'interval_months', label: 'Intervalle mois', width: '110px',
      render: (row) => row.interval_months ? `${row.interval_months} mois` : '—',
    },
    {
      key: 'is_active', label: 'Actif', width: '60px',
      render: (row) => row.is_active
        ? <span className="text-green-500">Oui</span>
        : <span className="text-gray-400">Non</span>,
    },
  ]

  const fields: FieldDef[] = [
    { key: 'label', label: 'Libelle', type: 'text', required: true },
    { key: 'maintenance_type', label: 'Type entretien', type: 'select', required: true, options: MAINTENANCE_TYPE_OPTIONS },
    { key: 'applicable_vehicle_types', label: 'Types vehicule (CSV, vide=tous)', type: 'text', placeholder: 'TRACTEUR,PORTEUR,SEMI_REMORQUE' },
    { key: 'interval_km', label: 'Intervalle km', type: 'number' },
    { key: 'interval_months', label: 'Intervalle mois', type: 'number' },
    { key: 'is_active', label: 'Actif', type: 'checkbox', defaultValue: true },
  ]

  return (
    <CrudPage<MaintenanceScheduleRule>
      title=""
      endpoint="/fleet/schedule-rules"
      columns={columns}
      fields={fields}
      searchKeys={['label']}
      createTitle="Nouvelle regle"
      editTitle="Modifier regle"
      transformPayload={(d) => ({
        ...d,
        interval_km: d.interval_km ? Number(d.interval_km) : null,
        interval_months: d.interval_months ? Number(d.interval_months) : null,
      })}
    />
  )
}

/* ─── Tableau de bord TCO / TCO Dashboard ─── */

const TCO_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']

function TCODashboard() {
  const [dashboard, setDashboard] = useState<FleetDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<FleetDashboard>('/fleet/dashboard')
      .then((res) => setDashboard(res.data))
      .catch(() => setDashboard(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
  }

  if (!dashboard || dashboard.vehicles.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
        Aucun vehicule enregistre. Ajoutez des vehicules pour voir le TCO.
      </div>
    )
  }

  /* Donnees camembert repartition couts flotte / Pie chart data for fleet cost breakdown */
  const totalLease = dashboard.vehicles.reduce((s, v) => s + v.lease_cost, 0)
  const totalDepreciation = dashboard.vehicles.reduce((s, v) => s + v.depreciation_cost, 0)
  const totalMaintenance = dashboard.vehicles.reduce((s, v) => s + v.maintenance_cost, 0)
  const totalFuel = dashboard.vehicles.reduce((s, v) => s + v.fuel_cost, 0)
  const totalModification = dashboard.vehicles.reduce((s, v) => s + v.modification_cost, 0)
  const totalOther = dashboard.vehicles.reduce((s, v) => s + v.other_costs, 0)

  const pieData = [
    { name: 'Leasing', value: totalLease },
    { name: 'Amortissement', value: totalDepreciation },
    { name: 'Entretien', value: totalMaintenance },
    { name: 'Carburant', value: totalFuel },
    { name: 'Modifications', value: totalModification },
    { name: 'Autres', value: totalOther },
  ].filter((d) => d.value > 0)

  /* Donnees barres TCO par vehicule / Bar chart data for TCO per vehicle */
  const barData = dashboard.vehicles
    .filter((v) => v.total_cost > 0)
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 20)
    .map((v) => ({
      name: v.vehicle_code,
      Entretien: v.maintenance_cost,
      Carburant: v.fuel_cost,
      Leasing: v.lease_cost,
      Amortissement: v.depreciation_cost,
      Modifications: v.modification_cost,
      Autres: v.other_costs,
    }))

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Cout total flotte" value={`${dashboard.total_fleet_cost.toLocaleString()} €`} />
        <KPICard label="Km total flotte" value={`${dashboard.total_fleet_km.toLocaleString()} km`} />
        <KPICard label="Cout moyen par km" value={dashboard.avg_cost_per_km != null ? `${dashboard.avg_cost_per_km.toFixed(2)} €/km` : '—'} />
        <KPICard label="Vehicules actifs" value={String(dashboard.vehicles.length)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camembert repartition / Pie chart */}
        {pieData.length > 0 && (
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Repartition des couts
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={TCO_COLORS[index % TCO_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} €`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tableau TCO par vehicule / TCO table per vehicle */}
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            TCO par vehicule (Top 20)
          </h3>
          <div className="overflow-y-auto max-h-[340px]">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left px-2 py-1">Vehicule</th>
                  <th className="text-right px-2 py-1">Total</th>
                  <th className="text-right px-2 py-1">Km</th>
                  <th className="text-right px-2 py-1">EUR/km</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.vehicles
                  .sort((a, b) => b.total_cost - a.total_cost)
                  .slice(0, 20)
                  .map((v) => (
                    <tr key={v.vehicle_id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="px-2 py-1" style={{ color: 'var(--text-primary)' }}>
                        {v.vehicle_code}
                        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                          {VEHICLE_TYPE_LABELS[v.fleet_vehicle_type] || v.fleet_vehicle_type}
                        </span>
                      </td>
                      <td className="text-right px-2 py-1 font-medium" style={{ color: 'var(--color-primary)' }}>
                        {v.total_cost.toLocaleString()} €
                      </td>
                      <td className="text-right px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                        {v.total_km.toLocaleString()}
                      </td>
                      <td className="text-right px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
                        {v.cost_per_km != null ? `${v.cost_per_km.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Barres comparaison TCO / Stacked bar chart TCO comparison */}
      {barData.length > 0 && (
        <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Comparaison TCO par vehicule
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 35)}>
            <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k €`} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => `${value.toLocaleString()} €`} />
              <Legend />
              <Bar dataKey="Entretien" stackId="a" fill="#22c55e" />
              <Bar dataKey="Carburant" stackId="a" fill="#3b82f6" />
              <Bar dataKey="Leasing" stackId="a" fill="#f97316" />
              <Bar dataKey="Amortissement" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Modifications" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="Autres" stackId="a" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-4 text-center"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{value}</p>
    </div>
  )
}
