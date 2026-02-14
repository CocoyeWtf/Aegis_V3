/* Page Distancier / Distance matrix management page */

import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { DistanceEntry } from '../types'

export default function DistanceMatrix() {
  const { t } = useTranslation()

  const pointTypeOptions = [
    { value: 'BASE', label: 'Base' },
    { value: 'PDV', label: 'PDV' },
    { value: 'SUPPLIER', label: t('suppliers.title') },
  ]

  const columns: Column<DistanceEntry>[] = [
    { key: 'origin_type', label: t('distances.originType'), width: '100px' },
    { key: 'origin_id', label: t('distances.originId'), width: '80px' },
    { key: 'destination_type', label: t('distances.destinationType'), width: '100px' },
    { key: 'destination_id', label: t('distances.destinationId'), width: '80px' },
    {
      key: 'distance_km', label: t('distances.distanceKm'), width: '100px',
      render: (row) => `${row.distance_km} km`,
    },
    {
      key: 'duration_minutes', label: t('distances.durationMin'), width: '100px',
      render: (row) => `${row.duration_minutes} min`,
    },
  ]

  const fields: FieldDef[] = [
    { key: 'origin_type', label: t('distances.originType'), type: 'select', required: true, options: pointTypeOptions },
    { key: 'origin_id', label: t('distances.originId'), type: 'number', required: true, min: 1 },
    { key: 'destination_type', label: t('distances.destinationType'), type: 'select', required: true, options: pointTypeOptions },
    { key: 'destination_id', label: t('distances.destinationId'), type: 'number', required: true, min: 1 },
    { key: 'distance_km', label: t('distances.distanceKm'), type: 'number', required: true, step: 0.01, min: 0 },
    { key: 'duration_minutes', label: t('distances.durationMin'), type: 'number', required: true, min: 0 },
  ]

  return (
    <CrudPage<DistanceEntry>
      title={t('distances.title')}
      endpoint="/distance-matrix"
      columns={columns}
      fields={fields}
      searchKeys={[]}
      createTitle={t('distances.new')}
      editTitle={t('distances.edit')}
      importEntity="distances"
    />
  )
}
