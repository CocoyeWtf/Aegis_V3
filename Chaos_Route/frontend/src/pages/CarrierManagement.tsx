/* Page Transporteurs / Carrier management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { Carrier, Region } from '../types'

export default function CarrierManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const columns: Column<Carrier>[] = [
    { key: 'code', label: t('common.code'), width: '100px', filterable: true },
    { key: 'name', label: t('common.name'), filterable: true },
    { key: 'city', label: t('common.city'), width: '120px', filterable: true },
    { key: 'phone', label: t('common.phone'), width: '130px' },
    { key: 'transport_license' as keyof Carrier, label: 'Licence transport', width: '130px' },
    { key: 'accounting_code' as keyof Carrier, label: 'Code comptable', width: '120px' },
    {
      key: 'region_id', label: t('common.region'), width: '120px', filterable: true,
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
      filterValue: (row) => regions.find((r) => r.id === row.region_id)?.name || '',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: 'Raison sociale', type: 'text', required: true },
    { key: 'address', label: t('common.address'), type: 'text', colSpan: 2 },
    { key: 'postal_code', label: t('common.postalCode'), type: 'text' },
    { key: 'city', label: t('common.city'), type: 'text' },
    { key: 'country', label: 'Pays', type: 'text' },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'email', label: t('common.email'), type: 'text' },
    { key: 'transport_license', label: 'Licence transport', type: 'text' },
    { key: 'vat_number', label: 'N° TVA', type: 'text' },
    { key: 'siren', label: 'SIREN/SIRET', type: 'text' },
    { key: 'accounting_code', label: 'Code comptable', type: 'text' },
    { key: 'contact_person', label: 'Personne de contact', type: 'text' },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <CrudPage<Carrier>
      title="Transporteurs"
      endpoint="/carriers"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name', 'city']}
      createTitle="Nouveau transporteur"
      editTitle="Modifier transporteur"
      importEntity="carriers"
      exportEntity="carriers"
      transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
      formSize="lg"
    />
  )
}
