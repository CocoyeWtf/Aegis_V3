/* Page Poste de Garde v4 / Guard Post page v4
   — 2 modes scan distincts (Départ / Retour) pour éviter le double-bip
   — Modale scan dédiée par mode + saisie km obligatoire
   — Cartes tours avec boutons manuels + affichage km */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import type { Tour, BaseLogistics, Contract, Volume } from '../types'
import { getDelayMinutes, getDelayLevel, DELAY_COLORS } from '../utils/tourDelay'
import { parseTime, displayDateTime, nowDateTimeLocal, formatDate } from '../utils/tourTimeUtils'
import { useAppStore } from '../stores/useAppStore'

type GateStatus = 'waiting' | 'en_route' | 'returned'
type ScanMode = 'exit' | 'entry'

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
/* Cooldown anti double-bip (ms) / Anti double-scan cooldown */
const SCAN_COOLDOWN_MS = 2000

export default function GuardPost() {
  const { t } = useTranslation()
  const { isFullscreen, toggleFullscreen } = useAppStore()
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [baseId, setBaseId] = useState<number | ''>('')
  const [bases, setBases] = useState<BaseLogistics[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [lastRefresh, setLastRefresh] = useState('')

  /* Modale scan / Scan modal state */
  const [scanMode, setScanMode] = useState<ScanMode | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [scanError, setScanError] = useState('')
  const [scanSuccess, setScanSuccess] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const scanLockRef = useRef(false)

  /* Modale km / Km modal — s'ouvre après scan réussi ou clic manuel */
  const [kmModal, setKmModal] = useState<{ tour: Tour; mode: ScanMode } | null>(null)
  const [kmValue, setKmValue] = useState('')
  const [kmError, setKmError] = useState('')
  const [kmSaving, setKmSaving] = useState(false)

  useEffect(() => {
    api.get('/bases/').then((r) => setBases(r.data))
    api.get('/contracts/').then((r) => setContracts(r.data))
  }, [])

  const contractMap = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts])

  const loadTours = useCallback(async (silent = false) => {
    if (!baseId) { setTours([]); setVolumes([]); return }
    if (!silent) setLoading(true)
    try {
      const params: Record<string, unknown> = { delivery_date: date, base_id: baseId }
      const [toursRes, volRes] = await Promise.all([
        api.get<Tour[]>('/tours/', { params }),
        api.get<Volume[]>('/volumes/', { params: { base_origin_id: baseId } }),
      ])
      setVolumes(volRes.data)
      const data = toursRes.data
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

  /* Auto-refresh / Polling */
  useEffect(() => {
    if (!baseId) return
    const id = setInterval(() => loadTours(true), REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [baseId, loadTours])

  const now = () => nowDateTimeLocal()

  /* ── Ouvrir modale scan / Open scan modal ── */
  const openScanModal = (mode: ScanMode) => {
    setScanMode(mode)
    setScanCode('')
    setScanError('')
    setScanSuccess('')
    scanLockRef.current = false
    /* Focus l'input après le rendu / Focus input after render */
    setTimeout(() => scanInputRef.current?.focus(), 50)
  }

  /* ── Traiter le scan / Process scan ── */
  const handleScan = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || !scanMode) return

    /* Anti double-bip / Anti double-scan */
    if (scanLockRef.current) return
    scanLockRef.current = true

    setScanError('')
    setScanSuccess('')

    /* Chercher localement puis via API / Search locally then API */
    let tour: Tour | null = tours.find((t) => t.code === trimmed) ?? null
    if (!tour) {
      try {
        const res = await api.get<Tour>(`/tours/by-code/${encodeURIComponent(trimmed)}`)
        tour = res.data
      } catch {
        setScanError(`Tour "${trimmed}" non trouvé`)
        setScanCode('')
        setTimeout(() => { scanLockRef.current = false }, SCAN_COOLDOWN_MS)
        return
      }
    }

    /* Valider l'état du tour selon le mode / Validate tour state for selected mode */
    if (scanMode === 'exit') {
      if (tour.barrier_exit_time) {
        setScanError(`${tour.code} : sortie déjà enregistrée`)
        setScanCode('')
        setTimeout(() => { scanLockRef.current = false }, SCAN_COOLDOWN_MS)
        return
      }
    } else {
      if (!tour.barrier_exit_time) {
        setScanError(`${tour.code} : pas encore sorti (scannez en mode Départ d'abord)`)
        setScanCode('')
        setTimeout(() => { scanLockRef.current = false }, SCAN_COOLDOWN_MS)
        return
      }
      if (tour.barrier_entry_time) {
        setScanError(`${tour.code} : entrée déjà enregistrée`)
        setScanCode('')
        setTimeout(() => { scanLockRef.current = false }, SCAN_COOLDOWN_MS)
        return
      }
    }

    /* Scan OK → ouvrir modale km / Scan OK → open km modal */
    setScanCode('')
    setScanMode(null)
    setKmModal({ tour, mode: scanMode })
    setKmValue('')
    setKmError('')
    scanLockRef.current = false
  }

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScan(scanCode)
    }
  }

  /* ── Ouvrir modale km manuellement (clic bouton sur carte) / Manual km modal open ── */
  const openKmModal = (tour: Tour, mode: ScanMode) => {
    setKmModal({ tour, mode })
    setKmValue('')
    setKmError('')
  }

  /* ── Valider km / Submit km ── */
  const handleKmSubmit = async () => {
    if (!kmModal) return
    const { tour, mode } = kmModal
    const kmNum = parseInt(kmValue, 10)

    if (!kmValue || isNaN(kmNum) || kmNum < 0) {
      setKmError('Saisissez un km compteur valide')
      return
    }

    if (mode === 'entry' && tour.km_departure != null && kmNum < tour.km_departure) {
      setKmError(`Le km retour doit être >= km départ (${tour.km_departure})`)
      return
    }

    setKmSaving(true)
    try {
      if (mode === 'exit') {
        await api.put(`/tours/${tour.id}/gate`, {
          barrier_exit_time: now(),
          km_departure: kmNum,
        })
      } else {
        await api.put(`/tours/${tour.id}/gate`, {
          barrier_entry_time: now(),
          km_return: kmNum,
        })
      }
      setKmModal(null)
      await loadTours(true)
    } catch (e) {
      console.error('Failed to save km', e)
      setKmError('Erreur lors de la sauvegarde')
    } finally {
      setKmSaving(false)
    }
  }

  /* ── Reset barrier (remet à null barrier_time + km) / Reset barrier ── */
  const handleGateReset = async (tourId: number, field: 'barrier_exit_time' | 'barrier_entry_time') => {
    setSaving(tourId)
    try {
      const payload: Record<string, null> = { [field]: null }
      if (field === 'barrier_exit_time') payload.km_departure = null
      if (field === 'barrier_entry_time') payload.km_return = null
      await api.put(`/tours/${tourId}/gate`, payload)
      await loadTours(true)
    } catch (e) {
      console.error('Failed to reset gate', e)
    } finally {
      setSaving(null)
    }
  }

  const getTourEqp = (tour: Tour) => tour.total_eqp ?? tour.stops.reduce((s, st) => s + st.eqp_count, 0)

  /* Compteurs par statut / Counters per status */
  const waitingCount = tours.filter((t) => !t.barrier_exit_time).length
  const enRouteCount = tours.filter((t) => t.barrier_exit_time && !t.barrier_entry_time).length
  const returnedCount = tours.filter((t) => t.barrier_entry_time).length

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
      <div className="flex gap-4 mb-5 flex-wrap items-end">
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

      {/* Boutons scan Départ / Retour + compteurs / Scan buttons + counters */}
      {baseId && tours.length > 0 && (
        <div className="flex gap-4 mb-5 flex-wrap items-center">
          <button
            onClick={() => openScanModal('exit')}
            className="flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-md"
            style={{ backgroundColor: 'var(--color-warning)', color: '#fff' }}
          >
            <span style={{ fontSize: '20px' }}>&#9654;</span>
            <span>
              Scan Départ
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {waitingCount}
              </span>
            </span>
          </button>
          <button
            onClick={() => openScanModal('entry')}
            className="flex items-center gap-3 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95 shadow-md"
            style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
          >
            <span style={{ fontSize: '20px' }}>&#9724;</span>
            <span>
              Scan Retour
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                {enRouteCount}
              </span>
            </span>
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {waitingCount} en attente &middot; {enRouteCount} en route &middot; {returnedCount} rentrés
          </span>
        </div>
      )}

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
                {(() => {
                  const tourVols = volumes.filter((v) => v.tour_id === tour.id)
                  const dispVol = tourVols.find((v) => v.dispatch_date)
                  return (
                    <div className="px-4 py-2 text-xs flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>{contract?.transporter_name ?? '—'}</span>
                        <span>{t('guardPost.driver')}: <strong style={{ color: 'var(--text-primary)' }}>{tour.driver_name || '—'}</strong></span>
                        <span>{tour.stops.length} {t('tourPlanning.stops')} &middot; {getTourEqp(tour)} EQC</span>
                        {delay > 0 && (
                          <span className="font-bold" style={{ color: delayColor }}>+{delay}&#8242;</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {dispVol && (
                          <span>{t('tourPlanning.dispatchInfo')} <strong style={{ color: 'var(--text-primary)' }}>{formatDate(dispVol.dispatch_date)}{dispVol.dispatch_time ? ` ${dispVol.dispatch_time}` : ''}</strong></span>
                        )}
                        {tour.delivery_date && (
                          <span>{t('tourPlanning.deliveryDate')}: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(tour.delivery_date)}</strong></span>
                        )}
                        <span>{t('tourPlanning.departureTime')}: <strong style={{ color: 'var(--text-primary)' }}>{tour.departure_time}</strong></span>
                      </div>
                      {/* Affichage km / Km display */}
                      {(tour.km_departure != null || tour.km_return != null) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {tour.km_departure != null && <span>Km dép: {tour.km_departure}</span>}
                          {tour.km_return != null && <span>Km ret: {tour.km_return}</span>}
                          {tour.km_departure != null && tour.km_return != null && (
                            <span style={{ color: 'var(--color-primary)' }}>Km parcours: {tour.km_return - tour.km_departure}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

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
                          {displayDateTime(tour.barrier_entry_time)}
                        </span>
                        <button
                          onClick={() => handleGateReset(tour.id, 'barrier_entry_time')}
                          disabled={isSaving}
                          className="text-xs px-2 py-0.5 rounded border hover:opacity-80"
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        >{t('guardPost.reset')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openKmModal(tour, 'entry')}
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
                          {displayDateTime(tour.barrier_exit_time)}
                        </span>
                        <button
                          onClick={() => handleGateReset(tour.id, 'barrier_exit_time')}
                          disabled={isSaving}
                          className="text-xs px-2 py-0.5 rounded border hover:opacity-80"
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        >{t('guardPost.reset')}</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openKmModal(tour, 'exit')}
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

      {/* ══════ Modale SCAN (départ ou retour) / Scan modal ══════ */}
      {scanMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div
            className="rounded-2xl shadow-2xl w-full max-w-md mx-4"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: `2px solid ${scanMode === 'exit' ? 'var(--color-warning)' : 'var(--color-success)'}`,
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 rounded-t-2xl flex items-center gap-3"
              style={{
                backgroundColor: scanMode === 'exit' ? 'var(--color-warning)' : 'var(--color-success)',
                color: '#fff',
              }}
            >
              <span style={{ fontSize: '24px' }}>{scanMode === 'exit' ? '\u25B6' : '\u25A0'}</span>
              <div>
                <h3 className="text-lg font-bold">
                  {scanMode === 'exit' ? 'Scan Départ' : 'Scan Retour'}
                </h3>
                <p className="text-xs opacity-80">
                  {scanMode === 'exit'
                    ? 'Scannez la feuille de route du tour qui sort'
                    : 'Scannez la feuille de route du tour qui rentre'}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Code-barre tour
                </label>
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanCode}
                  onChange={(e) => { setScanCode(e.target.value); setScanError(''); setScanSuccess('') }}
                  onKeyDown={handleScanKeyDown}
                  autoFocus
                  placeholder="Scannez ou saisissez le code tour..."
                  className="w-full px-4 py-3 rounded-lg border text-lg font-mono"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: scanError ? 'var(--color-danger)' : 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {scanError && (
                <div className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                  {scanError}
                </div>
              )}
              {scanSuccess && (
                <div className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}>
                  {scanSuccess}
                </div>
              )}

              {/* Liste des tours concernés par ce mode / Relevant tours for this mode */}
              <div>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                  {scanMode === 'exit'
                    ? `Tours en attente de sortie (${waitingCount})`
                    : `Tours en attente de retour (${enRouteCount})`}
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
                  {(scanMode === 'exit'
                    ? tours.filter((t) => !t.barrier_exit_time)
                    : tours.filter((t) => t.barrier_exit_time && !t.barrier_entry_time)
                  ).map((t) => {
                    const c = t.contract_id ? contractMap.get(t.contract_id) : null
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between px-3 py-1.5 text-xs border-b last:border-b-0"
                        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
                      >
                        <span>
                          <strong style={{ color: 'var(--color-primary)' }}>{t.code}</strong>
                          {' '}{t.departure_time} &middot; {t.driver_name || '—'}
                        </span>
                        <span>{c?.vehicle_code ?? ''}</span>
                      </div>
                    )
                  })}
                  {((scanMode === 'exit' ? waitingCount : enRouteCount) === 0) && (
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Aucun tour</div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-end" style={{ borderColor: 'var(--border-color)' }}>
              <button
                onClick={() => setScanMode(null)}
                className="px-5 py-2 rounded-lg text-sm font-semibold border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Modale KM (saisie compteur) / Km input modal ══════ */}
      {kmModal && (() => {
        const { tour, mode } = kmModal
        const contract = tour.contract_id ? contractMap.get(tour.contract_id) : null
        const kmParsed = parseInt(kmValue, 10)
        const kmDistance = mode === 'entry' && tour.km_departure != null && !isNaN(kmParsed) && kmParsed >= tour.km_departure
          ? kmParsed - tour.km_departure
          : null

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div
              className="rounded-2xl shadow-2xl w-full max-w-md mx-4"
              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {mode === 'exit' ? 'Sortie barrière' : 'Entrée barrière'} — {tour.code}
                </h3>
              </div>

              {/* Body */}
              <div className="px-6 py-4 flex flex-col gap-3">
                {/* Infos résumées / Summary info */}
                <div className="text-sm flex flex-col gap-1" style={{ color: 'var(--text-muted)' }}>
                  <div>Chauffeur: <strong style={{ color: 'var(--text-primary)' }}>{tour.driver_name || '—'}</strong></div>
                  <div>Transporteur: <strong style={{ color: 'var(--text-primary)' }}>{contract?.transporter_name ?? '—'}</strong></div>
                  <div>Véhicule: <strong style={{ color: 'var(--text-primary)' }}>{contract?.vehicle_name ?? contract?.vehicle_code ?? '—'}</strong></div>
                </div>

                {/* Mode ENTRÉE : afficher km départ / Entry mode: show departure km */}
                {mode === 'entry' && tour.km_departure != null && (
                  <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                    Km départ enregistré: <strong>{tour.km_departure}</strong>
                  </div>
                )}

                {/* Champ km / Km input */}
                <div>
                  <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {mode === 'exit' ? 'Compteur km départ' : 'Compteur km retour'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={kmValue}
                    onChange={(e) => { setKmValue(e.target.value); setKmError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleKmSubmit() } }}
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg border text-lg font-mono"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: kmError ? 'var(--color-danger)' : 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="Ex: 123456"
                  />
                  {kmError && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{kmError}</p>
                  )}
                </div>

                {/* Km parcourus temps réel / Real-time km driven */}
                {kmDistance != null && (
                  <div className="text-sm font-bold px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: 'var(--color-primary)' }}>
                    Km parcourus: {kmDistance} km
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  onClick={() => setKmModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleKmSubmit}
                  disabled={kmSaving}
                  className="px-6 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                  style={{
                    backgroundColor: mode === 'exit' ? 'var(--color-warning)' : 'var(--color-success)',
                    color: '#fff',
                    opacity: kmSaving ? 0.6 : 1,
                  }}
                >
                  {kmSaving ? '...' : mode === 'exit' ? 'Valider sortie' : 'Valider entrée'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
