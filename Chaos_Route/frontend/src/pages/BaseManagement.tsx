/* Page Bases logistiques / Logistics bases management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { BaseLogistics, Region } from '../types'

export default function BaseManagement() {
  const { t } = useTranslation()
  const { data: regions } = useApi<Region>('/regions')

  const baseTypeOptions = [
    { value: 'SEC_RAPIDE', label: t('bases.secRapide') },
    { value: 'FRAIS_RAPIDE', label: t('bases.fraisRapide') },
    { value: 'GEL_RAPIDE', label: t('bases.gelRapide') },
    { value: 'MIXTE_RAPIDE', label: t('bases.mixteRapide') },
    { value: 'SEC_LENTE', label: t('bases.secLente') },
    { value: 'GEL_LENTE', label: t('bases.gelLente') },
  ]

  const columns: Column<BaseLogistics>[] = [
    { key: 'code', label: t('common.code'), width: '100px' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type'), width: '140px' },
    { key: 'city', label: t('common.city'), width: '120px' },
    {
      key: 'region_id', label: t('common.region'), width: '120px',
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    { key: 'type', label: t('common.type'), type: 'select', required: true, options: baseTypeOptions },
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
    <CrudPage<BaseLogistics>
      title={t('bases.title')}
      endpoint="/bases"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name', 'city']}
      createTitle={t('bases.new')}
      editTitle={t('bases.edit')}
      importEntity="bases"
      transformPayload={(d) => ({ ...d, region_id: Number(d.region_id) })}
    />
  )
}
