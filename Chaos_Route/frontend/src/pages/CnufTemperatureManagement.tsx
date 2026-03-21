/* Page gestion CNUF/Filiale → type température / CNUF/Filiale temperature mapping management */

import { CrudPage } from '../components/data/CrudPage'
import type { Column } from '../components/data/DataTable'
import type { FieldDef } from '../components/data/FormDialog'
import { useApi } from '../hooks/useApi'
import type { CnufTemperature, BaseLogistics } from '../types'

const TEMP_TYPE_OPTIONS = [
  { value: 'SEC', label: 'SEC (Sec)' },
  { value: 'FRAIS', label: 'FRAIS (Frais)' },
  { value: 'GEL', label: 'GEL (Gel)' },
  { value: 'FFL', label: 'FFL' },
]

const TEMP_TYPE_COLORS: Record<string, string> = {
  SEC: '#a3a3a3',
  FRAIS: '#3b82f6',
  GEL: '#8b5cf6',
  FFL: '#22c55e',
}

export default function CnufTemperatureManagement() {
  const { data: bases } = useApi<BaseLogistics>('/bases')

  const columns: Column<CnufTemperature>[] = [
    { key: 'cnuf', label: 'CNUF', width: '120px', filterable: true },
    { key: 'filiale', label: 'Filiale', width: '100px', filterable: true },
    {
      key: 'temperature_type', label: 'Type temperature', width: '140px', filterable: true,
      render: (row) => (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold"
          style={{ backgroundColor: TEMP_TYPE_COLORS[row.temperature_type] + '22', color: TEMP_TYPE_COLORS[row.temperature_type] }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TEMP_TYPE_COLORS[row.temperature_type] }} />
          {row.temperature_type}
        </span>
      ),
    },
    { key: 'label' as keyof CnufTemperature, label: 'Description', filterable: true },
    {
      key: 'base_id' as keyof CnufTemperature, label: 'Base', width: '150px', filterable: true,
      render: (row) => bases.find((b) => b.id === row.base_id)?.name || '—',
      filterValue: (row) => bases.find((b) => b.id === row.base_id)?.name || '',
    },
  ]

  const fields: FieldDef[] = [
    { key: 'cnuf', label: 'CNUF', type: 'text', required: true },
    { key: 'filiale', label: 'Filiale', type: 'text', required: true },
    {
      key: 'temperature_type', label: 'Type temperature', type: 'select', required: true,
      options: TEMP_TYPE_OPTIONS,
    },
    { key: 'label', label: 'Description', type: 'text', colSpan: 2 },
    {
      key: 'base_id', label: 'Base logistique', type: 'select',
      options: [{ value: '', label: '— Aucune —' }, ...bases.map((b) => ({ value: String(b.id), label: b.name }))],
    },
  ]

  return (
    <CrudPage<CnufTemperature>
      resource="cnuf-temperatures"
      title="CNUF / Filiale → Temperature"
      endpoint="/cnuf-temperatures"
      columns={columns}
      fields={fields}
      searchKeys={['cnuf', 'filiale', 'label']}
      createTitle="Nouveau mapping CNUF"
      editTitle="Modifier mapping CNUF"
      importEntity="cnuf-temperatures"
      exportEntity="cnuf-temperatures"
      transformPayload={(d) => ({
        ...d,
        base_id: d.base_id ? Number(d.base_id) : null,
      })}
    />
  )
}
