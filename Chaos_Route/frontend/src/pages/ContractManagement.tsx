/* Page Contrats transporteurs / Contract management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { Contract, Region } from '../types'

export default function ContractManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const columns: Column<Contract>[] = [
    { key: 'code', label: t('common.code'), width: '100px' },
    { key: 'transporter_name', label: t('contracts.transporterName') },
    {
      key: 'fixed_daily_cost', label: t('contracts.fixedDailyCost'), width: '130px',
      render: (row) => row.fixed_daily_cost != null ? `${row.fixed_daily_cost} €` : '—',
    },
    {
      key: 'cost_per_km', label: t('contracts.costPerKm'), width: '100px',
      render: (row) => row.cost_per_km != null ? `${row.cost_per_km} €` : '—',
    },
    { key: 'start_date', label: t('common.startDate'), width: '110px' },
    { key: 'end_date', label: t('common.endDate'), width: '110px' },
    {
      key: 'region_id', label: t('common.region'), width: '120px',
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'transporter_name', label: t('contracts.transporterName'), type: 'text', required: true },
    { key: 'fixed_daily_cost', label: t('contracts.fixedDailyCost'), type: 'number', step: 0.01 },
    { key: 'cost_per_km', label: t('contracts.costPerKm'), type: 'number', step: 0.0001 },
    { key: 'cost_per_hour', label: t('contracts.costPerHour'), type: 'number', step: 0.01 },
    { key: 'min_hours_per_day', label: t('contracts.minHoursPerDay'), type: 'number', step: 0.5 },
    { key: 'min_km_per_day', label: t('contracts.minKmPerDay'), type: 'number' },
    { key: 'start_date', label: t('common.startDate'), type: 'text', placeholder: 'YYYY-MM-DD' },
    { key: 'end_date', label: t('common.endDate'), type: 'text', placeholder: 'YYYY-MM-DD' },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
  ]

  return (
    <CrudPage<Contract>
      title={t('contracts.title')}
      endpoint="/contracts"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'transporter_name']}
      createTitle={t('contracts.new')}
      editTitle={t('contracts.edit')}
      importEntity="contracts"
      transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
    />
  )
}
