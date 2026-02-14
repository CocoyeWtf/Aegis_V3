/* Page Véhicules / Vehicle management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { Vehicle, Region } from '../types'

export default function VehicleManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const tempOptions = [
    { value: 'GEL', label: t('vehicles.gel') },
    { value: 'FRAIS', label: t('vehicles.frais') },
    { value: 'SEC', label: t('vehicles.sec') },
    { value: 'BI_TEMP', label: t('vehicles.biTemp') },
    { value: 'TRI_TEMP', label: t('vehicles.triTemp') },
  ]

  const vehicleTypeOptions = [
    { value: 'SEMI', label: t('vehicles.semi') },
    { value: 'PORTEUR', label: t('vehicles.porteur') },
    { value: 'PORTEUR_REMORQUE', label: t('vehicles.porteurRemorque') },
    { value: 'CITY', label: t('vehicles.city') },
    { value: 'VL', label: t('vehicles.vl') },
  ]

  const tailgateOptions = [
    { value: 'RETRACTABLE', label: t('vehicles.retractable') },
    { value: 'RABATTABLE', label: t('vehicles.rabattable') },
  ]

  const columns: Column<Vehicle>[] = [
    { key: 'code', label: t('common.code'), width: '100px' },
    { key: 'name', label: t('common.name') },
    { key: 'vehicle_type', label: t('vehicles.vehicleType'), width: '140px' },
    { key: 'temperature_type', label: t('vehicles.temperatureType'), width: '100px' },
    { key: 'capacity_eqp', label: t('vehicles.capacityEqp'), width: '90px' },
    { key: 'has_tailgate', label: t('vehicles.hasTailgate'), width: '70px' },
    {
      key: 'region_id', label: t('common.region'), width: '120px',
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'vehicle_type', label: t('vehicles.vehicleType'), type: 'select', required: true, options: vehicleTypeOptions },
    { key: 'temperature_type', label: t('vehicles.temperatureType'), type: 'select', required: true, options: tempOptions },
    { key: 'capacity_eqp', label: t('vehicles.capacityEqp'), type: 'number', required: true, min: 1 },
    { key: 'capacity_weight_kg', label: t('vehicles.capacityWeight'), type: 'number', min: 0 },
    { key: 'fixed_cost', label: t('vehicles.fixedCost'), type: 'number', step: 0.01 },
    { key: 'cost_per_km', label: t('vehicles.costPerKm'), type: 'number', step: 0.0001 },
    { key: 'has_tailgate', label: t('vehicles.hasTailgate'), type: 'checkbox' },
    { key: 'tailgate_type', label: t('vehicles.tailgateType'), type: 'select', options: tailgateOptions },
    { key: 'contract_start_date', label: t('vehicles.contractStart'), type: 'text', placeholder: 'YYYY-MM-DD' },
    { key: 'contract_end_date', label: t('vehicles.contractEnd'), type: 'text', placeholder: 'YYYY-MM-DD' },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
  ]

  return (
    <CrudPage<Vehicle>
      title={t('vehicles.title')}
      endpoint="/vehicles"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name']}
      createTitle={t('vehicles.new')}
      editTitle={t('vehicles.edit')}
      importEntity="vehicles"
      transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
    />
  )
}
