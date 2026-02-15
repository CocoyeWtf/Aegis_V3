/* Page Pays & Régions / Countries & Regions management page */

import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../components/data/DataTable'
import { FormDialog, type FieldDef } from '../components/data/FormDialog'
import { ConfirmDialog } from '../components/data/ConfirmDialog'
import { useApi } from '../hooks/useApi'
import { create, update, remove } from '../services/api'
import type { Country, Region } from '../types'

export default function CountryRegion() {
  const { t } = useTranslation()
  const { data: countries, loading: loadingC, refetch: refetchC } = useApi<Country>('/countries')
  const { data: regions, loading: loadingR, refetch: refetchR } = useApi<Region>('/regions')

  const [dialogType, setDialogType] = useState<'country' | 'region' | null>(null)
  const [editItem, setEditItem] = useState<Record<string, unknown> | undefined>()
  const [deleteItem, setDeleteItem] = useState<{ type: 'country' | 'region'; id: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null)

  /* Régions filtrées par pays sélectionné / Regions filtered by selected country */
  const filteredRegions = useMemo(() => {
    if (!selectedCountryId) return regions
    return regions.filter((r) => r.country_id === selectedCountryId)
  }, [regions, selectedCountryId])

  /* Colonnes pays / Country columns */
  const countryColumns: Column<Country>[] = [
    { key: 'id', label: t('common.id'), width: '60px' },
    { key: 'code', label: t('common.code'), width: '80px' },
    { key: 'name', label: t('common.name') },
  ]

  /* Colonnes régions / Region columns */
  const regionColumns: Column<Region>[] = [
    { key: 'id', label: t('common.id'), width: '60px' },
    { key: 'name', label: t('common.name') },
    {
      key: 'country_id', label: t('common.country'),
      render: (row) => countries.find((c) => c.id === row.country_id)?.name || '—',
    },
  ]

  /* Champs formulaire pays / Country form fields */
  const countryFields: FieldDef[] = [
    { key: 'name', label: t('countryRegion.countryName'), type: 'text', required: true },
    { key: 'code', label: t('countryRegion.countryCode'), type: 'text', required: true, placeholder: 'FR' },
  ]

  /* Champs formulaire région / Region form fields */
  const regionFields: FieldDef[] = [
    { key: 'name', label: t('countryRegion.regionName'), type: 'text', required: true },
    {
      key: 'country_id', label: t('countryRegion.parentCountry'), type: 'select', required: true,
      options: countries.map((c) => ({ value: String(c.id), label: `${c.code} — ${c.name}` })),
    },
  ]

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (dialogType === 'country') {
        if (editItem?.id) {
          await update<Country>('/countries', editItem.id as number, data as Partial<Country>)
        } else {
          await create<Country>('/countries', data as Partial<Country>)
        }
        refetchC()
      } else {
        const payload = { ...data, country_id: Number(data.country_id) }
        if (editItem?.id) {
          await update<Region>('/regions', editItem.id as number, payload as Partial<Region>)
        } else {
          await create<Region>('/regions', payload as Partial<Region>)
        }
        refetchR()
      }
      setDialogType(null)
      setEditItem(undefined)
    } finally {
      setSaving(false)
    }
  }, [dialogType, editItem, refetchC, refetchR])

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return
    setSaving(true)
    try {
      if (deleteItem.type === 'country') {
        await remove('/countries', deleteItem.id)
        refetchC()
        if (selectedCountryId === deleteItem.id) setSelectedCountryId(null)
      } else {
        await remove('/regions', deleteItem.id)
        refetchR()
      }
      setDeleteItem(null)
    } finally {
      setSaving(false)
    }
  }, [deleteItem, refetchC, refetchR, selectedCountryId])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('countryRegion.title')}
      </h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pays / Countries */}
        <DataTable<Country>
          title={t('countryRegion.countries')}
          columns={countryColumns}
          data={countries}
          loading={loadingC}
          searchable
          searchKeys={['name', 'code']}
          onCreate={() => { setDialogType('country'); setEditItem(undefined) }}
          onEdit={(row) => { setDialogType('country'); setEditItem(row as unknown as Record<string, unknown>) }}
          onDelete={(row) => setDeleteItem({ type: 'country', id: row.id })}
          onRowClick={(row) => setSelectedCountryId(selectedCountryId === row.id ? null : row.id)}
          activeRowId={selectedCountryId}
        />

        {/* Régions / Regions (filtrées par pays) */}
        <div>
          {selectedCountryId && (
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: 'var(--color-primary)' }}>
                {t('countryRegion.filteredBy')}: {countries.find((c) => c.id === selectedCountryId)?.name}
              </span>
              <button
                onClick={() => setSelectedCountryId(null)}
                className="text-xs px-2 py-1 rounded-full transition-colors hover:opacity-80"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
              >
                {t('countryRegion.showAll')}
              </button>
            </div>
          )}
          <DataTable<Region>
            title={t('countryRegion.regions')}
            columns={regionColumns}
            data={filteredRegions}
            loading={loadingR}
            searchable
            searchKeys={['name']}
            onCreate={() => { setDialogType('region'); setEditItem(undefined) }}
            onEdit={(row) => { setDialogType('region'); setEditItem(row as unknown as Record<string, unknown>) }}
            onDelete={(row) => setDeleteItem({ type: 'region', id: row.id })}
          />
        </div>
      </div>

      {/* Formulaire pays / Country form */}
      <FormDialog
        open={dialogType === 'country'}
        onClose={() => { setDialogType(null); setEditItem(undefined) }}
        onSubmit={handleSave}
        title={editItem?.id ? t('countryRegion.editCountry') : t('countryRegion.newCountry')}
        fields={countryFields}
        initialData={editItem}
        loading={saving}
      />

      {/* Formulaire région / Region form */}
      <FormDialog
        open={dialogType === 'region'}
        onClose={() => { setDialogType(null); setEditItem(undefined) }}
        onSubmit={handleSave}
        title={editItem?.id ? t('countryRegion.editRegion') : t('countryRegion.newRegion')}
        fields={regionFields}
        initialData={editItem}
        loading={saving}
      />

      {/* Confirmation suppression / Delete confirmation */}
      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title={t('common.deleteTitle')}
        message={t('common.deleteConfirm')}
        loading={saving}
      />
    </div>
  )
}
