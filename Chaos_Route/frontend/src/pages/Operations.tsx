/* Page Exploitant v2 — Vue split tableau/Gantt / Warehouse Operations page v2 — Split table/Gantt view */

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import type { Tour, BaseLogistics, Contract, PDV } from '../types'
import { TourWaybill } from '../components/tour/TourWaybill'
import { DriverRouteSheet } from '../components/tour/DriverRouteSheet'
import { TourGantt } from '../components/operations/TourGantt'
import { computeTourDelay, detectSecondTourImpacts, DELAY_COLORS } from '../utils/tourDelay'
import type { TourWithDelay, TourImpact } from '../utils/tourDelay'
import { parseTime } from '../utils/tourTimeUtils'
import { useAppStore } from '../stores/useAppStore'

const REFRESH_INTERVAL = 30_000
const PREFS_KEY = 'ops-prefs'

/* --- Préférences persistées / Persisted preferences --- */

interface OpsPrefs {
  hiddenCols: string[]
  colWidths: Record<string, number>
  splitPct: number
}

function loadPrefs(): OpsPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { hiddenCols: [], colWidths: {}, splitPct: 60 }
}

function savePrefs(p: OpsPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p))
}

/* --- Définition des colonnes / Column definitions --- */

interface OpsCol {
  key: string
  label: string
  defaultWidth: number
  align?: 'center'
}

const ALL_COLUMNS: OpsCol[] = [
  { key: 'code', label: 'common.code', defaultWidth: 90 },
  { key: 'vehicle', label: 'operations.vehicle', defaultWidth: 130 },
  { key: 'driver', label: 'operations.driverName', defaultWidth: 110 },
  { key: 'departure', label: 'operations.dep', defaultWidth: 60, align: 'center' },
  { key: 'stops', label: 'tourPlanning.stops', defaultWidth: 55, align: 'center' },
  { key: 'eqc', label: 'EQC', defaultWidth: 55, align: 'center' },
  { key: 'delay', label: 'operations.delay', defaultWidth: 75, align: 'center' },
  { key: 'exit', label: 'operations.barrierExit', defaultWidth: 60, align: 'center' },
]

/* ═══════════════════════════════════════════ */

export default function Operations() {
  const { t } = useTranslation()
  const { isFullscreen, toggleFullscreen } = useAppStore()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [baseId, setBaseId] = useState<number | ''>('')
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [pdvs, setPdvs] = useState<PDV[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [waybillTourId, setWaybillTourId] = useState<number | null>(null)
  const [routeSheetTourId, setRouteSheetTourId] = useState<number | null>(null)
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Préférences colonnes et split / Column & split preferences */
  const [prefs, setPrefs] = useState<OpsPrefs>(loadPrefs)
  const hiddenCols = useMemo(() => new Set(prefs.hiddenCols), [prefs.hiddenCols])
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const [measuredRowHeights, setMeasuredRowHeights] = useState<number[]>([])
  const [measuredTheadHeight, setMeasuredTheadHeight] = useState(26)

  const updatePrefs = useCallback((patch: Partial<OpsPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }, [])

  const visibleCols = useMemo(
    () => ALL_COLUMNS.filter((c) => !hiddenCols.has(c.key)),
    [hiddenCols],
  )

  const getColWidth = (col: OpsCol) => prefs.colWidths[col.key] ?? col.defaultWidth

  /* Fermer menu colonnes si clic en dehors / Close column menu on outside click */
  useEffect(() => {
    if (!showColMenu) return
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColMenu])

  /* Redimensionnement colonnes / Column resize */
  const resizingCol = useRef<string | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  const handleColResize = useCallback((e: React.MouseEvent, colKey: string, thEl: HTMLTableCellElement) => {
    e.preventDefault()
    e.stopPropagation()
    resizingCol.current = colKey
    resizeStartX.current = e.clientX
    resizeStartW.current = thEl.offsetWidth

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(40, resizeStartW.current + ev.clientX - resizeStartX.current)
      setPrefs((prev) => {
        const next = { ...prev, colWidths: { ...prev.colWidths, [colKey]: w } }
        savePrefs(next)
        return next
      })
    }
    const onUp = () => {
      resizingCol.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  /* Redimensionnement split / Split resize */
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const handleSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = splitContainerRef.current
    if (!container) return

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const pct = Math.max(30, Math.min(80, ((ev.clientX - rect.left) / rect.width) * 100))
      updatePrefs({ splitPct: Math.round(pct) })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [updatePrefs])

  /* Toggle colonne / Toggle column visibility */
  const toggleCol = (key: string) => {
    const next = new Set(prefs.hiddenCols)
    if (next.has(key)) {
      next.delete(key)
    } else {
      if (ALL_COLUMNS.length - next.size <= 2) return
      next.add(key)
    }
    updatePrefs({ hiddenCols: [...next] })
  }

  /* Formulaires locaux / Local form state per tour */
  const [forms, setForms] = useState<Record<number, {
    driver_name: string
    driver_arrival_time: string
    loading_end_time: string
    total_weight_kg: string
    remarks: string
  }>>({})

  /* Charger référentiels / Load reference data */
  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data))
    api.get('/contracts/').then((r) => setContracts(r.data))
    api.get('/pdvs/').then((r) => setPdvs(r.data))
  }, [])

  const contractMap = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts])
  const pdvMap = useMemo(() => new Map(pdvs.map((p) => [p.id, p])), [pdvs])

  /* Charger tours / Load tours */
  const loadTours = useCallback(async (silent = false) => {
    if (!baseId) { setTours([]); return }
    if (!silent) setLoading(true)
    try {
      const params: Record<string, unknown> = { date, base_id: baseId }
      const { data } = await api.get<Tour[]>('/tours/', { params })
      const scheduled = data.filter((t) => t.departure_time)
      setTours(scheduled)
      setForms((prev) => {
        const next: typeof prev = {}
        for (const tour of scheduled) {
          next[tour.id] = prev[tour.id] ?? {
            driver_name: tour.driver_name ?? '',
            driver_arrival_time: tour.driver_arrival_time ?? '',
            loading_end_time: tour.loading_end_time ?? '',
            total_weight_kg: tour.total_weight_kg != null ? String(tour.total_weight_kg) : '',
            remarks: tour.remarks ?? '',
          }
        }
        return next
      })
      const now = new Date()
      setLastRefresh(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`)
    } catch (e) {
      console.error('Failed to load tours', e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [date, baseId])

  useEffect(() => { loadTours() }, [loadTours])

  /* Auto-refresh */
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    if (!baseId) return
    refreshTimer.current = setInterval(() => loadTours(true), REFRESH_INTERVAL)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [baseId, loadTours])

  /* Calcul retards / Delay computation */
  const toursWithDelay: TourWithDelay[] = useMemo(
    () => tours.map(computeTourDelay).sort((a, b) => parseTime(a.departure_time || '99:99') - parseTime(b.departure_time || '99:99')),
    [tours],
  )

  const impacts: TourImpact[] = useMemo(
    () => detectSecondTourImpacts(toursWithDelay),
    [toursWithDelay],
  )

  /* Formulaire helpers */
  const updateForm = (tourId: number, field: string, value: string) => {
    setForms((prev) => ({ ...prev, [tourId]: { ...prev[tourId], [field]: value } }))
  }

  const handleSave = async (tourId: number) => {
    setSaving(tourId)
    try {
      const f = forms[tourId]
      await api.put(`/tours/${tourId}/operations`, {
        ...f,
        total_weight_kg: f.total_weight_kg ? parseFloat(f.total_weight_kg) : null,
      })
      await loadTours()
    } catch (e) {
      console.error('Failed to save operations', e)
    } finally {
      setSaving(null)
    }
  }

  const getTourEqp = (tour: Tour) => tour.total_eqp ?? tour.stops.reduce((s, st) => s + st.eqp_count, 0)
  const toggleExpand = (id: number) => setExpandedId((prev) => (prev === id ? null : id))

  const nowFormatted = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const colCount = visibleCols.length

  /* Mesurer les hauteurs de lignes pour aligner le Gantt / Measure row heights for Gantt alignment */
  useLayoutEffect(() => {
    const table = tableRef.current
    if (!table) return
    const thead = table.querySelector('thead')
    if (thead) setMeasuredTheadHeight(thead.getBoundingClientRect().height)
    const tbodies = table.querySelectorAll<HTMLElement>('tbody[data-tour-id]')
    const heights: number[] = []
    tbodies.forEach((tb) => heights.push(tb.getBoundingClientRect().height))
    setMeasuredRowHeights(heights)
  }, [toursWithDelay, expandedId, visibleCols, prefs.colWidths])

  return (
    <div className="p-6">
      {waybillTourId && <TourWaybill tourId={waybillTourId} onClose={() => setWaybillTourId(null)} />}
      {routeSheetTourId && <DriverRouteSheet tourId={routeSheetTourId} onClose={() => setRouteSheetTourId(null)} />}

      {/* En-tête / Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('operations.title')}
        </h1>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              {t('operations.autoRefresh')} &middot; {lastRefresh}
            </span>
          )}
          {/* Menu colonnes / Column menu */}
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu((v) => !v)}
              className="px-3 py-2 rounded-lg border text-sm transition-all hover:opacity-80"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
              title={t('common.columns')}
            >
              &#8801; {t('common.columns')}
            </button>
            {showColMenu && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[180px]"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                {ALL_COLUMNS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm hover:opacity-80" style={{ color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleCol(col.key)} className="accent-orange-500" />
                    {col.label === 'EQC' ? 'EQC' : t(col.label)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            className="px-3 py-2 rounded-lg border text-sm transition-all hover:opacity-80"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            onClick={toggleFullscreen}
            title={isFullscreen ? t('tourPlanning.exitFullscreen') : t('tourPlanning.enterFullscreen')}
          >
            {isFullscreen ? '\u229F' : '\u229E'}
          </button>
        </div>
      </div>

      {/* Filtres / Filters */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('common.date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('operations.base')}</label>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : '')} className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            <option value="">{t('operations.selectBase')}</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Alertes impact 2e tour / Second tour impact alerts */}
      {impacts.map((imp, i) => (
        <div key={i} className="flex items-center gap-2 mb-3 px-4 py-2 rounded-lg border text-sm font-semibold"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
          <span>&#9888;</span>
          <span>{t('operations.tour2Impact', {
            code1: imp.delayedTour.code, time1: imp.delayedTour.estimated_return,
            code2: imp.impactedTour.code, time2: imp.impactedTour.departure_time, overlap: imp.overlapMinutes,
          })}</span>
        </div>
      ))}

      {/* Contenu principal / Main content */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : tours.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{baseId ? t('operations.noTours') : t('operations.selectBaseHint')}</p>
      ) : (
        <div ref={splitContainerRef} className="flex" style={{ alignItems: 'flex-start' }}>
          {/* Panneau gauche — Tableau accordéon / Left panel */}
          <div className="min-w-0 overflow-hidden" style={{ width: `${prefs.splitPct}%` }}>
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
              <div className="overflow-x-auto">
                <table ref={tableRef} className="w-full" style={{ tableLayout: 'fixed', fontSize: '10px' }}>
                  <colgroup>
                    {visibleCols.map((col) => <col key={col.key} style={{ width: `${getColWidth(col)}px` }} />)}
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      {visibleCols.map((col) => (
                        <th
                          key={col.key}
                          className={`px-3 py-2 font-medium relative ${col.align === 'center' ? 'text-center' : 'text-left'}`}
                          style={{ color: 'var(--text-muted)', overflow: 'hidden' }}
                        >
                          {col.label === 'EQC' ? 'EQC' : t(col.label)}
                          {/* Poignée redimensionnement / Resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-orange-500/30 transition-colors"
                            onMouseDown={(e) => {
                              const th = e.currentTarget.parentElement as HTMLTableCellElement
                              handleColResize(e, col.key, th)
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {toursWithDelay.map((tour) => {
                    const contract = tour.contract_id ? contractMap.get(tour.contract_id) : null
                    const isExpanded = expandedId === tour.id
                    const form = forms[tour.id]
                    const color = DELAY_COLORS[tour.delay_level]

                    return (
                      <tbody key={tour.id} data-tour-id={tour.id}>
                        <TourRow
                          tour={tour} contract={contract ?? null} form={form}
                          isExpanded={isExpanded} color={color} pdvMap={pdvMap}
                          saving={saving === tour.id} eqc={getTourEqp(tour)}
                          visibleCols={visibleCols} colCount={colCount} t={t}
                          onToggle={() => toggleExpand(tour.id)}
                          onFormChange={(field, value) => updateForm(tour.id, field, value)}
                          onSave={() => handleSave(tour.id)}
                          onRouteSheet={() => setRouteSheetTourId(tour.id)}
                          onWaybill={() => setWaybillTourId(tour.id)}
                          onSetNow={(field) => updateForm(tour.id, field, nowFormatted())}
                        />
                      </tbody>
                    )
                  })}
                </table>
              </div>
            </div>
          </div>

          {/* Séparateur redimensionnable / Draggable split handle */}
          <div
            className="flex-shrink-0 cursor-col-resize flex items-center justify-center group"
            style={{ width: '12px' }}
            onMouseDown={handleSplitResize}
          >
            <div className="w-1 h-12 rounded-full transition-colors group-hover:bg-orange-500/50" style={{ backgroundColor: 'var(--border-color)' }} />
          </div>

          {/* Panneau droit — Gantt / Right panel */}
          <div className="min-w-[200px]" style={{ width: `${100 - prefs.splitPct}%` }}>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
              <TourGantt
                tours={toursWithDelay}
                activeTourId={expandedId}
                onTourClick={(id) => toggleExpand(id)}
                rowHeights={measuredRowHeights}
                headerHeight={measuredTheadHeight}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Composant ligne tour / Tour row component ─── */

interface TourRowProps {
  tour: TourWithDelay
  contract: Contract | null
  form: { driver_name: string; driver_arrival_time: string; loading_end_time: string; total_weight_kg: string; remarks: string } | undefined
  isExpanded: boolean
  color: string
  pdvMap: Map<number, PDV>
  saving: boolean
  eqc: number
  visibleCols: OpsCol[]
  colCount: number
  t: (key: string, opts?: Record<string, unknown>) => string
  onToggle: () => void
  onFormChange: (field: string, value: string) => void
  onSave: () => void
  onRouteSheet: () => void
  onWaybill: () => void
  onSetNow: (field: string) => void
}

function TourRow({
  tour, contract, form, isExpanded, color, pdvMap, saving, eqc,
  visibleCols, colCount, t,
  onToggle, onFormChange, onSave, onRouteSheet, onWaybill, onSetNow,
}: TourRowProps) {
  const vehicleLabel = contract?.vehicle_code
    ? `${contract.vehicle_code} — ${contract.vehicle_name ?? ''}`
    : (contract?.code ?? '—')

  /* Rendu cellule / Cell render */
  const cells: Record<string, React.ReactNode> = {
    code: (
      <span className="flex items-center gap-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isExpanded ? '▾' : '▸'}</span>
        <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{tour.code}</span>
      </span>
    ),
    vehicle: <span className="truncate" title={vehicleLabel}>{vehicleLabel}</span>,
    driver: <span className="truncate">{tour.driver_name || '—'}</span>,
    departure: <span className="font-mono text-xs">{tour.departure_time}</span>,
    stops: <>{tour.stops.length}</>,
    eqc: <>{eqc}</>,
    delay: <DelayBadge delay={tour.delay_minutes} color={color} t={t} />,
    exit: <span className="font-mono text-xs" style={{ color: tour.barrier_exit_time ? 'var(--text-primary)' : 'var(--text-muted)' }}>{tour.barrier_exit_time || '—'}</span>,
  }

  return (
    <>
      <tr
        className="border-t cursor-pointer transition-colors"
        style={{ borderColor: 'var(--border-color)', backgroundColor: isExpanded ? 'rgba(249,115,22,0.06)' : undefined }}
        onClick={onToggle}
        onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isExpanded ? 'rgba(249,115,22,0.06)' : 'transparent' }}
      >
        {visibleCols.map((col) => (
          <td key={col.key} className={`px-3 py-2 ${col.align === 'center' ? 'text-center' : ''}`} style={{ color: 'var(--text-primary)' }}>
            {cells[col.key]}
          </td>
        ))}
      </tr>

      {/* Détail déplié / Expanded detail */}
      {isExpanded && form && (
        <tr style={{ backgroundColor: 'rgba(249,115,22,0.03)' }}>
          <td colSpan={colCount} className="px-3 py-3">
            {/* Arrêts / Stops */}
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-2 py-1 text-left font-semibold" style={{ color: 'var(--text-muted)' }}>PDV</th>
                    <th className="px-2 py-1 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>{t('operations.planned')}</th>
                    <th className="px-2 py-1 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>{t('operations.estimated')}</th>
                    <th className="px-2 py-1 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>EQC</th>
                    <th className="px-2 py-1 text-center font-semibold" style={{ color: 'var(--text-muted)' }}>{t('operations.pickups')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tour.estimated_stops
                    .sort((a, b) => a.sequence_order - b.sequence_order)
                    .map((stop) => {
                      const pdv = pdvMap.get(stop.pdv_id)
                      const pickups = [
                        stop.pickup_cardboard && 'C',
                        stop.pickup_containers && 'B',
                        stop.pickup_returns && 'R',
                      ].filter(Boolean).join(' ')

                      return (
                        <tr key={stop.id} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="px-2 py-1" style={{ color: 'var(--text-muted)' }}>{stop.sequence_order}</td>
                          <td className="px-2 py-1" style={{ color: 'var(--text-primary)' }}>
                            <span className="font-semibold">{pdv?.code ?? ''}</span>
                            <span className="ml-1">{pdv?.name ?? `#${stop.pdv_id}`}</span>
                            {pdv?.city && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>({pdv.city})</span>}
                          </td>
                          <td className="px-2 py-1 text-center font-mono" style={{ color: 'var(--text-muted)' }}>{stop.arrival_time ?? '—'}</td>
                          <td className="px-2 py-1 text-center font-mono font-semibold" style={{ color: tour.delay_minutes > 0 ? color : 'var(--text-primary)' }}>
                            {stop.estimated_arrival ?? '—'}
                          </td>
                          <td className="px-2 py-1 text-center" style={{ color: 'var(--text-primary)' }}>{stop.eqp_count}</td>
                          <td className="px-2 py-1 text-center" style={{ color: pickups ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                            {pickups || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  <tr className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-2 py-1" style={{ color: 'var(--text-muted)' }}>&#8617;</td>
                    <td className="px-2 py-1 font-semibold" style={{ color: 'var(--text-muted)' }}>{t('tourPlanning.returnBase')}</td>
                    <td className="px-2 py-1 text-center font-mono" style={{ color: 'var(--text-muted)' }}>{tour.return_time ?? '—'}</td>
                    <td className="px-2 py-1 text-center font-mono font-semibold" style={{ color: tour.delay_minutes > 0 ? color : 'var(--text-primary)' }}>
                      {tour.estimated_return ?? '—'}
                    </td>
                    <td /><td />
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Formulaire éditable / Editable form */}
            <div className="grid grid-cols-5 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('operations.driverName')}</label>
                <input type="text" value={form.driver_name} onChange={(e) => onFormChange('driver_name', e.target.value)}
                  className="w-full px-2 py-1.5 rounded border text-xs"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  onClick={(e) => e.stopPropagation()} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('operations.driverArrival')}</label>
                <div className="flex gap-1">
                  <input type="time" value={form.driver_arrival_time} onChange={(e) => onFormChange('driver_arrival_time', e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded border text-xs"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    onClick={(e) => e.stopPropagation()} />
                  <button onClick={(e) => { e.stopPropagation(); onSetNow('driver_arrival_time') }}
                    className="px-1.5 rounded text-xs font-bold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-primary)' }} title="Maintenant">&#9201;</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('operations.loadingEnd')}</label>
                <div className="flex gap-1">
                  <input type="time" value={form.loading_end_time} onChange={(e) => onFormChange('loading_end_time', e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded border text-xs"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    onClick={(e) => e.stopPropagation()} />
                  <button onClick={(e) => { e.stopPropagation(); onSetNow('loading_end_time') }}
                    className="px-1.5 rounded text-xs font-bold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-primary)' }} title="Maintenant">&#9201;</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('operations.totalWeightKg')}</label>
                <input type="number" step="0.01" min="0" value={form.total_weight_kg} onChange={(e) => onFormChange('total_weight_kg', e.target.value)}
                  className="w-full px-2 py-1.5 rounded border text-xs"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="kg" onClick={(e) => e.stopPropagation()} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('operations.remarks')}</label>
                <input type="text" value={form.remarks} onChange={(e) => onFormChange('remarks', e.target.value)}
                  className="w-full px-2 py-1.5 rounded border text-xs"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  onClick={(e) => e.stopPropagation()} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button onClick={(e) => { e.stopPropagation(); onRouteSheet() }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>{t('operations.driverRoute')}</button>
              <button onClick={(e) => { e.stopPropagation(); onWaybill() }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>{t('operations.waybill')}</button>
              <button onClick={(e) => { e.stopPropagation(); onSave() }} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: saving ? 0.5 : 1 }}>{saving ? '...' : t('common.save')}</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/* ─── Badge retard / Delay badge ─── */

function DelayBadge({ delay, color, t }: { delay: number; color: string; t: (k: string) => string }) {
  if (delay <= 0) {
    return <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ color: '#22c55e' }}>{t('operations.onTime')}</span>
  }
  return <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${color}18`, color }}>+{delay}&#8242;</span>
}
