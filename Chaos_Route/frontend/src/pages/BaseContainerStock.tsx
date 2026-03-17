/* Stock contenants base / Base container stock — 2 onglets : stock actuel + mouvements */

import { useState, useMemo, useCallback } from 'react'
import { DataTable, type Column } from '../components/data/DataTable'
import { useApi } from '../hooks/useApi'
import api from '../services/api'
import type { BaseStockDetail, BaseMovementRecord, BaseLogistics, SupportType } from '../types'

type TabKey = 'stock' | 'movements'

const MVT_LABELS: Record<string, string> = {
  RECEIVED_FROM_PDV: 'Reception PDV',
  DELIVERY_PREP: 'Sortie preparation',
  SUPPLIER_RETURN: 'Retour fournisseur',
  INVENTORY_ADJUSTMENT: 'Ajustement inventaire',
  BASE_INVENTORY: 'Inventaire mobile',
}

export default function BaseContainerStock() {
  const [tab, setTab] = useState<TabKey>('stock')
  const [baseFilter, setBaseFilter] = useState('')
  const [supportFilter, setSupportFilter] = useState('')

  const { data: stocks, loading: loadingStocks, refetch: refetchStocks } = useApi<BaseStockDetail>('/base-container-stock')
  const { data: movements, loading: loadingMovements, refetch: refetchMovements } = useApi<BaseMovementRecord>('/base-container-stock/movements', { limit: 500 })
  const { data: bases } = useApi<BaseLogistics>('/bases')
  const { data: supportTypes } = useApi<SupportType>('/support-types')

  /* --- Inventaire dialog state --- */
  const [showInventory, setShowInventory] = useState(false)
  const [invBaseId, setInvBaseId] = useState<number | ''>('')
  const [invLines, setInvLines] = useState<{ support_type_id: number; quantity: number }[]>([])
  const [invSaving, setInvSaving] = useState(false)

  /* --- Ajustement dialog state --- */
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjBaseId, setAdjBaseId] = useState<number | ''>('')
  const [adjSupportId, setAdjSupportId] = useState<number | ''>('')
  const [adjQty, setAdjQty] = useState(0)
  const [adjType, setAdjType] = useState<'DELIVERY_PREP' | 'SUPPLIER_RETURN'>('DELIVERY_PREP')
  const [adjRef, setAdjRef] = useState('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjSaving, setAdjSaving] = useState(false)

  /* Filtrage */
  const filteredStocks = useMemo(() => {
    let result = stocks
    if (baseFilter) result = result.filter((s) => String(s.base_id) === baseFilter)
    if (supportFilter) result = result.filter((s) => String(s.support_type_id) === supportFilter)
    return result
  }, [stocks, baseFilter, supportFilter])

  const filteredMovements = useMemo(() => {
    let result = movements
    if (baseFilter) result = result.filter((m) => String(m.base_id) === baseFilter)
    if (supportFilter) result = result.filter((m) => String(m.support_type_id) === supportFilter)
    return result
  }, [movements, baseFilter, supportFilter])

  /* Bases et supports uniques pour filtres */
  const uniqueBases = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    for (const s of stocks) {
      if (!map.has(s.base_id)) map.set(s.base_id, { id: s.base_id, name: `${s.base_code} — ${s.base_name}` })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [stocks])

  const uniqueSupports = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>()
    for (const s of stocks) {
      if (!map.has(s.support_type_id)) map.set(s.support_type_id, { id: s.support_type_id, name: `${s.support_type_code} — ${s.support_type_name}` })
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [stocks])

  /* --- Inventaire --- */
  const openInventory = useCallback(() => {
    setInvBaseId('')
    setInvLines(supportTypes.filter((st) => st.is_active).map((st) => ({ support_type_id: st.id, quantity: 0 })))
    setShowInventory(true)
  }, [supportTypes])

  const submitInventory = useCallback(async () => {
    if (!invBaseId) return
    setInvSaving(true)
    try {
      await api.post('/base-container-stock/inventory', {
        base_id: invBaseId,
        lines: invLines.filter((l) => l.quantity >= 0),
      })
      setShowInventory(false)
      refetchStocks()
      refetchMovements()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur')
    } finally {
      setInvSaving(false)
    }
  }, [invBaseId, invLines, refetchStocks, refetchMovements])

  /* --- Ajustement (sortie) --- */
  const submitAdjust = useCallback(async () => {
    if (!adjBaseId || !adjSupportId || adjQty <= 0) return
    setAdjSaving(true)
    try {
      await api.post('/base-container-stock/adjust', {
        base_id: adjBaseId,
        support_type_id: adjSupportId,
        quantity: adjQty,
        movement_type: adjType,
        reference: adjRef || null,
        notes: adjNotes || null,
      })
      setShowAdjust(false)
      setAdjQty(0)
      setAdjRef('')
      setAdjNotes('')
      refetchStocks()
      refetchMovements()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Erreur')
    } finally {
      setAdjSaving(false)
    }
  }, [adjBaseId, adjSupportId, adjQty, adjType, adjRef, adjNotes, refetchStocks, refetchMovements])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'stock', label: 'Stock actuel' },
    { key: 'movements', label: 'Mouvements' },
  ]

  /* Colonnes stock */
  const stockColumns: Column<BaseStockDetail>[] = [
    {
      key: 'base_code', label: 'Base', width: '240px', filterable: true,
      render: (row) => `${row.base_code} — ${row.base_name}`,
      filterValue: (row) => `${row.base_code} ${row.base_name}`,
    },
    {
      key: 'support_type_code', label: 'Type support', width: '220px', filterable: true,
      render: (row) => `${row.support_type_code} — ${row.support_type_name}`,
      filterValue: (row) => `${row.support_type_code} ${row.support_type_name}`,
    },
    {
      key: 'unit_label' as keyof BaseStockDetail, label: 'Unite', width: '140px',
      render: (row) => row.unit_label || `x${row.unit_quantity}`,
    },
    { key: 'current_stock', label: 'Stock', width: '100px' },
    {
      key: 'last_updated_at', label: 'Derniere MAJ', width: '180px',
      render: (row) => row.last_updated_at
        ? new Date(row.last_updated_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
        : '—',
    },
  ]

  /* Colonnes mouvements */
  const movementColumns: Column<BaseMovementRecord>[] = [
    {
      key: 'timestamp', label: 'Date', width: '180px',
      render: (row) => new Date(row.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
    },
    {
      key: 'base_name', label: 'Base', width: '200px', filterable: true,
    },
    {
      key: 'support_type_code', label: 'Type support', width: '200px', filterable: true,
      render: (row) => `${row.support_type_code} — ${row.support_type_name}`,
    },
    {
      key: 'movement_type', label: 'Type mouvement', width: '180px',
      render: (row) => {
        const label = MVT_LABELS[row.movement_type] || row.movement_type
        const color = row.quantity > 0 ? '#22c55e' : '#ef4444'
        return <span style={{ color }}>{label}</span>
      },
    },
    {
      key: 'quantity', label: 'Quantite', width: '100px',
      render: (row) => {
        const color = row.quantity > 0 ? '#22c55e' : '#ef4444'
        return <span style={{ color, fontWeight: 600 }}>{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</span>
      },
    },
    {
      key: 'reference', label: 'Reference', width: '180px',
      render: (row) => row.reference || '—',
    },
    {
      key: 'notes', label: 'Notes', width: '150px',
      render: (row) => row.notes || '—',
    },
  ]

  const selectStyle = {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-color)',
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-color)',
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Stock contenants base
        </h1>
        <div className="flex gap-2">
          <button
            onClick={openInventory}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Inventaire physique
          </button>
          <button
            onClick={() => {
              if (!baseFilter) { alert('Selectionnez une base dans le filtre pour exporter.'); return }
              window.open(`/api/base-container-stock/export?base_id=${baseFilter}`, '_blank')
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#22c55e' }}
          >
            Export biere (CSV)
          </button>
          <button
            onClick={() => { setAdjBaseId(''); setAdjSupportId(''); setAdjQty(0); setAdjRef(''); setAdjNotes(''); setShowAdjust(true) }}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#ef4444' }}
          >
            Sortie stock
          </button>
        </div>
      </div>

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
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Base :</label>
        <select value={baseFilter} onChange={(e) => setBaseFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border" style={selectStyle}>
          <option value="">Toutes</option>
          {uniqueBases.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
        </select>
        <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Type support :</label>
        <select value={supportFilter} onChange={(e) => setSupportFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border" style={selectStyle}>
          <option value="">Tous</option>
          {uniqueSupports.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
      </div>

      {/* Tab content */}
      {tab === 'stock' && (
        <DataTable<BaseStockDetail>
          columns={stockColumns}
          data={filteredStocks}
          loading={loadingStocks}
          searchable
          searchKeys={['base_code', 'base_name'] as (keyof BaseStockDetail)[]}
        />
      )}

      {tab === 'movements' && (
        <DataTable<BaseMovementRecord>
          columns={movementColumns}
          data={filteredMovements}
          loading={loadingMovements}
          searchable
          searchKeys={['base_name', 'reference'] as (keyof BaseMovementRecord)[]}
        />
      )}

      {/* --- Dialog Inventaire --- */}
      {showInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Inventaire physique base</h2>

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Base :</label>
            <select value={String(invBaseId)} onChange={(e) => setInvBaseId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-4" style={selectStyle}>
              <option value="">-- Choisir --</option>
              {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>

            {invBaseId && (
              <div className="space-y-2 mb-4">
                {invLines.map((line, idx) => {
                  const st = supportTypes.find((s) => s.id === line.support_type_id)
                  return (
                    <div key={line.support_type_id} className="flex items-center gap-3">
                      <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                        {st ? `${st.code} — ${st.name}` : `#${line.support_type_id}`}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={line.quantity}
                        onChange={(e) => {
                          const copy = [...invLines]
                          copy[idx] = { ...copy[idx], quantity: parseInt(e.target.value) || 0 }
                          setInvLines(copy)
                        }}
                        className="w-24 px-3 py-1.5 rounded-lg text-sm border text-right"
                        style={inputStyle}
                      />
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInventory(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button onClick={submitInventory} disabled={!invBaseId || invSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                {invSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Dialog Ajustement (sortie) --- */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl shadow-2xl p-6 w-full max-w-md" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Sortie stock base</h2>

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Type :</label>
            <select value={adjType} onChange={(e) => setAdjType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-3" style={selectStyle}>
              <option value="DELIVERY_PREP">Sortie preparation livraison</option>
              <option value="SUPPLIER_RETURN">Retour fournisseur</option>
            </select>

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Base :</label>
            <select value={String(adjBaseId)} onChange={(e) => setAdjBaseId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-3" style={selectStyle}>
              <option value="">-- Choisir --</option>
              {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Type support :</label>
            <select value={String(adjSupportId)} onChange={(e) => setAdjSupportId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-3" style={selectStyle}>
              <option value="">-- Choisir --</option>
              {supportTypes.filter((st) => st.is_active).map((st) => (
                <option key={st.id} value={st.id}>{st.code} — {st.name}</option>
              ))}
            </select>

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Quantite (unites) :</label>
            <input type="number" min={1} value={adjQty} onChange={(e) => setAdjQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-3" style={inputStyle} />

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Reference :</label>
            <input type="text" value={adjRef} onChange={(e) => setAdjRef(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-3" style={inputStyle}
              placeholder="Bon de livraison, etc." />

            <label className="text-sm block mb-1" style={{ color: 'var(--text-secondary)' }}>Notes :</label>
            <textarea value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border mb-4" style={inputStyle} rows={2} />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdjust(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>
                Annuler
              </button>
              <button onClick={submitAdjust} disabled={!adjBaseId || !adjSupportId || adjQty <= 0 || adjSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#ef4444' }}>
                {adjSaving ? 'Enregistrement...' : 'Confirmer sortie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
