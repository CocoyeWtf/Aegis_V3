/* Historique des tours / Tour history page */

import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../stores/useAppStore'
import type { Tour, Vehicle, BaseLogistics, Contract } from '../types'
import type { Column } from '../components/data/DataTable'
import { DataTable } from '../components/data/DataTable'

export default function TourHistory() {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()

  const params = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: tours, loading } = useApi<Tour>('/tours', params)
  const { data: vehicles } = useApi<Vehicle>('/vehicles')
  const { data: bases } = useApi<BaseLogistics>('/bases')
  const { data: contracts } = useApi<Contract>('/contracts')

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]))
  const baseMap = new Map(bases.map((b) => [b.id, b]))
  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  const statusColors: Record<string, string> = {
    DRAFT: 'var(--text-muted)',
    VALIDATED: 'var(--color-primary)',
    IN_PROGRESS: 'var(--color-warning)',
    COMPLETED: 'var(--color-success)',
  }

  const columns: Column<Tour>[] = [
    { key: 'code', label: t('common.code'), width: '120px' },
    { key: 'date', label: t('common.date'), width: '110px' },
    {
      key: 'base_id',
      label: t('tourHistory.base'),
      width: '140px',
      render: (row) => baseMap.get(row.base_id)?.name ?? `#${row.base_id}`,
    },
    {
      key: 'vehicle_id',
      label: t('tourHistory.vehicle'),
      width: '140px',
      render: (row) => vehicleMap.get(row.vehicle_id)?.code ?? `#${row.vehicle_id}`,
    },
    {
      key: 'contract_id',
      label: t('tourHistory.transporter'),
      width: '140px',
      render: (row) => (row.contract_id ? contractMap.get(row.contract_id)?.transporter_name ?? '—' : '—'),
    },
    { key: 'total_eqp', label: 'EQP', width: '70px' },
    {
      key: 'total_km',
      label: 'Km',
      width: '80px',
      render: (row) => (row.total_km != null ? `${row.total_km.toFixed(1)}` : '—'),
    },
    {
      key: 'total_cost',
      label: t('tourHistory.cost'),
      width: '90px',
      render: (row) => (row.total_cost != null ? `${row.total_cost.toFixed(2)} €` : '—'),
    },
    {
      key: 'status',
      label: t('common.status'),
      width: '100px',
      render: (row) => (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: statusColors[row.status] }}>
          {t(`tourHistory.status.${row.status}`)}
        </span>
      ),
    },
    {
      key: 'departure_time',
      label: t('tourHistory.departure'),
      width: '90px',
      render: (row) => row.departure_time ?? '—',
    },
    {
      key: 'return_time',
      label: t('tourHistory.return'),
      width: '90px',
      render: (row) => row.return_time ?? '—',
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('tourHistory.title')}
      </h2>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : (
        <DataTable<Tour>
          data={tours}
          columns={columns}
          searchKeys={['code', 'date']}
        />
      )}
    </div>
  )
}
