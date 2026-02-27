/* Page Types de surcharge / Surcharge type management page */

import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import type { SurchargeType } from '../types'

export default function SurchargeTypes() {
  const columns: Column<SurchargeType>[] = [
    { key: 'code', label: 'Code', width: '140px', filterable: true },
    { key: 'label', label: 'Libellé', filterable: true },
    {
      key: 'is_active', label: 'Actif', width: '80px',
      render: (row) => row.is_active ? '✓' : '✗',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'label', label: 'Libellé', type: 'text', required: true },
    {
      key: 'is_active', label: 'Actif', type: 'select',
      defaultValue: 'true',
      options: [
        { value: 'true', label: 'Oui' },
        { value: 'false', label: 'Non' },
      ],
    },
  ]

  return (
    <CrudPage<SurchargeType>
      title="Types de surcharge"
      endpoint="/surcharge-types"
      columns={columns}
      fields={fields}
      searchKeys={['code', 'label']}
      createTitle="Nouveau type de surcharge"
      editTitle="Modifier type de surcharge"
      transformPayload={(d) => ({
        ...d,
        is_active: d.is_active === 'true' || d.is_active === true,
      })}
    />
  )
}
