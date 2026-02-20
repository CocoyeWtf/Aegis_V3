/* Page Poste de Garde v2 / Guard Post page v2 — Streamlined barrier tracking */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import type { Tour, BaseLogistics, Contract } from '../types'
import { getDelayMinutes, getDelayLevel, DELAY_COLORS } from '../utils/tourDelay'
import { parseTime } from '../utils/tourTimeUtils'
import { useAppStore } from '../stores/useAppStore'

type GateStatus = 'waiting' | 'en_route' | 'returned'

function getGateStatus(tour: Tour): GateStatus {
  if (tour.barrier_entry_time) return 'returned'
  if (tour.barrier_exit_time) return 'en_route'
  return 'waiting'
}

const statusConfig: Record<GateStatus, { bg: string; color: string; labelKey: string }> = {
  waiting: { bg: 'var(--bg-tertiary)', color: 'var(--text-muted)', labelKey: 'guardPost.statusWaiting' },
  en_route: { bg: 'rgba(249,115,22,0.12)', color: 'var(--color-warning)', labelKey: 'guardPost.statusEnRoute' },
  returned: { bg: 'rgba(34,197,94,0.12)', color: 'var(--color-success)', labelKey: 'guardPost.statusReturned' },
}

const REFRESH_INTERVAL = 15_000

export default function GuardPost() {
  const { t } = useTranslation()
  const { isFullscreen, toggleFullscreen } = useAppStore()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [baseId, setBaseId] = useState<number | ''>('')
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [lastRefresh, setLastRefresh] = useState('')

  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data))
    api.get('/contracts/').then((r) => setContracts(r.data))
  }, [])

  const contractMap = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts])

  const loadTours = useCallback(async (silent = false) => {
    if (!baseId) { setTours([]); return }
    if (!silent) setLoading(true)
    try {
      const params: Record<string, unknown> = { date, base_id: baseId }
      const { data } = await api.get<Tour[]>('/tours/', { params })
      setTours(data.filter((t) => t.departure_time).sort((a, b) => parseTime(a.departure_time!) - parseTime(b.departure_time!)))
      const now = new Date()
      setLastRefresh(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`)
    } catch (e) {
      console.error('Failed to load tours', e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [date, baseId])

  useEffect(() => { loadTours() }, [loadTours])

  /* Auto-refresh / Polling — plus fréquent pour le poste de garde */
  useEffect(() => {
    if (!baseId) return
    const id = setInterval(() => loadTours(true), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [baseId, loadTours])

  const now = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const handleGateUpdate = async (tourId: number, field: 'barrier_exit_time' | 'barrier_entry_time', value: string | null) => {
    setSaving(tourId)
    try {
      await api.put(`/tours/${tourId}/gate`, { [field]: value })
      await loadTours(true)
    } catch (e) {
      console.error('Failed to update gate', e)
    } finally {
      setSaving(null)
    }
  }

  const getTourEqp = (tour: Tour) => tour.total_eqp ?? tour.stops.reduce((s, st) => s + st.eqp_count, 0)

  return (
    <div className="p-6">
      {/* En-tête / Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('guardPost.title')}
        </h1>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              Auto &#10227; 15s &middot; {lastRefresh}
            </span>
          )}
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
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{t('guardPost.base')}</label>
          <select
            value={baseId} onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">{t('guardPost.selectBase')}</option>
            {bases.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Cartes tours / Tour cards */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : tours.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{baseId ? t('guardPost.noTours') : t('guardPost.selectBaseHint')}</p>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {tours.map((tour) => {
            const contract = tour.contract_id ? contractMap.get(tour.contract_id) : null
            const status = getGateStatus(tour)
            const config = statusConfig[status]
            const isSaving = saving === tour.id
            const delay = getDelayMinutes(tour)
            const delayColor = DELAY_COLORS[getDelayLevel(delay)]

            return (
              <div
                key={tour.id}
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: config.color, borderWidth: '2px' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: config.bg }}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>{tour.code}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {contract?.vehicle_code ?? contract?.vehicle_name ?? ''}
                    </span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: config.color, color: '#fff' }}
                  >
                    {t(config.labelKey)}
                  </span>
                </div>

                {/* Infos tour / Tour info */}
                <div className="px-4 py-2 text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--text-muted)' }}>
                  <span>{contract?.transporter_name ?? '—'}</span>
                  <span>{t('guardPost.driver')}: <strong style={{ color: 'var(--text-primary)' }}>{tour.driver_name || '—'}</strong></span>
                  <span>{tour.departure_time} &middot; {tour.stops.length} {t('tourPlanning.stops')} &middot; {getTourEqp(tour)} EQC</span>
                  {delay > 0 && (
                    <span className="font-bold" style={{ color: delayColor }}>+{delay}&#8242;</span>
                  )}
                </div>

                {/* Actions barrière — Entrée à gauche, Sortie à droite / Entry left, Exit right */}
                <div className="px-4 py-3 flex gap-3">
                  {/* Entrée barrière / Barrier entry */}
                  <div className="flex-1">
                    <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('guardPost.barrierEntry')}
                    </div>
                    {tour.barrier_entry_time ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                          {tour.barrier_entry_time}
                        </span>
                        <button
                          onClick={() => handleGateUpdate(tour.id, 'barrier_entry_time', null)}
                          disabled={isSaving}
                          className="text-xs px-2 py-0.5 rounded border hover:opacity-80"
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        >{t('guardPost.reset')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGateUpdate(tour.id, 'barrier_entry_time', now())}
                        disabled={isSaving || !tour.barrier_exit_time}
                        className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        style={{
                          backgroundColor: tour.barrier_exit_time ? 'var(--color-success)' : 'var(--bg-tertiary)',
                          color: tour.barrier_exit_time ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        &#9724; {t('guardPost.now')}
                      </button>
                    )}
                  </div>

                  {/* Sortie barrière / Barrier exit */}
                  <div className="flex-1">
                    <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      {t('guardPost.barrierExit')}
                    </div>
                    {tour.barrier_exit_time ? (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                          {tour.barrier_exit_time}
                        </span>
                        <button
                          onClick={() => handleGateUpdate(tour.id, 'barrier_exit_time', null)}
                          disabled={isSaving}
                          className="text-xs px-2 py-0.5 rounded border hover:opacity-80"
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        >{t('guardPost.reset')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGateUpdate(tour.id, 'barrier_exit_time', now())}
                        disabled={isSaving}
                        className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        style={{ backgroundColor: 'var(--color-warning)', color: '#fff' }}
                      >
                        &#9654; {t('guardPost.now')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
