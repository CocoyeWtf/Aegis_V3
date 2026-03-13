/* KPI taux de reprise contenants par chauffeur et contrat / Container pickup rate KPI */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'

interface PickupRateSummary {
  total_planned: number
  total_picked_up: number
  total_received: number
  rate_pct: number
}

interface DriverRate {
  driver: string
  tours_count: number
  planned: number
  picked_up: number
  received: number
  pickup_rate_pct: number
  receive_rate_pct: number
}

interface ContractRate {
  contract: string
  tours_count: number
  planned: number
  picked_up: number
  received: number
  pickup_rate_pct: number
  receive_rate_pct: number
}

interface PickupRateResponse {
  summary: PickupRateSummary
  by_driver: DriverRate[]
  by_contract: ContractRate[]
}

interface PickupRateKpiProps {
  dateFrom: string
  dateTo: string
  regionId?: number | null
}

type SortKey = 'name' | 'tours' | 'planned' | 'picked_up' | 'received' | 'pickup_rate' | 'receive_rate'
type SortDir = 'asc' | 'desc'

function RateBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold w-14 text-right" style={{ color }}>{pct}%</span>
    </div>
  )
}

function rateColor(pct: number): string {
  if (pct >= 90) return '#22c55e'
  if (pct >= 70) return '#f59e0b'
  return '#ef4444'
}

export function PickupRateKpi({ dateFrom, dateTo, regionId }: PickupRateKpiProps) {
  const [data, setData] = useState<PickupRateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'driver' | 'contract'>('driver')
  const [sortKey, setSortKey] = useState<SortKey>('pickup_rate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo }
      if (regionId) params.region_id = String(regionId)
      const { data: resp } = await api.get<PickupRateResponse>('/kpi/pickup-rate', { params })
      setData(resp)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, regionId])

  useEffect(() => { load() }, [load])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortFn = useCallback((a: DriverRate | ContractRate, b: DriverRate | ContractRate) => {
    let va: number | string, vb: number | string
    const nameA = 'driver' in a ? a.driver : (a as ContractRate).contract
    const nameB = 'driver' in b ? b.driver : (b as ContractRate).contract
    switch (sortKey) {
      case 'name': va = nameA; vb = nameB; break
      case 'tours': va = a.tours_count; vb = b.tours_count; break
      case 'planned': va = a.planned; vb = b.planned; break
      case 'picked_up': va = a.picked_up; vb = b.picked_up; break
      case 'received': va = a.received; vb = b.received; break
      case 'pickup_rate': va = a.pickup_rate_pct; vb = b.pickup_rate_pct; break
      case 'receive_rate': va = a.receive_rate_pct; vb = b.receive_rate_pct; break
      default: va = 0; vb = 0
    }
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  }, [sortKey, sortDir])

  const sortedDrivers = useMemo(() => data ? [...data.by_driver].sort(sortFn) : [], [data, sortFn])
  const sortedContracts = useMemo(() => data ? [...data.by_contract].sort(sortFn) : [], [data, sortFn])

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  if (loading) {
    return (
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Chargement KPI reprises...</p>
      </div>
    )
  }

  if (!data || data.summary.total_planned === 0) {
    return (
      <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Taux de reprise contenants</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucune reprise planifiee sur la periode.</p>
      </div>
    )
  }

  const s = data.summary
  const globalColor = rateColor(s.rate_pct)

  const thStyle: React.CSSProperties = { color: 'var(--text-muted)', textAlign: 'left', padding: '6px 8px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '6px 8px', fontSize: '13px', color: 'var(--text-primary)' }

  return (
    <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
      <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Taux de reprise contenants</h3>

      {/* Summary gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="text-2xl font-bold" style={{ color: globalColor }}>{s.rate_pct}%</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Taux reprise</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.total_planned}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Labels planifies</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{s.total_picked_up}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Repris chauffeur</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="text-2xl font-bold" style={{ color: '#22c55e' }}>{s.total_received}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Recus base</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(['driver', 'contract'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSortKey('pickup_rate'); setSortDir('asc') }}
            className="px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t ? 'var(--bg-tertiary)' : 'transparent',
              color: tab === t ? 'var(--color-primary)' : 'var(--text-muted)',
            }}
          >
            {t === 'driver' ? 'Par chauffeur' : 'Par contrat'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={thStyle} onClick={() => handleSort('name')}>
                {tab === 'driver' ? 'Chauffeur' : 'Contrat'}{arrow('name')}
              </th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('tours')}>Tours{arrow('tours')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('planned')}>Planifies{arrow('planned')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('picked_up')}>Repris{arrow('picked_up')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('received')}>Recus{arrow('received')}</th>
              <th style={{ ...thStyle, width: '200px' }} onClick={() => handleSort('pickup_rate')}>Taux reprise{arrow('pickup_rate')}</th>
              <th style={{ ...thStyle, width: '200px' }} onClick={() => handleSort('receive_rate')}>Taux reception{arrow('receive_rate')}</th>
            </tr>
          </thead>
          <tbody>
            {(tab === 'driver' ? sortedDrivers : sortedContracts).map((row, i) => {
              const name = 'driver' in row ? row.driver : (row as ContractRate).contract
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={tdStyle}>{name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.tours_count}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.planned}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.picked_up}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.received}</td>
                  <td style={tdStyle}><RateBar pct={row.pickup_rate_pct} color={rateColor(row.pickup_rate_pct)} /></td>
                  <td style={tdStyle}><RateBar pct={row.receive_rate_pct} color={rateColor(row.receive_rate_pct)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
