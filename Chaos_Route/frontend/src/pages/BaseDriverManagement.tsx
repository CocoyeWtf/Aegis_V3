/* Page Chauffeurs Base / Base Driver management page */

import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { BaseDriver, BaseLogistics } from '../types'

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'INACTIVE', label: 'Inactif' },
  { value: 'ON_LEAVE', label: 'En congé' },
]

const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s

export default function BaseDriverManagement() {
  const { data: bases } = useApi<BaseLogistics>('/bases')

  const columns: Column<BaseDriver>[] = [
    { key: 'code_infolog', label: 'Code Infolog', width: '130px', filterable: true },
    { key: 'last_name', label: 'Nom', filterable: true },
    { key: 'first_name', label: 'Prénom', filterable: true },
    {
      key: 'status', label: 'Statut', width: '100px', filterable: true,
      render: (row) => statusLabel(row.status),
      filterValue: (row) => statusLabel(row.status),
    },
    {
      key: 'base_id', label: 'Base', width: '180px', filterable: true,
      render: (row) => bases.find((b) => b.id === row.base_id)?.name || '—',
      filterValue: (row) => bases.find((b) => b.id === row.base_id)?.name || '',
    },
    { key: 'phone', label: 'Téléphone', width: '130px' },
  ]

  const fields: FieldDef[] = [
    { key: 'last_name', label: 'Nom', type: 'text', required: true },
    { key: 'first_name', label: 'Prénom', type: 'text', required: true },
    { key: 'code_infolog', label: 'Code Infolog', type: 'text', required: true },
    {
      key: 'status', label: 'Statut', type: 'select',
      options: STATUS_OPTIONS,
    },
    {
      key: 'base_id', label: 'Base', type: 'select', required: true,
      options: bases.map((b) => ({ value: String(b.id), label: `${b.code} — ${b.name}` })),
    },
    { key: 'phone', label: 'Téléphone', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  return (
    <CrudPage<BaseDriver>
      resource="base-drivers"
      title="Chauffeurs Base"
      endpoint="/base-drivers"
      columns={columns}
      fields={fields}
      searchKeys={['code_infolog', 'last_name', 'first_name']}
      createTitle="Nouveau chauffeur base"
      editTitle="Modifier chauffeur base"
      transformPayload={(d) => ({ ...d, base_id: Number(d.base_id) })}
    />
  )
}
