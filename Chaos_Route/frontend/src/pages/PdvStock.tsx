/* Stock contenants PDV / PDV container stock — 2 onglets : stock actuel + historique */

import { useState, useMemo } from 'react'
import { DataTable, type Column } from '../components/data/DataTable'
import { useApi } from '../hooks/useApi'
import type { PdvStockDetail, PdvInventoryRecord } from '../types'

type TabKey = 'stock' | 'history'

/* Wrapper avec id synthétique pour DataTable (T extends { id: number }) */
type StockRow = PdvStockDetail & { id: number }
type HistoryRow = PdvInventoryRecord

export default function PdvStock() {
  const [tab, setTab] = useState<TabKey>('stock')
  const [supportFilter, setSupportFilter] = useState('')

  const { data: rawStocks, loading: loadingStocks } = useApi<PdvStockDetail>('/pdv-stock')
  const { data: history, loading: loadingHistory } = useApi<PdvInventoryRecord>('/pdv-stock/history', { limit: 200 })

  /* Ajout id synthétique au stock (pdv_id + support_type_id) */
  const stocks: StockRow[] = useMemo(
    () => rawStocks.map((s, i) => ({ ...s, id: i + 1 })),
    [rawStocks],
  )

  /* Liste unique des types de support pour le filtre dropdown */
  const supportTypes = useMemo(() => {
    const map = new Map<number, { id: number; code: string; name: string }>()
    for (const s of rawStocks) {
      if (!map.has(s.support_type_id)) {
        map.set(s.support_type_id, {
          id: s.support_type_id,
          code: s.support_type_code,
          name: s.support_type_name,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [rawStocks])

  /* Filtrage par type de support */
  const filteredStocks = useMemo(() => {
    if (!supportFilter) return stocks
    return stocks.filter((s) => String(s.support_type_id) === supportFilter)
  }, [stocks, supportFilter])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'stock', label: 'Stock actuel' },
    { key: 'history', label: 'Historique' },
  ]

  /* Colonnes — Stock actuel */
  const stockColumns: Column<StockRow>[] = [
    {
      key: 'pdv_code', label: 'PDV', width: '280px', filterable: true,
      render: (row) => `${row.pdv_code} — ${row.pdv_name}`,
      filterValue: (row) => `${row.pdv_code} ${row.pdv_name}`,
    },
    {
      key: 'support_type_code', label: 'Type support', width: '220px', filterable: true,
      render: (row) => `${row.support_type_code} — ${row.support_type_name}`,
      filterValue: (row) => `${row.support_type_code} ${row.support_type_name}`,
    },
    { key: 'current_stock', label: 'Stock actuel', width: '120px' },
    {
      key: 'last_inventory_at', label: 'Dernier inventaire', width: '180px',
      render: (row) => row.last_inventory_at
        ? new Date(row.last_inventory_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '—',
    },
    {
      key: 'last_inventoried_by', label: 'Inventorie par', width: '150px',
      render: (row) => row.last_inventoried_by || '—',
    },
  ]

  /* Colonnes — Historique */
  const historyColumns: Column<HistoryRow>[] = [
    {
      key: 'inventoried_at', label: 'Date', width: '180px',
      render: (row) => new Date(row.inventoried_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
    },
    {
      key: 'pdv_id', label: 'PDV', width: '200px', filterable: true,
      render: (row) => String(row.pdv_id),
      filterValue: (row) => String(row.pdv_id),
    },
    {
      key: 'support_type_id', label: 'Type support', width: '200px',
      render: (row) => String(row.support_type_id),
    },
    { key: 'quantity', label: 'Quantite', width: '120px' },
    {
      key: 'inventoried_by', label: 'Par', width: '150px',
      render: (row) => row.inventoried_by || '—',
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Stock contenants PDV
      </h1>

      {/* Onglets / Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-t-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.key ? 'var(--bg-secondary)' : 'transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--text-muted)',
              borderColor: tab === t.key ? 'var(--color-primary)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'stock' && (
        <div>
          {/* Filtre type support */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Type support :</label>
            <select
              value={supportFilter}
              onChange={(e) => setSupportFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm border"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <option value="">Tous</option>
              {supportTypes.map((st) => (
                <option key={st.id} value={String(st.id)}>
                  {st.code} — {st.name}
                </option>
              ))}
            </select>
          </div>

          <DataTable<StockRow>
            columns={stockColumns}
            data={filteredStocks}
            loading={loadingStocks}
            searchable
            searchKeys={['pdv_code', 'pdv_name'] as (keyof StockRow)[]}
          />
        </div>
      )}

      {tab === 'history' && (
        <DataTable<HistoryRow>
          columns={historyColumns}
          data={history}
          loading={loadingHistory}
          searchable
          searchKeys={['inventoried_by'] as (keyof HistoryRow)[]}
        />
      )}
    </div>
  )
}
