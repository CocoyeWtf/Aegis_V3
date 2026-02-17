/* Historique des tours / Tour history page */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../stores/useAppStore'
import { remove } from '../services/api'
import type { Tour, BaseLogistics, Contract } from '../types'
import type { Column } from '../components/data/DataTable'
import { DataTable } from '../components/data/DataTable'

export default function TourHistory() {
  const { t } = useTranslation()
  const { selectedRegionId } = useAppStore()
  const [deleting, setDeleting] = useState<number | null>(null)

  const params = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: tours, loading, refetch } = useApi<Tour>('/tours', params)
  const { data: bases } = useApi<BaseLogistics>('/bases')
  const { data: contracts } = useApi<Contract>('/contracts')

  const baseMap = new Map(bases.map((b) => [b.id, b]))
  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  const statusColors: Record<string, string> = {
    DRAFT: 'var(--text-muted)',
    VALIDATED: 'var(--color-primary)',
    IN_PROGRESS: 'var(--color-warning)',
    COMPLETED: 'var(--color-success)',
  }

  const handleDelete = async (tour: Tour) => {
    if (!confirm(t('tourHistory.confirmDelete', { code: tour.code }))) return
    setDeleting(tour.id)
    try {
      await remove('/tours', tour.id)
      refetch()
    } catch (e) {
      console.error('Failed to delete tour', e)
    } finally {
      setDeleting(null)
    }
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
      key: 'contract_id',
      label: t('tourHistory.vehicle'),
      width: '160px',
      render: (row) => {
        const c = contractMap.get(row.contract_id)
        if (!c) return `#${row.contract_id}`
        return c.vehicle_code ? `${c.vehicle_code} — ${c.vehicle_name ?? ''}` : c.code
      },
    },
    {
      key: 'contract_id' as keyof Tour,
      label: t('tourHistory.transporter'),
      width: '140px',
      render: (row) => contractMap.get(row.contract_id)?.transporter_name ?? '—',
    },
    {
      key: 'id' as keyof Tour,
      label: t('tourPlanning.stops'),
      width: '70px',
      render: (row) => row.stops?.length ?? 0,
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
    {
      key: 'id' as keyof Tour,
      label: '',
      width: '80px',
      render: (row) => (
        <button
          className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--color-danger)', backgroundColor: 'rgba(239,68,68,0.1)' }}
          onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
          disabled={deleting === row.id}
        >
          {deleting === row.id ? '...' : t('tourHistory.undoTour')}
        </button>
      ),
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
