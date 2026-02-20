/* Page Types de support / Support type management page */

import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { SupportType } from '../types'

export default function SupportTypes() {
  const columns: Column<SupportType>[] = [
    { key: 'code', label: 'Code', width: '120px', filterable: true },
    { key: 'name', label: 'Nom', filterable: true },
    { key: 'unit_quantity', label: 'Qté/unité', width: '100px' },
    { key: 'unit_label', label: 'Libellé unité', filterable: true },
    {
      key: 'is_active', label: 'Actif', width: '80px',
      render: (row) => row.is_active ? '✓' : '✗',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'name', label: 'Nom', type: 'text', required: true },
    { key: 'unit_quantity', label: 'Quantité par unité', type: 'number', required: true },
    { key: 'unit_label', label: 'Libellé unité (ex: pile de 15)', type: 'text' },
    {
      key: 'is_active', label: 'Actif', type: 'select',
      options: [
        { value: 'true', label: 'Oui' },
        { value: 'false', label: 'Non' },
      ],
    },
  ]

  return (
    <CrudPage<SupportType>
      title="Types de support"
      endpoint="/support-types"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'name']}
      createTitle="Nouveau type de support"
      editTitle="Modifier type de support"
      defaultValues={{ unit_quantity: 1, is_active: 'true' }}
      transformPayload={(d) => ({
        ...d,
        unit_quantity: Number(d.unit_quantity),
        is_active: d.is_active === 'true' || d.is_active === true,
      })}
    />
  )
}
