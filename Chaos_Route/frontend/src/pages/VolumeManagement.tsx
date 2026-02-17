/* Page Volumes / Volume management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { Volume, PDV, BaseLogistics } from '../types'

export default function VolumeManagement() {
  const { t } = useTranslation()
  const { data: pdvs } = useApi<PDV>('/pdvs')
  const { data: bases } = useApi<BaseLogistics>('/bases')

  const tempClassOptions = [
    { value: 'SEC', label: t('vehicles.sec') },
    { value: 'FRAIS', label: t('vehicles.frais') },
    { value: 'GEL', label: t('vehicles.gel') },
  ]

  const columns: Column<Volume>[] = [
    { key: 'date', label: t('common.date'), width: '110px' },
    {
      key: 'pdv_id', label: t('volumes.pdv'),
      render: (row) => pdvs.find((p) => p.id === row.pdv_id)?.name || String(row.pdv_id),
    },
    { key: 'eqp_count', label: t('volumes.eqpCount'), width: '90px' },
    { key: 'weight_kg', label: t('volumes.weightKg'), width: '100px' },
    { key: 'temperature_class', label: t('volumes.temperatureClass'), width: '100px' },
    {
      key: 'base_origin_id', label: t('volumes.baseOrigin'), width: '140px',
      render: (row) => bases.find((b) => b.id === row.base_origin_id)?.name || '—',
    },
    {
      key: 'tour_id' as keyof Volume, label: 'Tour', width: '100px',
      render: (row) => row.tour_id ? (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'var(--color-primary)' }}>
          ✓ {t('tourPlanning.assigned')}
        </span>
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
      ),
    },
  ]

  const fields: FieldDef[] = [
    { key: 'date', label: t('common.date'), type: 'text', required: true, placeholder: 'YYYY-MM-DD' },
    {
      key: 'pdv_id', label: t('volumes.pdv'), type: 'select', required: true,
      options: pdvs.map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` })),
    },
    { key: 'eqp_count', label: t('volumes.eqpCount'), type: 'number', required: true, min: 1 },
    { key: 'weight_kg', label: t('volumes.weightKg'), type: 'number', step: 0.01 },
    { key: 'temperature_class', label: t('volumes.temperatureClass'), type: 'select', required: true, options: tempClassOptions },
    {
      key: 'base_origin_id', label: t('volumes.baseOrigin'), type: 'select', required: true,
      options: bases.map((b) => ({ value: String(b.id), label: `${b.code} — ${b.name}` })),
    },
    { key: 'preparation_start', label: t('volumes.prepStart'), type: 'time' },
    { key: 'preparation_end', label: t('volumes.prepEnd'), type: 'time' },
  ]

  return (
    <CrudPage<Volume>
      title={t('volumes.title')}
      endpoint="/volumes"
      columns={columns}
      fields={fields}
      searchKeys={[]}
      createTitle={t('volumes.new')}
      editTitle={t('volumes.edit')}
      importEntity="volumes"
      transformPayload={(d) => ({
        ...d,
        pdv_id: Number(d.pdv_id),
        base_origin_id: Number(d.base_origin_id),
      })}
    />
  )
}
