/* En-tête de l'application / Application header */

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../stores/useAppStore'
import { useAuthStore } from '../../stores/useAuthStore'
import { useMapStore } from '../../stores/useMapStore'
import { useApi } from '../../hooks/useApi'
import type { Country, Region, PDV, BaseLogistics } from '../../types'

const languages = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
  { code: 'nl', label: 'NL' },
]

export function Header() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, toggleTheme, setLanguage, selectedCountryId, selectedRegionId, setSelectedCountry, setSelectedRegion } = useAppStore()
  const { user, logout } = useAuthStore()
  const { setCenter, setZoom } = useMapStore()
  const [showScope, setShowScope] = useState(false)
  const scopeRef = useRef<HTMLDivElement>(null)

  const { data: countries } = useApi<Country>('/countries')
  const { data: allRegions } = useApi<Region>('/regions')
  const { data: pdvs } = useApi<PDV>('/pdvs')
  const { data: bases } = useApi<BaseLogistics>('/bases')

  /* Fermer le popup si clic en dehors / Close popup on outside click */
  useEffect(() => {
    if (!showScope) return
    const handleClick = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setShowScope(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showScope])

  /* Régions filtrées par pays / Regions filtered by country */
  const regions = useMemo(() => {
    if (!selectedCountryId) return allRegions
    return allRegions.filter((r) => r.country_id === selectedCountryId)
  }, [allRegions, selectedCountryId])

  /* Noms pour l'indicateur / Names for the indicator */
  const countryName = countries.find((c) => c.id === selectedCountryId)?.name
  const regionName = allRegions.find((r) => r.id === selectedRegionId)?.name
  const scopeLabel = regionName || countryName || t('parameters.global')

  /* Calculer le centre et zoom d'un groupe de points / Compute center & zoom for a set of points */
  const zoomToPoints = (points: { latitude?: number | null; longitude?: number | null }[]) => {
    const valid = points.filter((p) => p.latitude && p.longitude) as { latitude: number; longitude: number }[]
    if (valid.length === 0) return
    const lats = valid.map((p) => p.latitude)
    const lngs = valid.map((p) => p.longitude)
    setCenter([(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2])
    const maxRange = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
    setZoom(maxRange > 10 ? 5 : maxRange > 5 ? 6 : maxRange > 2 ? 7 : maxRange > 1 ? 8 : maxRange > 0.5 ? 9 : maxRange > 0.1 ? 11 : 13)
  }

  const handleCountryChange = (countryId: number | null) => {
    setSelectedCountry(countryId)
    if (countryId) {
      const ids = new Set(allRegions.filter((r) => r.country_id === countryId).map((r) => r.id))
      zoomToPoints([...pdvs.filter((p) => ids.has(p.region_id)), ...bases.filter((b) => ids.has(b.region_id))])
    }
  }

  const handleRegionChange = (regionId: number | null) => {
    setSelectedRegion(regionId)
    if (regionId) {
      zoomToPoints([...pdvs.filter((p) => p.region_id === regionId), ...bases.filter((b) => b.region_id === regionId)])
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header
      className="h-14 flex items-center justify-between px-4 border-b"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {t('app.title')}
        </h1>

        {/* Indicateur périmètre compact / Compact scope indicator */}
        <div className="relative" ref={scopeRef}>
          <button
            onClick={() => setShowScope((v) => !v)}
            className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: (selectedCountryId || selectedRegionId) ? 'rgba(249,115,22,0.1)' : 'var(--bg-tertiary)',
              borderColor: (selectedCountryId || selectedRegionId) ? 'var(--color-primary)' : 'var(--border-color)',
              color: (selectedCountryId || selectedRegionId) ? 'var(--color-primary)' : 'var(--text-secondary)',
            }}
          >
            📍 {scopeLabel}
          </button>

          {showScope && (
            <div
              className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg p-3 min-w-[220px] space-y-3"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            >
              {/* Pays / Country */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('common.country')}
                </label>
                <select
                  value={selectedCountryId ?? ''}
                  onChange={(e) => handleCountryChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">— {t('parameters.global')} —</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Région / Region */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>
                  {t('common.region')}
                </label>
                <select
                  value={selectedRegionId ?? ''}
                  onChange={(e) => handleRegionChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border px-2 py-1.5 text-sm"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="">— {t('common.filter')} —</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Sélecteur de langue / Language selector */}
        <div className="flex gap-1">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setLanguage(lang.code) }}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: i18n.language === lang.code ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                color: i18n.language === lang.code ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Aide / Help */}
        <button
          onClick={() => navigate('/help')}
          className="p-2 rounded-lg transition-colors text-sm font-bold"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--color-primary)' }}
          title={t('help.title')}
        >
          ?
        </button>

        {/* Toggle dark/light / Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Utilisateur + déconnexion / User + logout */}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
              title={t('auth.logout')}
            >
              {t('auth.logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
