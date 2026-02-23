/* Page Paramètres système / System parameters management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { Parameter, Region } from '../types'
import { formatDate } from '../utils/tourTimeUtils'

export default function ParameterSettings() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const valueTypeOptions = [
    { value: 'int', label: 'Integer' },
    { value: 'float', label: 'Float' },
    { value: 'string', label: 'String' },
    { value: 'bool', label: 'Boolean' },
  ]

  const columns: Column<Parameter>[] = [
    { key: 'key', label: t('parameters.key') },
    { key: 'value', label: t('parameters.value'), width: '150px' },
    { key: 'value_type', label: t('parameters.valueType'), width: '80px' },
    {
      key: 'region_id', label: t('common.region'), width: '120px',
      render: (row) => row.region_id ? regions.find((r) => r.id === row.region_id)?.name || '—' : t('parameters.global'),
    },
    { key: 'effective_date', label: t('parameters.effectiveDate'), width: '110px', render: (row) => formatDate(row.effective_date) },
    { key: 'end_date', label: t('parameters.endDate'), width: '110px', render: (row) => formatDate(row.end_date) },
  ]

  const fields: FieldDef[] = [
    { key: 'key', label: t('parameters.key'), type: 'text', required: true, placeholder: 'commercial_speed_kmh' },
    { key: 'value', label: t('parameters.value'), type: 'text', required: true },
    { key: 'value_type', label: t('parameters.valueType'), type: 'select', required: true, options: valueTypeOptions },
    {
      key: 'region_id', label: t('common.region'), type: 'select',
      options: [
        { value: '', label: t('parameters.global') },
        ...regions.map((r) => ({ value: String(r.id), label: r.name })),
      ],
    },
    { key: 'effective_date', label: t('parameters.effectiveDate'), type: 'date' },
    { key: 'end_date', label: t('parameters.endDate'), type: 'date' },
  ]

  return (
    <CrudPage<Parameter>
      title={t('parameters.title')}
      endpoint="/parameters"
      columns={columns}
      fields={fields}
      searchKeys={['key', 'value']}
      createTitle={t('parameters.new')}
      editTitle={t('parameters.edit')}
      transformPayload={(d) => ({
        ...d,
        region_id: d.region_id ? Number(d.region_id) : null,
      })}
    />
  )
}
