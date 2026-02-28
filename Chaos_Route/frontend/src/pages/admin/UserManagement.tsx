/* Page gestion des utilisateurs / User management page */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../../components/data/DataTable'
import { FormDialog, type FieldDef } from '../../components/data/FormDialog'
import { ConfirmDialog } from '../../components/data/ConfirmDialog'
import { useApi } from '../../hooks/useApi'
import { create, update, remove } from '../../services/api'
import { DriverBadgeCard } from '../../components/print/DriverBadgeCard'
import type { UserAccount, Role, Region, PDV } from '../../types'

export default function UserManagement() {
  const { t } = useTranslation()
  const { data: users, loading, refetch } = useApi<UserAccount>('/users')
  const { data: roles } = useApi<Role>('/roles')
  const { data: regions } = useApi<Region>('/regions')
  const { data: pdvs } = useApi<PDV>('/pdvs')

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, unknown> | undefined>()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [badgeUser, setBadgeUser] = useState<UserAccount | null>(null)

  const columns: Column<UserAccount>[] = [
    { key: 'username', label: t('admin.users.username'), width: '140px' },
    { key: 'email', label: t('admin.users.email') },
    {
      key: 'roles',
      label: t('admin.users.roles'),
      render: (row) =>
        row.roles.map((r) => r.name).join(', ') || '—',
    },
    {
      key: 'regions',
      label: t('admin.users.regions'),
      render: (row) =>
        row.regions.map((r) => r.name).join(', ') || t('admin.users.allRegions'),
    },
    {
      key: 'is_active',
      label: t('admin.users.active'),
      width: '80px',
      render: (row) => row.is_active ? '✓' : '✗',
    },
    {
      key: 'is_superadmin',
      label: 'Superadmin',
      width: '100px',
      render: (row) => row.is_superadmin ? '✓' : '',
    },
    {
      key: 'badge_code' as keyof UserAccount, label: 'Badge', width: '70px',
      render: (row) => row.badge_code ? (
        <button
          onClick={(e) => { e.stopPropagation(); setBadgeUser(row) }}
          className="px-2 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          title="Voir badge chauffeur"
        >
          Badge
        </button>
      ) : '—',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'username', label: t('admin.users.username'), type: 'text', required: true },
    { key: 'email', label: t('admin.users.email'), type: 'text', required: true },
    {
      key: 'password',
      label: t('admin.users.password'),
      type: 'password',
      required: !editItem?.id,
      placeholder: editItem?.id ? t('admin.users.passwordPlaceholder') : undefined,
    },
    { key: 'is_active', label: t('admin.users.active'), type: 'checkbox' },
    { key: 'is_superadmin', label: 'Superadmin', type: 'checkbox' },
    {
      key: 'role_ids',
      label: t('admin.users.roles'),
      type: 'multicheck',
      getOptions: () => roles.map((r) => ({ value: String(r.id), label: r.name })),
    },
    {
      key: 'region_ids',
      label: t('admin.users.regions'),
      type: 'multicheck',
      getOptions: () => regions.map((r) => ({ value: String(r.id), label: r.name })),
    },
    {
      key: 'pdv_id',
      label: 'PDV lié',
      type: 'select',
      options: [
        { value: '', label: '— Aucun —' },
        ...pdvs.map((p) => ({ value: String(p.id), label: `${p.code} — ${p.name}` })),
      ],
    },
  ]

  const handleCreate = () => {
    setEditItem(undefined)
    setFormOpen(true)
  }

  const handleEdit = (row: UserAccount) => {
    setEditItem({
      ...row,
      role_ids: row.roles.map((r) => String(r.id)),
      region_ids: row.regions.map((r) => String(r.id)),
      pdv_id: row.pdv_id ? String(row.pdv_id) : '',
      password: '',
    })
    setFormOpen(true)
  }

  const handleSave = useCallback(async (formData: Record<string, unknown>) => {
    setSaving(true)
    try {
      const pdvIdVal = formData.pdv_id ? Number(formData.pdv_id) : null
      const payload: Record<string, unknown> = {
        username: formData.username,
        email: formData.email,
        is_active: formData.is_active ?? true,
        is_superadmin: formData.is_superadmin ?? false,
        role_ids: ((formData.role_ids as string[]) || []).map(Number),
        region_ids: ((formData.region_ids as string[]) || []).map(Number),
        pdv_id: pdvIdVal,
      }
      // N'envoyer le password que s'il est rempli / Only send password if filled
      const pwd = (formData.password as string | null) ?? ''
      if (pwd.trim().length > 0) {
        payload.password = pwd
      }

      if (editItem?.id) {
        await update<UserAccount>('/users', editItem.id as number, payload as Partial<UserAccount>)
      } else {
        await create<UserAccount>('/users', payload as Partial<UserAccount>)
      }
      setFormOpen(false)
      setEditItem(undefined)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [editItem, refetch])

  const handleDelete = useCallback(async () => {
    if (deleteId == null) return
    setSaving(true)
    try {
      await remove('/users', deleteId)
      setDeleteId(null)
      refetch()
    } finally {
      setSaving(false)
    }
  }, [deleteId, refetch])

  return (
    <div>
      <DataTable<UserAccount>
        title={t('admin.users.title')}
        columns={columns}
        data={users}
        loading={loading}
        searchable
        searchKeys={['username', 'email']}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={(row) => setDeleteId(row.id)}
      />

      <FormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditItem(undefined) }}
        onSubmit={handleSave}
        title={editItem?.id ? t('admin.users.edit') : t('admin.users.new')}
        fields={fields}
        initialData={editItem}
        loading={saving}
        size="md"
      />

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.deleteTitle')}
        message={t('common.deleteConfirm')}
        loading={saving}
      />

      {/* Modal badge chauffeur / Driver badge modal */}
      {badgeUser && badgeUser.badge_code && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999 }}
          onClick={() => setBadgeUser(null)}
        >
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: 'var(--bg-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <DriverBadgeCard
              badgeCode={badgeUser.badge_code}
              username={badgeUser.username}
              roleName={badgeUser.roles.map((r) => r.name).join(', ') || undefined}
              onClose={() => setBadgeUser(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
