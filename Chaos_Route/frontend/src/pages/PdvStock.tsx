/* Stock contenants PDV / PDV container stock — 3 onglets : stock actuel + dépassements PUO + historique */

import { useState, useMemo, useCallback } from 'react'
import { DataTable, type Column } from '../components/data/DataTable'
import { useApi } from '../hooks/useApi'
import { useAuthStore } from '../stores/useAuthStore'
import api from '../services/api'
import type { PdvStockDetail, PdvInventoryRecord, PuoOverageReport } from '../types'

type TabKey = 'stock' | 'overages' | 'history'

/* Wrapper avec id synthétique pour DataTable (T extends { id: number }) */
type StockRow = PdvStockDetail & { id: number }
type HistoryRow = PdvInventoryRecord

export default function PdvStock() {
  const user = useAuthStore((s) => s.user)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const isPdvUser = !!user?.pdv_id
  const canUpdate = hasPermission('pdv-stock', 'update')

  const [tab, setTab] = useState<TabKey>('stock')
  const [supportFilter, setSupportFilter] = useState('')
  const [editingPuo, setEditingPuo] = useState<{ pdvId: number; stId: number } | null>(null)
  const [puoValue, setPuoValue] = useState('')
  const [savingPuo, setSavingPuo] = useState(false)

  const pdvParams = isPdvUser && user?.pdv_id ? { pdv_id: user.pdv_id } : undefined
  const historyParams = { limit: 200, ...(isPdvUser && user?.pdv_id ? { pdv_id: user.pdv_id } : {}) }
  const { data: rawStocks, loading: loadingStocks, refetch: refetchStocks } = useApi<PdvStockDetail>('/pdv-stock', pdvParams)
  const { data: history, loading: loadingHistory } = useApi<PdvInventoryRecord>('/pdv-stock/history', historyParams)

  // Rapport dépassements PUO / PUO overage report
  const [overageReport, setOverageReport] = useState<PuoOverageReport | null>(null)
  const [loadingOverages, setLoadingOverages] = useState(false)

  const fetchOverages = useCallback(async () => {
    setLoadingOverages(true)
    try {
      const res = await api.get('/pdv-stock/puo/overages/')
      setOverageReport(res.data)
    } catch { /* silent */ }
    finally { setLoadingOverages(false) }
  }, [])

  const handleTabChange = (key: TabKey) => {
    setTab(key)
    if (key === 'overages' && !overageReport) fetchOverages()
  }

  /* Ajout id synthétique au stock (pdv_id + support_type_id) */
  const stocks: StockRow[] = useMemo(
    () => rawStocks.map((s, i) => ({ ...s, id: i + 1 })),
    [rawStocks],
  )

  /* Stats PUO globales */
  const puoStats = useMemo(() => {
    const withPuo = stocks.filter((s) => s.puo !== null && s.puo !== undefined)
    const overages = withPuo.filter((s) => s.current_stock > (s.puo ?? 0))
    const totalOverageValue = overages.reduce((sum, s) => {
      const overage = s.current_stock - (s.puo ?? 0)
      return sum + overage * (s.unit_value ?? 0)
    }, 0)
    return { withPuo: withPuo.length, overages: overages.length, totalOverageValue }
  }, [stocks])

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

  /* Sauvegarder PUO / Save PUO */
  const savePuo = async (pdvId: number, stId: number) => {
    setSavingPuo(true)
    try {
      const puo = puoValue === '' ? null : parseInt(puoValue, 10)
      await api.put('/pdv-stock/puo/', { pdv_id: pdvId, support_type_id: stId, puo })
      setEditingPuo(null)
      refetchStocks()
      if (overageReport) fetchOverages()
    } catch { /* silent */ }
    finally { setSavingPuo(false) }
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'stock', label: 'Stock actuel' },
    { key: 'overages', label: 'Depassements PUO', badge: puoStats.overages || undefined },
    { key: 'history', label: 'Historique' },
  ]

  /* Colonnes — Stock actuel */
  const stockColumns: Column<StockRow>[] = [
    {
      key: 'pdv_code', label: 'PDV', width: '260px', filterable: true,
      render: (row) => `${row.pdv_code} — ${row.pdv_name}`,
      filterValue: (row) => `${row.pdv_code} ${row.pdv_name}`,
    },
    {
      key: 'support_type_code', label: 'Type support', width: '200px', filterable: true,
      render: (row) => `${row.support_type_code} — ${row.support_type_name}`,
      filterValue: (row) => `${row.support_type_code} ${row.support_type_name}`,
    },
    { key: 'current_stock', label: 'Stock actuel', width: '110px',
      render: (row) => {
        const isOver = row.puo !== null && row.puo !== undefined && row.current_stock > row.puo
        return (
          <span style={{ color: isOver ? '#ef4444' : undefined, fontWeight: isOver ? 700 : undefined }}>
            {row.current_stock}
          </span>
        )
      },
    },
    {
      key: 'puo' as keyof StockRow, label: 'PUO', width: '120px',
      render: (row) => {
        const isEditing = editingPuo?.pdvId === row.pdv_id && editingPuo?.stId === row.support_type_id
        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={puoValue}
                onChange={(e) => setPuoValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') savePuo(row.pdv_id, row.support_type_id)
                  if (e.key === 'Escape') setEditingPuo(null)
                }}
                className="w-16 px-1.5 py-0.5 rounded text-sm border"
                style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--color-primary)', color: 'var(--text-primary)' }}
                autoFocus
                disabled={savingPuo}
              />
              <button onClick={() => savePuo(row.pdv_id, row.support_type_id)} disabled={savingPuo}
                className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#22c55e' }}>OK</button>
              <button onClick={() => setEditingPuo(null)} className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>X</button>
            </div>
          )
        }
        return (
          <span
            className={canUpdate ? 'cursor-pointer hover:underline' : ''}
            style={{ color: row.puo !== null ? 'var(--text-primary)' : 'var(--text-muted)' }}
            onClick={() => {
              if (!canUpdate) return
              setEditingPuo({ pdvId: row.pdv_id, stId: row.support_type_id })
              setPuoValue(row.puo !== null && row.puo !== undefined ? String(row.puo) : '')
            }}
          >
            {row.puo !== null && row.puo !== undefined ? row.puo : '—'}
          </span>
        )
      },
    },
    {
      key: 'id' as keyof StockRow, label: 'Ecart', width: '100px',
      render: (row) => {
        if (row.puo === null || row.puo === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        const diff = row.current_stock - row.puo
        if (diff === 0) return <span style={{ color: '#22c55e' }}>0</span>
        return (
          <span style={{ color: diff > 0 ? '#ef4444' : '#3b82f6', fontWeight: 600 }}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )
      },
    },
    {
      key: 'last_inventory_at', label: 'Dernier inventaire', width: '160px',
      render: (row) => row.last_inventory_at
        ? new Date(row.last_inventory_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '—',
    },
    {
      key: 'last_inventoried_by', label: 'Par', width: '120px',
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

      {/* KPI PUO en haut / PUO KPI cards */}
      {puoStats.withPuo > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{puoStats.withPuo}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Lignes avec PUO</div>
          </div>
          <div className="rounded-xl border p-3 text-center"
            style={{ borderColor: puoStats.overages > 0 ? '#ef4444' : 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ color: puoStats.overages > 0 ? '#ef4444' : '#22c55e' }}>
              {puoStats.overages}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Depassements</div>
          </div>
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <div className="text-2xl font-bold" style={{ color: puoStats.totalOverageValue > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
              {puoStats.totalOverageValue > 0 ? `${puoStats.totalOverageValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} EUR` : '—'}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Valeur depassements</div>
          </div>
        </div>
      )}

      {/* Onglets / Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className="px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2"
            style={{
              backgroundColor: tab === t.key ? 'var(--bg-secondary)' : 'transparent',
              color: tab === t.key ? 'var(--color-primary)' : 'var(--text-muted)',
              borderColor: tab === t.key ? 'var(--color-primary)' : 'transparent',
            }}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}>
                {t.badge}
              </span>
            )}
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

      {tab === 'overages' && (
        <div>
          {loadingOverages && (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
          )}
          {!loadingOverages && overageReport && (
            <>
              {/* KPI dépassements */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border p-3 text-center" style={{ borderColor: '#ef4444', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>{overageReport.pdv_count}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>PDV en depassement</div>
                </div>
                <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>{overageReport.total_overage_units}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Unites en exces</div>
                </div>
                <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                    {overageReport.total_overage_value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} EUR
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Projection facturation</div>
                </div>
              </div>

              {overageReport.items.length === 0 ? (
                <div className="text-center py-8 rounded-xl border" style={{ borderColor: '#22c55e', color: '#22c55e', backgroundColor: '#22c55e08' }}>
                  Aucun depassement PUO — tous les PDV sont dans les clous !
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>PDV</th>
                        <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Type support</th>
                        <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Stock</th>
                        <th className="text-right px-3 py-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>PUO</th>
                        <th className="text-right px-3 py-2 font-semibold" style={{ color: '#ef4444' }}>Exces</th>
                        <th className="text-right px-3 py-2 font-semibold" style={{ color: '#f59e0b' }}>Valeur EUR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overageReport.items.map((item, i) => (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                            {item.pdv_code} — {item.pdv_name}
                          </td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                            {item.support_type_code} — {item.support_type_name}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                            {item.current_stock}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                            {item.puo}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: '#ef4444' }}>
                            +{item.overage}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: '#f59e0b' }}>
                            {item.overage_value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
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
