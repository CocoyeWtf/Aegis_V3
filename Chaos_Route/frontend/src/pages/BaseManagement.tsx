/* Page Bases logistiques / Logistics bases management page */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../components/data/DataTable'
import { FormDialog, type FieldDef } from '../components/data/FormDialog'
import { ConfirmDialog } from '../components/data/ConfirmDialog'
import { ImportDialog } from '../components/data/ImportDialog'
import { useApi } from '../hooks/useApi'
import { create, update, remove, downloadExport } from '../services/api'
import type { BaseLogistics, BaseActivity, Region, Country } from '../types'

export default function BaseManagement() {
  const { t } = useTranslation()
  const { data: countries } = useApi<Country>('/countries')
  const { data: regions } = useApi<Region>('/regions')
  const { data: activities } = useApi<BaseActivity>('/base-activities')
  const { data: bases, loading, refetch } = useApi<BaseLogistics>('/bases')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, unknown> | undefined>()
  const [deleteItem, setDeleteItem] = useState<BaseLogistics | null>(null)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const columns: Column<BaseLogistics>[] = [
    { key: 'code', label: t('common.code'), width: '100px' },
    { key: 'name', label: t('common.name') },
    {
      key: 'activities', label: t('bases.activities'), width: '200px',
      render: (row) => row.activities?.length
        ? row.activities.map((a) => a.name).join(', ')
        : '—',
    },
    { key: 'address', label: t('common.address'), defaultHidden: true },
    { key: 'postal_code', label: t('common.postalCode'), width: '100px', defaultHidden: true },
    { key: 'city', label: t('common.city'), width: '120px' },
    { key: 'phone', label: t('common.phone'), width: '130px', defaultHidden: true },
    { key: 'email', label: t('common.email'), width: '180px', defaultHidden: true },
    { key: 'latitude', label: t('common.latitude'), width: '110px', defaultHidden: true },
    { key: 'longitude', label: t('common.longitude'), width: '110px', defaultHidden: true },
    {
      key: 'region_id', label: t('common.region'), width: '120px',
      render: (row) => regions.find((r) => r.id === row.region_id)?.name || '—',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: t('common.code'), type: 'text', required: true },
    { key: 'name', label: t('common.name'), type: 'text', required: true },
    {
      key: 'country_id', label: t('common.country'), type: 'select',
      options: countries.map((c) => ({ value: String(c.id), label: `${c.code} — ${c.name}` })),
    },
    {
      key: 'region_id', label: t('common.region'), type: 'select', required: true,
      getOptions: (form) => {
        const countryId = form.country_id ? Number(form.country_id) : null
        const filtered = countryId ? regions.filter((r) => r.country_id === countryId) : regions
        return filtered.map((r) => ({ value: String(r.id), label: r.name }))
      },
    },
    {
      key: 'activity_ids', label: t('bases.activities'), type: 'multicheck',
      options: activities.map((a) => ({ value: String(a.id), label: a.name })),
    },
    { key: 'address', label: t('common.address'), type: 'text' },
    { key: 'postal_code', label: t('common.postalCode'), type: 'text' },
    { key: 'city', label: t('common.city'), type: 'text' },
    { key: 'phone', label: t('common.phone'), type: 'text' },
    { key: 'email', label: t('common.email'), type: 'text' },
    { key: 'latitude', label: t('common.latitude'), type: 'number', step: 0.000001 },
    { key: 'longitude', label: t('common.longitude'), type: 'number', step: 0.000001 },
  ]

  const handleCreate = () => {
    setEditItem(undefined)
    setDialogOpen(true)
  }

  const handleEdit = (row: BaseLogistics) => {
    const regionCountryId = regions.find((r) => r.id === row.region_id)?.country_id
    setEditItem({
      ...row,
      country_id: regionCountryId ? String(regionCountryId) : '',
      activity_ids: row.activities?.map((a) => String(a.id)) ?? [],
    } as unknown as Record<string, unknown>)
    setDialogOpen(true)
  }

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const { country_id: _unused, ...rest } = data
      const payload = {
        ...rest,
        region_id: Number(data.region_id),
        activity_ids: ((data.activity_ids as string[]) || []).map(Number),
      }
      if (editItem?.id) {
        await update<BaseLogistics>('/bases', editItem.id as number, payload as Partial<BaseLogistics>)
      } else {
        await create<BaseLogistics>('/bases', payload as Partial<BaseLogistics>)
      }
      setDialogOpen(false)
      setEditItem(undefined)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [editItem, refetch])

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return
    setSaving(true)
    try {
      await remove('/bases', deleteItem.id)
      setDeleteItem(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [deleteItem, refetch])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('bases.title')}
      </h2>

      <DataTable<BaseLogistics>
        columns={columns}
        data={bases}
        loading={loading}
        searchable
        searchKeys={['code', 'name', 'city']}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteItem(row)}
        onImport={() => setImportOpen(true)}
        onExport={(format) => downloadExport('bases', format)}
      />

      <FormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(undefined) }}
        onSubmit={handleSave}
        title={editItem?.id ? t('bases.edit') : t('bases.new')}
        fields={fields}
        initialData={editItem}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title={t('common.deleteTitle')}
        message={t('common.deleteConfirm')}
        loading={saving}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entityType="bases"
        onSuccess={refetch}
      />
    </div>
  )
}
