/* Page Exploitant / Warehouse Operations page */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import type { Tour, BaseLogistics, Contract } from '../types'
import { TourWaybill } from '../components/tour/TourWaybill'
import { DriverRouteSheet } from '../components/tour/DriverRouteSheet'

export default function Operations() {
  const { t } = useTranslation()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [baseId, setBaseId] = useState<number | ''>('')
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [waybillTourId, setWaybillTourId] = useState<number | null>(null)
  const [routeSheetTourId, setRouteSheetTourId] = useState<number | null>(null)

  /* Formulaires locaux / Local form state per tour */
  const [forms, setForms] = useState<Record<number, {
    driver_name: string
    driver_arrival_time: string
    loading_end_time: string
    total_weight_kg: string
    remarks: string
  }>>({})

  /* Charger bases et contrats / Load bases and contracts */
  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data))
    api.get('/contracts/').then((r) => setContracts(r.data))
  }, [])

  const contractMap = new Map(contracts.map((c) => [c.id, c]))

  /* Charger tours / Load tours */
  const loadTours = useCallback(async () => {
    if (!baseId) { setTours([]); return }
    setLoading(true)
    try {
      const params: Record<string, unknown> = { date, base_id: baseId }
      const { data } = await api.get<Tour[]>('/tours/', { params })
      /* Filtrer tours planifiés (avec departure_time) / Filter scheduled tours */
      const scheduled = data.filter((t) => t.departure_time)
      setTours(scheduled)
      /* Initialiser les formulaires / Init forms */
      const newForms: typeof forms = {}
      for (const tour of scheduled) {
        newForms[tour.id] = {
          driver_name: tour.driver_name ?? '',
          driver_arrival_time: tour.driver_arrival_time ?? '',
          loading_end_time: tour.loading_end_time ?? '',
          total_weight_kg: tour.total_weight_kg != null ? String(tour.total_weight_kg) : '',
          remarks: tour.remarks ?? '',
        }
      }
      setForms(newForms)
    } catch (e) {
      console.error('Failed to load tours', e)
    } finally {
      setLoading(false)
    }
  }, [date, baseId])

  useEffect(() => { loadTours() }, [loadTours])

  const updateForm = (tourId: number, field: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [tourId]: { ...prev[tourId], [field]: value },
    }))
  }

  const handleSave = async (tourId: number) => {
    setSaving(tourId)
    try {
      const f = forms[tourId]
      const payload = {
        ...f,
        total_weight_kg: f.total_weight_kg ? parseFloat(f.total_weight_kg) : null,
      }
      await api.put(`/tours/${tourId}/operations`, payload)
      await loadTours()
    } catch (e) {
      console.error('Failed to save operations', e)
    } finally {
      setSaving(null)
    }
  }

  const getTourEqp = (tour: Tour) => tour.total_eqp ?? tour.stops.reduce((s, st) => s + st.eqp_count, 0)

  return (
    <div className="p-6">
      {waybillTourId && (
        <TourWaybill tourId={waybillTourId} onClose={() => setWaybillTourId(null)} />
      )}
      {routeSheetTourId && (
        <DriverRouteSheet tourId={routeSheetTourId} onClose={() => setRouteSheetTourId(null)} />
      )}

      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        {t('operations.title')}
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
            {t('operations.base')}
          </label>
          <select
            value={baseId}
            onChange={(e) => setBaseId(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">{t('operations.selectBase')}</option>
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
        <p style={{ color: 'var(--text-muted)' }}>{baseId ? t('operations.noTours') : t('operations.selectBaseHint')}</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
          {tours.map((tour) => {
            const contract = tour.contract_id ? contractMap.get(tour.contract_id) : null
            const form = forms[tour.id]
            if (!form) return null
            return (
              <div
                key={tour.id}
                className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-base" style={{ color: 'var(--color-primary)' }}>{tour.code}</span>
                    <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      {contract?.vehicle_name ?? contract?.vehicle_code ?? ''}
                    </span>
                  </div>
                  <div className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                    <div>{contract?.transporter_name ?? '—'}</div>
                    <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {tour.departure_time} — {tour.stops.length} {t('tourPlanning.stops')} — {getTourEqp(tour)} EQC
                    </div>
                  </div>
                </div>

                {/* Champs éditables / Editable fields */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('operations.driverName')}
                    </label>
                    <input
                      type="text"
                      value={form.driver_name}
                      onChange={(e) => updateForm(tour.id, 'driver_name', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('operations.driverArrival')}
                    </label>
                    <input
                      type="time"
                      value={form.driver_arrival_time}
                      onChange={(e) => updateForm(tour.id, 'driver_arrival_time', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('operations.loadingEnd')}
                    </label>
                    <input
                      type="time"
                      value={form.loading_end_time}
                      onChange={(e) => updateForm(tour.id, 'loading_end_time', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      {t('operations.totalWeightKg')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.total_weight_kg}
                      onChange={(e) => updateForm(tour.id, 'total_weight_kg', e.target.value)}
                      className="w-full px-2 py-1.5 rounded border text-sm"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                      placeholder="kg"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                    {t('operations.remarks')}
                  </label>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => updateForm(tour.id, 'remarks', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 rounded border text-sm resize-none"
                    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setRouteSheetTourId(tour.id)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all hover:opacity-80"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    {t('operations.driverRoute')}
                  </button>
                  <button
                    onClick={() => setWaybillTourId(tour.id)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all hover:opacity-80"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    {t('operations.waybill')}
                  </button>
                  <button
                    onClick={() => handleSave(tour.id)}
                    disabled={saving === tour.id}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#fff', opacity: saving === tour.id ? 0.5 : 1 }}
                  >
                    {saving === tour.id ? '...' : t('common.save')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
