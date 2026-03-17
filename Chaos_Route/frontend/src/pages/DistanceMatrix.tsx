/* Page Distancier enrichi / Enriched distance matrix management page */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CrudPage } from '../components/data/CrudPage'
import { ImportDialog } from '../components/data/ImportDialog'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { DistanceEntry } from '../types'
import api from '../services/api'

export default function DistanceMatrix() {
  const { t } = useTranslation()
  const [timeImportOpen, setTimeImportOpen] = useState(false)
  const [serverSearch, setServerSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  /* Charger le total / Load total count */
  useEffect(() => {
    api.get('/distance-matrix/count/').then((res) => {
      setTotalCount(res.data.count)
    }).catch(() => {})
  }, [])

  /* Debounce la recherche serveur / Debounce server search */
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setServerSearch(value)
    }, 400)
  }, [])

  const apiParams: Record<string, unknown> = { limit: 500 }
  if (serverSearch) apiParams.search = serverSearch

  const pointTypeOptions = [
    { value: 'BASE', label: 'Base' },
    { value: 'PDV', label: 'PDV' },
    { value: 'SUPPLIER', label: t('suppliers.title') },
  ]

  const columns: Column<DistanceEntry>[] = [
    {
      key: 'origin_type', label: t('distances.originType'), width: '90px',
      filterable: true,
    },
    {
      key: 'origin_id', label: t('distances.originId'), width: '180px',
      render: (row) => row.origin_label ?? `#${row.origin_id}`,
      filterable: true, filterKey: 'origin_label',
    },
    {
      key: 'destination_type', label: t('distances.destinationType'), width: '90px',
      filterable: true,
    },
    {
      key: 'destination_id', label: t('distances.destinationId'), width: '180px',
      render: (row) => row.destination_label ?? `#${row.destination_id}`,
      filterable: true, filterKey: 'destination_label',
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
        {/* Recherche serveur / Server-side search */}
        <input
          type="text"
          placeholder="Rechercher base/PDV..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border outline-none focus:ring-1"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            width: '260px',
          }}
        />
        {totalCount != null && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {serverSearch ? 'Resultats filtrés' : `${totalCount.toLocaleString('fr-FR')} entrées au total`}
            {' — affichage limité à 500'}
          </span>
        )}
      </div>
      <CrudPage<DistanceEntry>
        resource="distances"
        title={t('distances.title')}
        endpoint="/distance-matrix"
        columns={columns}
        fields={fields}
        searchKeys={[]}
        createTitle={t('distances.new')}
        editTitle={t('distances.edit')}
        importEntity="distances"
        exportEntity="distances"
        apiParams={apiParams}
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
