/* Page CRUD générique / Generic CRUD page component */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from './DataTable'
import { FormDialog, type FieldDef } from './FormDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { ImportDialog } from './ImportDialog'
import { useApi } from '../../hooks/useApi'
import { create, update, remove, downloadExport } from '../../services/api'

interface CrudPageProps<T extends { id: number }> {
  title: string
  endpoint: string
  columns: Column<T>[]
  fields: FieldDef[]
  searchKeys?: (keyof T)[]
  createTitle: string
  editTitle: string
  importEntity?: string
  exportEntity?: string
  apiParams?: Record<string, unknown>
  /** Activer la duplication / Enable row duplication */
  allowDuplicate?: boolean
  /** Clés à exclure lors de la duplication / Keys to exclude when duplicating */
  duplicateExcludeKeys?: string[]
  /** Transformer les données du formulaire avant envoi / Transform form data before submit */
  transformPayload?: (data: Record<string, unknown>) => Record<string, unknown>
}

export function CrudPage<T extends { id: number }>({
  title,
  endpoint,
  columns,
  fields,
  searchKeys = [],
  createTitle,
  editTitle,
  importEntity,
  exportEntity,
  apiParams,
  allowDuplicate,
  duplicateExcludeKeys = ['id', 'schedules'],
  transformPayload,
}: CrudPageProps<T>) {
  const { t } = useTranslation()
  const { data, loading, refetch } = useApi<T>(endpoint, apiParams)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, unknown> | undefined>()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleCreate = () => {
    setEditItem(undefined)
    setFormOpen(true)
  }

  const handleEdit = (row: T) => {
    setEditItem(row as unknown as Record<string, unknown>)
    setFormOpen(true)
  }

  const handleDuplicate = (row: T) => {
    const copy = { ...(row as unknown as Record<string, unknown>) }
    for (const key of duplicateExcludeKeys) {
      delete copy[key]
    }
    // Vider le code pour forcer un nouveau code / Clear code to force a new one
    if ('code' in copy) copy.code = ''
    setEditItem(copy)
    setFormOpen(true)
  }

  const handleSave = useCallback(async (formData: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = transformPayload ? transformPayload(formData) : formData
      if (editItem?.id) {
        await update<T>(endpoint, editItem.id as number, payload as Partial<T>)
      } else {
        await create<T>(endpoint, payload as Partial<T>)
      }
      setFormOpen(false)
      setEditItem(undefined)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [editItem, endpoint, refetch, transformPayload])

  const handleDelete = useCallback(async () => {
    if (deleteId == null) return
    setSaving(true)
    try {
      await remove(endpoint, deleteId)
      setDeleteId(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [deleteId, endpoint, refetch])

  return (
    <div>
      <DataTable<T>
        title={title}
        columns={columns}
        data={data}
        loading={loading}
        searchable
        searchKeys={searchKeys}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
        onDuplicate={allowDuplicate ? handleDuplicate : undefined}
        onImport={importEntity ? () => setImportOpen(true) : undefined}
        onExport={exportEntity ? (format) => downloadExport(exportEntity, format) : undefined}
      />

      <FormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(undefined) }}
        onSubmit={handleSave}
        title={editItem?.id ? editTitle : createTitle}
        fields={fields}
        initialData={editItem}
        loading={saving}
      />

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.deleteTitle')}
        message={t('common.deleteConfirm')}
        loading={saving}
      />

      {importEntity && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          entityType={importEntity}
          onSuccess={refetch}
        />
      )}
    </div>
  )
}
