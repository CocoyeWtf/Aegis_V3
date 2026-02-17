/* Page Points de vente / Point of Sale management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { PDV, Region } from '../types'

export default function PdvManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const pdvTypeOptions = [
    { value: 'EXPRESS', label: t('pdvs.express') },
    { value: 'CONTACT', label: t('pdvs.contact') },
    { value: 'SUPER_ALIMENTAIRE', label: t('pdvs.superAlimentaire') },
    { value: 'SUPER_GENERALISTE', label: t('pdvs.superGeneraliste') },
    { value: 'HYPER', label: t('pdvs.hyper') },
    { value: 'NETTO', label: t('pdvs.netto') },
    { value: 'DRIVE', label: t('pdvs.drive') },
    { value: 'URBAIN_PROXI', label: t('pdvs.urbainProxi') },
  ]

  const columns: Column<PDV>[] = [
    { key: 'code', label: t('common.code'), width: '100px' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type'), width: '160px' },
    { key: 'address', label: t('common.address'), defaultHidden: true },
    { key: 'postal_code', label: t('common.postalCode'), width: '100px', defaultHidden: true },
    { key: 'city', label: t('common.city'), width: '120px' },
    { key: 'phone', label: t('common.phone'), width: '130px', defaultHidden: true },
    { key: 'email', label: t('common.email'), defaultHidden: true },
    { key: 'latitude', label: t('common.latitude'), width: '100px', defaultHidden: true },
    { key: 'longitude', label: t('common.longitude'), width: '100px', defaultHidden: true },
    { key: 'has_sas', label: t('pdvs.hasSas'), width: '60px' },
    { key: 'sas_capacity', label: t('pdvs.sasCapacity'), width: '100px', defaultHidden: true },
    { key: 'has_dock', label: t('pdvs.hasDock'), width: '60px' },
    { key: 'dock_time_minutes', label: t('pdvs.dockTime'), width: '100px', defaultHidden: true },
    { key: 'unload_time_per_eqp_minutes', label: t('pdvs.unloadTime'), width: '120px', defaultHidden: true },
    { key: 'delivery_window_start', label: t('pdvs.deliveryStart'), width: '100px', defaultHidden: true },
    { key: 'delivery_window_end', label: t('pdvs.deliveryEnd'), width: '100px', defaultHidden: true },
    {
      key: 'region_id', label: t('common.region'), width: '120px',
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'type', label: t('common.type'), type: 'select', required: true, options: pdvTypeOptions },
    { key: 'address', label: t('common.address'), type: 'text' },
    { key: 'postal_code', label: t('common.postalCode'), type: 'text' },
    { key: 'city', label: t('common.city'), type: 'text' },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'email', label: t('common.email'), type: 'text' },
    { key: 'latitude', label: t('common.latitude'), type: 'number', step: 0.000001 },
    { key: 'longitude', label: t('common.longitude'), type: 'number', step: 0.000001 },
    { key: 'has_sas', label: t('pdvs.hasSas'), type: 'checkbox' },
    { key: 'sas_capacity', label: t('pdvs.sasCapacity'), type: 'number', min: 0 },
    { key: 'has_dock', label: t('pdvs.hasDock'), type: 'checkbox' },
    { key: 'dock_time_minutes', label: t('pdvs.dockTime'), type: 'number', min: 0 },
    { key: 'unload_time_per_eqp_minutes', label: t('pdvs.unloadTime'), type: 'number', min: 0 },
    { key: 'delivery_window_start', label: t('pdvs.deliveryStart'), type: 'time' },
    { key: 'delivery_window_end', label: t('pdvs.deliveryEnd'), type: 'time' },
    { key: 'access_constraints', label: t('pdvs.accessConstraints'), type: 'textarea' },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      options: regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
  ]

  return (
    <CrudPage<PDV>
      title={t('pdvs.title')}
      endpoint="/pdvs"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name', 'city']}
      createTitle={t('pdvs.new')}
      editTitle={t('pdvs.edit')}
      importEntity="pdvs"
      exportEntity="pdvs"
      transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
    />
  )
}
