/* Page Pays & Régions / Countries & Regions management page */

import { useState, useCallback } from 'react'
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
      } else {
        await remove('/regions', deleteItem.id)
        refetchR()
      }
      setDeleteItem(null)
    } finally {
      setSaving(false)
    }
  }, [deleteItem, refetchC, refetchR])

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
        />

        {/* Régions / Regions */}
        <DataTable<Region>
          title={t('countryRegion.regions')}
          columns={regionColumns}
          data={regions}
          loading={loadingR}
          searchable
          searchKeys={['name']}
          onCreate={() => { setDialogType('region'); setEditItem(undefined) }}
          onEdit={(row) => { setDialogType('region'); setEditItem(row as unknown as Record<string, unknown>) }}
          onDelete={(row) => setDeleteItem({ type: 'region', id: row.id })}
        />
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
