/* Page Poste de Garde / Guard Post page */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import type { Tour, BaseLogistics, Contract } from '../types'

type GateStatus = 'waiting' | 'en_route' | 'returned'

function getGateStatus(tour: Tour): GateStatus {
  if (tour.barrier_entry_time) return 'returned'
  if (tour.barrier_exit_time) return 'en_route'
  return 'waiting'
}

const statusConfig: Record<GateStatus, { color: string; labelKey: string }> = {
  waiting: { color: 'var(--text-muted)', labelKey: 'guardPost.statusWaiting' },
  en_route: { color: 'var(--color-warning)', labelKey: 'guardPost.statusEnRoute' },
  returned: { color: 'var(--color-success)', labelKey: 'guardPost.statusReturned' },
}

export default function GuardPost() {
  const { t } = useTranslation()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [baseId, setBaseId] = useState<number | ''>('')
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data))
    api.get('/contracts/').then((r) => setContracts(r.data))
  }, [])

  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  const loadTours = useCallback(async () => {
    if (!baseId) { setTours([]); return }
    setLoading(true)
    try {
      const params: Record<string, unknown> = { date, base_id: baseId }
      const { data } = await api.get<Tour[]>('/tours/', { params })
      setTours(data.filter((t) => t.departure_time))
    } catch (e) {
      console.error('Failed to load tours', e)
    } finally {
      setLoading(false)
    }
  }, [date, baseId])

  useEffect(() => { loadTours() }, [loadTours])

  const now = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const handleGateUpdate = async (tourId: number, field: 'barrier_exit_time' | 'barrier_entry_time', value: string | null) => {
    setSaving(tourId)
    try {
      const payload: Record<string, string | null> = { [field]: value }
      await api.put(`/tours/${tourId}/gate`, payload)
      await loadTours()
    } catch (e) {
      console.error('Failed to update gate', e)
    } finally {
      setSaving(null)
    }
  }

  const getTourEqp = (tour: Tour) => tour.total_eqp ?? tour.stops.reduce((s, st) => s + st.eqp_count, 0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('guardPost.title')}
      </h1>

      {/* Filtres / Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('common.date')}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
            {t('guardPost.base')}
          </label>
          <select
            value={baseId}
            onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">{t('guardPost.selectBase')}</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cartes tours / Tour cards */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</p>
      ) : tours.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{baseId ? t('guardPost.noTours') : t('guardPost.selectBaseHint')}</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
          {tours.map((tour) => {
            const contract = tour.contract_id ? contractMap.get(tour.contract_id) : null
            const status = getGateStatus(tour)
            const config = statusConfig[status]
            const isSaving = saving === tour.id
            return (
              <div
                key={tour.id}
                className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: config.color, borderWidth: '2px' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-base" style={{ color: 'var(--color-primary)' }}>{tour.code}</span>
                    <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {contract?.vehicle_name ?? contract?.vehicle_code ?? ''}
                    </span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: config.color, color: '#fff' }}
                  >
                    {t(config.labelKey)}
                  </span>
                </div>

                <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  <span>{contract?.transporter_name ?? '—'}</span>
                  <span className="mx-2">|</span>
                  <span>{t('guardPost.driver')}: <strong style={{ color: 'var(--text-primary)' }}>{tour.driver_name || '—'}</strong></span>
                  <span className="mx-2">|</span>
                  <span>{tour.departure_time} — {tour.stops.length} {t('tourPlanning.stops')} — {getTourEqp(tour)} EQP</span>
                </div>

                {/* Sortie barrière / Barrier exit */}
                <div className="flex items-center gap-3 mb-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <span className="text-xs font-semibold w-28" style={{ color: 'var(--text-muted)' }}>
                    {t('guardPost.barrierExit')}
                  </span>
                  {tour.barrier_exit_time ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {tour.barrier_exit_time}
                      </span>
                      <button
                        onClick={() => handleGateUpdate(tour.id, 'barrier_exit_time', null)}
                        disabled={isSaving}
                        className="ml-auto text-xs px-2 py-0.5 rounded border hover:opacity-80"
                        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                      >
                        {t('guardPost.reset')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGateUpdate(tour.id, 'barrier_exit_time', now())}
                      disabled={isSaving}
                      className="px-3 py-1 rounded-lg text-xs font-semibold hover:opacity-80"
                      style={{ backgroundColor: 'var(--color-warning)', color: '#fff' }}
                    >
                      {t('guardPost.now')}
                    </button>
                  )}
                </div>

                {/* Entrée barrière / Barrier entry */}
                <div className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                  <span className="text-xs font-semibold w-28" style={{ color: 'var(--text-muted)' }}>
                    {t('guardPost.barrierEntry')}
                  </span>
                  {tour.barrier_entry_time ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {tour.barrier_entry_time}
                      </span>
                      <button
                        onClick={() => handleGateUpdate(tour.id, 'barrier_entry_time', null)}
                        disabled={isSaving}
                        className="ml-auto text-xs px-2 py-0.5 rounded border hover:opacity-80"
                        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                      >
                        {t('guardPost.reset')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGateUpdate(tour.id, 'barrier_entry_time', now())}
                      disabled={isSaving || !tour.barrier_exit_time}
                      className="px-3 py-1 rounded-lg text-xs font-semibold hover:opacity-80"
                      style={{
                        backgroundColor: tour.barrier_exit_time ? 'var(--color-success)' : 'var(--bg-tertiary)',
                        color: tour.barrier_exit_time ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {t('guardPost.now')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
