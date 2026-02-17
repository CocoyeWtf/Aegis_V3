/* Page gestion des rôles / Role management page */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../../components/data/DataTable'
import { ConfirmDialog } from '../../components/data/ConfirmDialog'
import { PermissionMatrix } from '../../components/admin/PermissionMatrix'
import { useApi } from '../../hooks/useApi'
import { create, update, remove } from '../../services/api'
import type { Role } from '../../types'

interface PermissionEntry {
  resource: string
  action: string
}

export default function RoleManagement() {
  const { t } = useTranslation()
  const { data: roles, loading, refetch } = useApi<Role>('/roles')

  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<PermissionEntry[]>([])
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const columns: Column<Role>[] = [
    { key: 'name', label: t('admin.roles.name'), width: '200px' },
    { key: 'description', label: t('admin.roles.description') },
    {
      key: 'permissions',
      label: t('admin.roles.permissionCount'),
      width: '120px',
      render: (row) => String(row.permissions.length),
    },
  ]

  const handleCreate = () => {
    setEditId(null)
    setName('')
    setDescription('')
    setPermissions([])
    setFormOpen(true)
  }

  const handleEdit = (row: Role) => {
    setEditId(row.id)
    setName(row.name)
    setDescription(row.description || '')
    setPermissions(row.permissions.map((p) => ({ resource: p.resource, action: p.action })))
    setFormOpen(true)
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload = { name, description: description || null, permissions }
      if (editId) {
        await update<Role>('/roles', editId, payload as Partial<Role>)
      } else {
        await create<Role>('/roles', payload as Partial<Role>)
      }
      setFormOpen(false)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [editId, name, description, permissions, refetch])

  const handleDelete = useCallback(async () => {
    if (deleteId == null) return
    setSaving(true)
    try {
      await remove('/roles', deleteId)
      setDeleteId(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [deleteId, refetch])

  const inputStyle = {
    backgroundColor: 'var(--bg-tertiary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
  }

  return (
    <div>
      <DataTable<Role>
        title={t('admin.roles.title')}
        columns={columns}
        data={roles}
        loading={loading}
        searchable
        searchKeys={['name', 'description']}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      {/* Dialog personnalisé avec matrice / Custom dialog with permission matrix */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setFormOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative rounded-xl border shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {editId ? t('admin.roles.edit') : t('admin.roles.new')}
              </h3>
              <button onClick={() => setFormOpen(false)} className="text-xl leading-none" style={{ color: 'var(--text-muted)' }}>
                x
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nom / Name */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('admin.roles.name')} <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('admin.roles.description')}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                  style={inputStyle}
                />
              </div>

              {/* Matrice de permissions / Permission matrix */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                  {t('admin.roles.permissions')}
                </label>
                <div
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
                >
                  <PermissionMatrix value={permissions} onChange={setPermissions} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !name}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.deleteTitle')}
        message={t('common.deleteConfirm')}
        loading={saving}
      />
    </div>
  )
}
