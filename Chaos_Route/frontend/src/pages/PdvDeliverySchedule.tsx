/* Planning livraisons PDV / PDV delivery schedule page */

import { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useApi } from '../hooks/useApi'
import { useAppStore } from '../stores/useAppStore'
import type { PdvDeliveryEntry, BaseLogistics, PDV } from '../types'
import type { Column } from '../components/data/DataTable'
import { DataTable } from '../components/data/DataTable'

/* Formater une date ISO en YYYY-MM-DD / Format date to YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/* Couleurs badges température / Temperature badge colors */
const tempColors: Record<string, { bg: string; text: string }> = {
  SEC: { bg: '#92400e20', text: '#d97706' },
  FRAIS: { bg: '#1e40af20', text: '#3b82f6' },
  GEL: { bg: '#6b21a820', text: '#a855f7' },
}

/* Couleurs statut tour / Tour status colors */
const statusColors: Record<string, string> = {
  VALIDATED: 'var(--color-primary)',
  IN_PROGRESS: 'var(--color-warning)',
  RETURNING: 'var(--color-info, #3b82f6)',
  COMPLETED: 'var(--color-success)',
}

export default function PdvDeliverySchedule() {
  const { selectedRegionId } = useAppStore()

  /* Dates par défaut : aujourd'hui → +7j / Default: today → +7 days */
  const [dateFrom, setDateFrom] = useState(() => toDateStr(new Date()))
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return toDateStr(d)
  })
  const [baseId, setBaseId] = useState<number | ''>('')
  const [pdvId, setPdvId] = useState<number | ''>('')
  const [pdvSearch, setPdvSearch] = useState('')

  /* Charger bases et PDVs pour les selects / Load bases and PDVs for selects */
  const baseParams = selectedRegionId ? { region_id: selectedRegionId } : undefined
  const { data: bases } = useApi<BaseLogistics>('/bases', baseParams)
  const { data: pdvs } = useApi<PDV>('/pdvs', baseParams)

  /* Charger le planning / Load delivery schedule */
  const scheduleParams = useMemo(() => {
    const p: Record<string, unknown> = { date_from: dateFrom, date_to: dateTo }
    if (baseId) p.base_id = baseId
    if (pdvId) p.pdv_id = pdvId
    return p
  }, [dateFrom, dateTo, baseId, pdvId])

  const { data, loading } = useApi<PdvDeliveryEntry>('/pdvs/delivery-schedule', scheduleParams)

  /* Enrichir data avec un id synthétique pour DataTable / Add synthetic id for DataTable */
  const tableData = useMemo(
    () => data.map((entry, idx) => ({ ...entry, id: idx + 1 })),
    [data],
  )

  /* PDVs filtrés pour le select / Filtered PDVs for select */
  const filteredPdvs = useMemo(() => {
    if (!pdvSearch) return pdvs.slice(0, 50)
    const q = pdvSearch.toLowerCase()
    return pdvs.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    ).slice(0, 50)
  }, [pdvs, pdvSearch])

  /* Total EQC / EQC total */
  const totalEqp = useMemo(() => data.reduce((sum, e) => sum + e.eqp_count, 0), [data])

  /* Export Excel / Export to Excel */
  const handleExport = useCallback(() => {
    if (!data.length) return
    const rows = data.map((e) => ({
      'Code PDV': e.pdv_code,
      'PDV': e.pdv_name,
      'Date livraison': e.delivery_date,
      'Tour': e.tour_code,
      'Départ base': e.departure_time,
      'Arrivée': e.arrival_time,
      'Température': e.temperature_classes.join(', '),
      'EQC': e.eqp_count,
      'Statut': e.tour_status,
      'Base': e.base_code,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 6 },
      { wch: 12 }, { wch: 10 },
    ]
    /* Figer la première ligne + autofiltre / Freeze header + autofilter */
    ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    if (rows.length > 0) {
      const colCount = Object.keys(rows[0]).length
      ws['!autofilter'] = { ref: `A1:${String.fromCharCode(64 + colCount)}${rows.length + 1}` }
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Planning livraisons')

    const pdvEntry = pdvId ? data.find((e) => e.pdv_id === pdvId) : null
    const filename = pdvEntry
      ? `planning_livraisons_${pdvEntry.pdv_code}_${dateFrom}_${dateTo}.xlsx`
      : `planning_livraisons_${dateFrom}_${dateTo}.xlsx`
    XLSX.writeFile(wb, filename)
  }, [data, dateFrom, dateTo, pdvId])

  /* Colonnes du tableau / Table columns */
  const columns: Column<PdvDeliveryEntry & { id: number }>[] = useMemo(() => [
    { key: 'pdv_code', label: 'Code PDV', width: '90px', filterable: true },
    { key: 'pdv_name', label: 'PDV', width: '200px', filterable: true },
    { key: 'delivery_date', label: 'Date livr.', width: '110px', filterable: true },
    {
      key: 'tour_code', label: 'Tour', width: '120px', filterable: true,
      render: (row) => (
        <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{row.tour_code}</span>
      ),
    },
    { key: 'departure_time', label: 'Départ base', width: '100px' },
    { key: 'arrival_time', label: 'Arrivée', width: '90px' },
    {
      key: 'temperature_classes' as keyof (PdvDeliveryEntry & { id: number }),
      label: 'Temp.',
      width: '130px',
      render: (row) => (
        <div className="flex gap-1 flex-wrap">
          {row.temperature_classes.map((tc) => (
            <span
              key={tc}
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: tempColors[tc]?.bg || '#33333320',
                color: tempColors[tc]?.text || 'var(--text-secondary)',
              }}
            >
              {tc}
            </span>
          ))}
        </div>
      ),
      filterValue: (row) => row.temperature_classes.join(' '),
    },
    { key: 'eqp_count', label: 'EQC', width: '70px' },
    {
      key: 'tour_status', label: 'Statut', width: '110px', filterable: true,
      render: (row) => (
        <span
          className="px-2 py-0.5 rounded text-xs font-medium"
          style={{ color: statusColors[row.tour_status] || 'var(--text-secondary)' }}
        >
          {row.tour_status}
        </span>
      ),
    },
  ], [])

  return (
    <div>
      {/* En-tête / Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Planning livraisons PDV
        </h2>
        <button
          onClick={handleExport}
          disabled={!data.length}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
        >
          Exporter Excel
        </button>
      </div>

      {/* Barre de filtres / Filter bar */}
      <div
        className="flex flex-wrap gap-3 items-end mb-4 p-3 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
      >
        {/* Date de */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date de</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 rounded text-sm"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
          />
        </div>
        {/* Date à */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date à</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 rounded text-sm"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
          />
        </div>
        {/* Base */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Base</label>
          <select
            value={baseId}
            onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : '')}
            className="px-2 py-1.5 rounded text-sm min-w-[150px]"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            <option value="">Toutes les bases</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
            ))}
          </select>
        </div>
        {/* PDV avec recherche */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>PDV</label>
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="Rechercher PDV..."
              value={pdvSearch}
              onChange={(e) => {
                setPdvSearch(e.target.value)
                if (!e.target.value) setPdvId('')
              }}
              className="px-2 py-1.5 rounded text-sm w-[140px]"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            />
            <select
              value={pdvId}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : ''
                setPdvId(v)
                if (v) {
                  const p = pdvs.find((x) => x.id === v)
                  if (p) setPdvSearch(p.code)
                }
              }}
              className="px-2 py-1.5 rounded text-sm min-w-[180px]"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <option value="">Tous les PDV</option>
              {filteredPdvs.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Compteur résultats */}
        <div className="ml-auto text-sm" style={{ color: 'var(--text-muted)' }}>
          {data.length} livraison{data.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tableau / Table */}
      <DataTable
        columns={columns}
        data={tableData}
        loading={loading}
        searchable={true}
        searchKeys={['pdv_code', 'pdv_name', 'tour_code']}
      />

      {/* Pied de tableau totaux / Footer totals */}
      {data.length > 0 && (
        <div
          className="flex gap-6 items-center px-4 py-2 mt-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Total : {data.length} livraison{data.length !== 1 ? 's' : ''}
          </span>
          <span style={{ color: 'var(--color-primary)' }}>
            EQC : {totalEqp}
          </span>
        </div>
      )}
    </div>
  )
}
