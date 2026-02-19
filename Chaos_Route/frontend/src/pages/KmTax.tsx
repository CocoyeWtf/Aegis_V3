/* Page Taxe au kilomètre / Km tax management page (pattern distancier) */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { KmTaxEntry } from '../types'

export default function KmTax() {
  const { t } = useTranslation()

  const pointTypeOptions = [
    { value: 'BASE', label: 'Base' },
    { value: 'PDV', label: 'PDV' },
  ]

  const columns: Column<KmTaxEntry>[] = [
    { key: 'origin_type', label: t('kmTax.originType'), width: '90px', filterable: true },
    {
      key: 'origin_id', label: t('kmTax.originId'), width: '180px',
      render: (row) => row.origin_label ?? `#${row.origin_id}`,
      filterable: true, filterKey: 'origin_label',
    },
    { key: 'destination_type', label: t('kmTax.destType'), width: '90px', filterable: true },
    {
      key: 'destination_id', label: t('kmTax.destId'), width: '180px',
      render: (row) => row.destination_label ?? `#${row.destination_id}`,
      filterable: true, filterKey: 'destination_label',
    },
    {
      key: 'tax_per_km', label: t('kmTax.taxPerKm'), width: '120px',
      render: (row) => `${row.tax_per_km} €/km`,
    },
  ]

  const fields: FieldDef[] = [
    { key: 'origin_type', label: t('kmTax.originType'), type: 'select', required: true, options: pointTypeOptions },
    { key: 'origin_id', label: t('kmTax.originId'), type: 'number', required: true, min: 1 },
    { key: 'destination_type', label: t('kmTax.destType'), type: 'select', required: true, options: pointTypeOptions },
    { key: 'destination_id', label: t('kmTax.destId'), type: 'number', required: true, min: 1 },
    { key: 'tax_per_km', label: t('kmTax.taxPerKm'), type: 'number', required: true, step: 0.0001, min: 0 },
  ]

  return (
    <CrudPage<KmTaxEntry>
      title={t('kmTax.title')}
      endpoint="/km-tax"
      columns={columns}
      fields={fields}
      searchKeys={[]}
      createTitle={t('kmTax.new')}
      editTitle={t('kmTax.edit')}
      importEntity="km-tax"
      exportEntity="km-tax"
    />
  )
}
