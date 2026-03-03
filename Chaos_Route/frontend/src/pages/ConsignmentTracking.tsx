/* Suivi des consignes Zèbre / Zèbre consignment tracking — 3 onglets */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import type {
  ConsignmentMovement,
  ConsignmentBalance,
  ConsignmentImportResult,
  ConsignmentImportInfo,
  ConsignmentFilters,
} from '../types'

type TabKey = 'import' | 'movements' | 'balances'

export default function ConsignmentTracking() {
  const [tab, setTab] = useState<TabKey>('import')

  /* Filtres partagés / Shared filter state */
  const [pdvSearch, setPdvSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [baseFilter, setBaseFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [codeFilter, setCodeFilter] = useState('')
  const [fluxFilter, setFluxFilter] = useState('')

  /* Dropdown options */
  const [filters, setFilters] = useState<ConsignmentFilters | null>(null)

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'import', label: 'Import' },
    { key: 'movements', label: 'Mouvements' },
    { key: 'balances', label: 'Soldes' },
  ]

  useEffect(() => {
    api.get<ConsignmentFilters>('/consignments/filters/').then((r) => setFilters(r.data)).catch(() => {})
  }, [])

  /* Drill-down : depuis Soldes → Mouvements avec filtre PDV */
  const drillDown = (pdvCode: string) => {
    setPdvSearch(pdvCode)
    setTab('movements')
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
        Suivi consignes
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

      {tab === 'import' && <ImportTab />}
      {tab === 'movements' && (
        <MovementsTab
          filters={filters}
          pdvSearch={pdvSearch} setPdvSearch={setPdvSearch}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          baseFilter={baseFilter} setBaseFilter={setBaseFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          codeFilter={codeFilter} setCodeFilter={setCodeFilter}
          fluxFilter={fluxFilter} setFluxFilter={setFluxFilter}
        />
      )}
      {tab === 'balances' && (
        <BalancesTab
          filters={filters}
          pdvSearch={pdvSearch} setPdvSearch={setPdvSearch}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          baseFilter={baseFilter} setBaseFilter={setBaseFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          codeFilter={codeFilter} setCodeFilter={setCodeFilter}
          onDrillDown={drillDown}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Onglet IMPORT
   ═══════════════════════════════════════════════════════════════ */

function ImportTab() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConsignmentImportResult | null>(null)
  const [info, setInfo] = useState<ConsignmentImportInfo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ConsignmentImportInfo>('/consignments/import-info/').then((r) => setInfo(r.data)).catch(() => {})
  }, [])

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<ConsignmentImportResult>(
        `/consignments/import/?mode=${mode}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
      )
      setResult(data)
      // Rafraîchir info import / Refresh import info
      api.get<ConsignmentImportInfo>('/consignments/import-info/').then((r) => setInfo(r.data)).catch(() => {})
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur lors de l\'import')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Dernier import / Last import info */}
      {info && info.batch_id && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Dernier import</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Batch : {info.batch_id} | {info.total_rows.toLocaleString()} lignes
            {info.imported_at && ` | ${info.imported_at}`}
          </p>
        </div>
      )}

      {/* Zone upload / Upload area */}
      <div className="p-6 rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Fichier XLSX Zèbre
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm rounded-lg border p-2"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="radio" name="mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                Remplacer tout
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input type="radio" name="mode" value="append" checked={mode === 'append'} onChange={() => setMode('append')} />
                Ajouter
              </label>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {loading ? 'Import en cours...' : 'Importer'}
          </button>
        </div>
      </div>

      {/* Résultat import / Import result */}
      {result && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Résultat</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total lignes : </span>
              <span style={{ color: 'var(--text-primary)' }}>{result.total_rows.toLocaleString()}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Créées : </span>
              <span style={{ color: '#22c55e' }}>{result.created.toLocaleString()}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Ignorées : </span>
              <span style={{ color: '#f59e0b' }}>{result.skipped.toLocaleString()}</span>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium mb-1" style={{ color: '#ef4444' }}>Erreurs :</p>
              <ul className="text-xs space-y-0.5" style={{ color: '#ef4444' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          {error}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Barre de filtres partagée / Shared filter bar
   ═══════════════════════════════════════════════════════════════ */

interface FilterBarProps {
  filters: ConsignmentFilters | null
  pdvSearch: string; setPdvSearch: (v: string) => void
  dateFrom: string; setDateFrom: (v: string) => void
  dateTo: string; setDateTo: (v: string) => void
  baseFilter: string; setBaseFilter: (v: string) => void
  typeFilter: string; setTypeFilter: (v: string) => void
  codeFilter: string; setCodeFilter: (v: string) => void
  fluxFilter?: string; setFluxFilter?: (v: string) => void
  onApply: () => void
}

function FilterBar({
  filters, pdvSearch, setPdvSearch, dateFrom, setDateFrom, dateTo, setDateTo,
  baseFilter, setBaseFilter, typeFilter, setTypeFilter, codeFilter, setCodeFilter,
  fluxFilter, setFluxFilter, onApply,
}: FilterBarProps) {
  const inputStyle = {
    backgroundColor: 'var(--bg-primary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4 items-end">
      <div>
        <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>PDV</label>
        <input
          type="text" value={pdvSearch} onChange={(e) => setPdvSearch(e.target.value)}
          placeholder="Code ou nom..."
          className="border rounded px-2 py-1 text-sm w-36"
          style={inputStyle}
          onKeyDown={(e) => e.key === 'Enter' && onApply()}
        />
      </div>
      <div>
        <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Du</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="border rounded px-2 py-1 text-sm" style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Au</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="border rounded px-2 py-1 text-sm" style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Base</label>
        <select value={baseFilter} onChange={(e) => setBaseFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm" style={inputStyle}>
          <option value="">Toutes</option>
          {filters?.bases.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Type consigne</label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm" style={inputStyle}>
          <option value="">Tous</option>
          {filters?.consignment_types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Code consigne</label>
        <select value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm" style={inputStyle}>
          <option value="">Tous</option>
          {filters?.consignment_codes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {setFluxFilter && (
        <div>
          <label className="block text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Flux</label>
          <select value={fluxFilter || ''} onChange={(e) => setFluxFilter(e.target.value)}
            className="border rounded px-2 py-1 text-sm" style={inputStyle}>
            <option value="">Tous</option>
            {filters?.flux_types.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}
      <button
        onClick={onApply}
        className="px-4 py-1 rounded text-sm font-medium text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Filtrer
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Onglet MOUVEMENTS
   ═══════════════════════════════════════════════════════════════ */

interface MovementsTabProps {
  filters: ConsignmentFilters | null
  pdvSearch: string; setPdvSearch: (v: string) => void
  dateFrom: string; setDateFrom: (v: string) => void
  dateTo: string; setDateTo: (v: string) => void
  baseFilter: string; setBaseFilter: (v: string) => void
  typeFilter: string; setTypeFilter: (v: string) => void
  codeFilter: string; setCodeFilter: (v: string) => void
  fluxFilter: string; setFluxFilter: (v: string) => void
}

function MovementsTab({
  filters: filterOptions, pdvSearch, setPdvSearch, dateFrom, setDateFrom, dateTo, setDateTo,
  baseFilter, setBaseFilter, typeFilter, setTypeFilter, codeFilter, setCodeFilter,
  fluxFilter, setFluxFilter,
}: MovementsTabProps) {
  const [data, setData] = useState<ConsignmentMovement[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const limit = 100

  const buildParams = useCallback(() => {
    const p: Record<string, string | number> = { limit, offset }
    if (pdvSearch) p.pdv_search = pdvSearch
    if (dateFrom) p.date_from = dateFrom
    if (dateTo) p.date_to = dateTo
    if (baseFilter) p.base = baseFilter
    if (typeFilter) p.consignment_type = typeFilter
    if (codeFilter) p.consignment_code = codeFilter
    if (fluxFilter) p.flux_type = fluxFilter
    return p
  }, [pdvSearch, dateFrom, dateTo, baseFilter, typeFilter, codeFilter, fluxFilter, offset])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const p = buildParams()
      const [movRes, cntRes] = await Promise.all([
        api.get<ConsignmentMovement[]>('/consignments/', { params: p }),
        api.get<{ count: number }>('/consignments/count/', { params: { ...p, limit: undefined, offset: undefined } }),
      ])
      setData(movRes.data)
      setTotal(cntRes.data.count)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchData() }, [fetchData])

  const handleApply = () => { setOffset(0); fetchData() }

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <FilterBar
        filters={filterOptions}
        pdvSearch={pdvSearch} setPdvSearch={setPdvSearch}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        baseFilter={baseFilter} setBaseFilter={setBaseFilter}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        codeFilter={codeFilter} setCodeFilter={setCodeFilter}
        fluxFilter={fluxFilter} setFluxFilter={setFluxFilter}
        onApply={handleApply}
      />

      {/* Info + pagination header */}
      <div className="flex justify-between items-center mb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <span>{total.toLocaleString()} mouvements</span>
        <div className="flex items-center gap-2">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}
            className="px-2 py-0.5 rounded border text-xs disabled:opacity-30"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            Précédent
          </button>
          <span className="text-xs">{page} / {totalPages || 1}</span>
          <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}
            className="px-2 py-0.5 rounded border text-xs disabled:opacity-30"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            Suivant
          </button>
        </div>
      </div>

      {/* Tableau / Table */}
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              {['Date', 'PDV', 'Base', 'N° Bordereau', 'Code', 'Libellé', 'Type', 'Qté', 'Valeur', 'Flux'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Aucun mouvement</td></tr>
            ) : data.map((m) => (
              <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{m.flux_date}</td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>
                  <span className="font-medium">{m.pdv_code}</span>
                  {m.pdv_name && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>{m.pdv_name}</span>}
                </td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{m.base}</td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{m.waybill_number || ''}</td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{m.consignment_code}</td>
                <td className="px-3 py-1.5 max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>{m.consignment_label || ''}</td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{m.consignment_type || ''}</td>
                <td className="px-3 py-1.5 font-medium" style={{ color: m.quantity > 0 ? '#22c55e' : m.quantity < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                  {m.quantity}
                </td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {m.value != null ? m.value.toFixed(2) : ''}
                </td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{m.flux_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Onglet SOLDES
   ═══════════════════════════════════════════════════════════════ */

interface BalancesTabProps {
  filters: ConsignmentFilters | null
  pdvSearch: string; setPdvSearch: (v: string) => void
  dateFrom: string; setDateFrom: (v: string) => void
  dateTo: string; setDateTo: (v: string) => void
  baseFilter: string; setBaseFilter: (v: string) => void
  typeFilter: string; setTypeFilter: (v: string) => void
  codeFilter: string; setCodeFilter: (v: string) => void
  onDrillDown: (pdvCode: string) => void
}

function BalancesTab({
  filters: filterOptions, pdvSearch, setPdvSearch, dateFrom, setDateFrom, dateTo, setDateTo,
  baseFilter, setBaseFilter, typeFilter, setTypeFilter, codeFilter, setCodeFilter,
  onDrillDown,
}: BalancesTabProps) {
  const [data, setData] = useState<ConsignmentBalance[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBalances = useCallback(async () => {
    setLoading(true)
    try {
      const p: Record<string, string> = {}
      if (pdvSearch) p.pdv_search = pdvSearch
      if (dateFrom) p.date_from = dateFrom
      if (dateTo) p.date_to = dateTo
      if (baseFilter) p.base = baseFilter
      if (typeFilter) p.consignment_type = typeFilter
      if (codeFilter) p.consignment_code = codeFilter
      const { data: balances } = await api.get<ConsignmentBalance[]>('/consignments/balances/', { params: p })
      setData(balances)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [pdvSearch, dateFrom, dateTo, baseFilter, typeFilter, codeFilter])

  useEffect(() => { fetchBalances() }, [fetchBalances])

  const handleApply = () => fetchBalances()

  return (
    <div>
      <FilterBar
        filters={filterOptions}
        pdvSearch={pdvSearch} setPdvSearch={setPdvSearch}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        baseFilter={baseFilter} setBaseFilter={setBaseFilter}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        codeFilter={codeFilter} setCodeFilter={setCodeFilter}
        onApply={handleApply}
      />

      <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{data.length} soldes</p>

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
              {['PDV Code', 'PDV Nom', 'Code Consigne', 'Libellé', 'Solde Total', 'Valeur Totale'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Chargement...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Aucun solde</td></tr>
            ) : data.map((b, i) => (
              <tr
                key={`${b.pdv_code}-${b.consignment_code}-${i}`}
                className="border-t cursor-pointer hover:opacity-80"
                style={{ borderColor: 'var(--border-color)' }}
                onClick={() => onDrillDown(b.pdv_code)}
                title="Cliquer pour voir les mouvements"
              >
                <td className="px-3 py-1.5 font-medium" style={{ color: 'var(--color-primary)' }}>{b.pdv_code}</td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{b.pdv_name || ''}</td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-primary)' }}>{b.consignment_code}</td>
                <td className="px-3 py-1.5 max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }}>{b.consignment_label || ''}</td>
                <td className="px-3 py-1.5 font-medium" style={{ color: b.total_quantity > 0 ? '#22c55e' : b.total_quantity < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                  {b.total_quantity}
                </td>
                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {b.total_value != null ? b.total_value.toFixed(2) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
