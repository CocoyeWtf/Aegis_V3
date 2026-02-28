/* Page Fournisseurs / Supplier management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { Supplier, Region } from '../types'

export default function SupplierManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const columns: Column<Supplier>[] = [
    { key: 'code', label: t('common.code'), width: '100px', filterable: true },
    { key: 'name', label: t('common.name'), filterable: true },
    { key: 'city', label: t('common.city'), width: '120px', filterable: true },
    { key: 'phone', label: t('common.phone'), width: '130px' },
    {
      key: 'region_id', label: t('common.region'), width: '120px', filterable: true,
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
      filterValue: (row) => regions.find((r) => r.id === row.region_id)?.name || '',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'address', label: t('common.address'), type: 'text' },
    { key: 'postal_code', label: t('common.postalCode'), type: 'text' },
    { key: 'city', label: t('common.city'), type: 'text' },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'email', label: t('common.email'), type: 'text' },
    { key: 'latitude', label: t('common.latitude'), type: 'number', step: 0.000001 },
    { key: 'longitude', label: t('common.longitude'), type: 'number', step: 0.000001 },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
  ]

  return (
    <CrudPage<Supplier>
      title={t('suppliers.title')}
      endpoint="/suppliers"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name', 'city']}
      createTitle={t('suppliers.new')}
      editTitle={t('suppliers.edit')}
      importEntity="suppliers"
      exportEntity="suppliers"
      transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
      formSize="md"
    />
  )
}
