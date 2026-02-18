/* Page Distancier enrichi / Enriched distance matrix management page */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import { ImportDialog } from '../components/data/ImportDialog'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { DistanceEntry } from '../types'

export default function DistanceMatrix() {
  const { t } = useTranslation()
  const [timeImportOpen, setTimeImportOpen] = useState(false)

  const pointTypeOptions = [
    { value: 'BASE', label: 'Base' },
    { value: 'PDV', label: 'PDV' },
    { value: 'SUPPLIER', label: t('suppliers.title') },
  ]

  const columns: Column<DistanceEntry>[] = [
    {
      key: 'origin_type', label: t('distances.originType'), width: '90px',
    },
    {
      key: 'origin_id', label: t('distances.originId'), width: '180px',
      render: (row) => row.origin_label ?? `#${row.origin_id}`,
    },
    {
      key: 'destination_type', label: t('distances.destinationType'), width: '90px',
    },
    {
      key: 'destination_id', label: t('distances.destinationId'), width: '180px',
      render: (row) => row.destination_label ?? `#${row.destination_id}`,
    },
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
    <>
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setTimeImportOpen(true)}
          className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
        >
          {t('timeBreakdown.importTimeMatrix')}
        </button>
      </div>
      <CrudPage<DistanceEntry>
        title={t('distances.title')}
        endpoint="/distance-matrix"
        columns={columns}
        fields={fields}
        searchKeys={[]}
        createTitle={t('distances.new')}
        editTitle={t('distances.edit')}
        importEntity="distances"
        exportEntity="distances"
      />
      <ImportDialog
        open={timeImportOpen}
        onClose={() => setTimeImportOpen(false)}
        entityType="time-matrix"
        onSuccess={() => { setTimeImportOpen(false); window.location.reload() }}
      />
    </>
  )
}
