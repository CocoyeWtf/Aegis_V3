/* Page controle temperature chaine du froid / Cold chain temperature control page */

import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface TemperatureConfig {
  id: number
  name: string
  min_temperature: number
  max_temperature: number
  default_setpoint?: number | null
  requires_cooling_check: boolean
}

interface TemperatureCheck {
  id: number
  tour_id: number
  tour_stop_id?: number | null
  checkpoint: string
  temperature: number
  setpoint_temperature?: number | null
  cooling_unit_ok?: boolean | null
  timestamp: string
  notes?: string | null
  is_compliant?: boolean | null
  stop_pdv_name?: string | null
}

const CHECKPOINT_LABELS: Record<string, string> = {
  TRAILER_ARRIVAL: 'Arrivee semi',
  TRAILER_BEFORE_LOADING: 'Avant chargement',
  TRAILER_AFTER_LOADING: 'Fin chargement',
  DEPARTURE_CHECK: 'Depart chauffeur',
  STOP_CHECK: 'Stop PDV',
}

export default function TemperatureControl() {
  const [configs, setConfigs] = useState<TemperatureConfig[]>([])
  const [checks, setChecks] = useState<TemperatureCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [tourIdFilter, setTourIdFilter] = useState('')

  // Config dialog
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [editConfig, setEditConfig] = useState<TemperatureConfig | null>(null)
  const [cfgName, setCfgName] = useState('')
  const [cfgMin, setCfgMin] = useState('')
  const [cfgMax, setCfgMax] = useState('')
  const [cfgSetpoint, setCfgSetpoint] = useState('')
  const [cfgCooling, setCfgCooling] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 500 }
      if (tourIdFilter) params.tour_id = Number(tourIdFilter)

      const [configRes, checkRes] = await Promise.all([
        api.get('/temperature/configs/'),
        api.get('/temperature/checks/', { params }),
      ])
      setConfigs(configRes.data)
      setChecks(checkRes.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [tourIdFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const openConfigCreate = () => {
    setEditConfig(null)
    setCfgName('')
    setCfgMin('')
    setCfgMax('')
    setCfgSetpoint('')
    setCfgCooling(true)
    setShowConfigDialog(true)
  }

  const openConfigEdit = (cfg: TemperatureConfig) => {
    setEditConfig(cfg)
    setCfgName(cfg.name)
    setCfgMin(String(cfg.min_temperature))
    setCfgMax(String(cfg.max_temperature))
    setCfgSetpoint(cfg.default_setpoint != null ? String(cfg.default_setpoint) : '')
    setCfgCooling(cfg.requires_cooling_check)
    setShowConfigDialog(true)
  }

  const handleConfigSave = async () => {
    if (!cfgName || !cfgMin || !cfgMax) return
    setSaving(true)
    try {
      const payload = {
        name: cfgName,
        min_temperature: Number(cfgMin),
        max_temperature: Number(cfgMax),
        default_setpoint: cfgSetpoint ? Number(cfgSetpoint) : null,
        requires_cooling_check: cfgCooling,
      }
      if (editConfig) {
        await api.put(`/temperature/configs/${editConfig.id}`, payload)
      } else {
        await api.post('/temperature/configs/', payload)
      }
      setShowConfigDialog(false)
      fetchData()
    } catch {
      alert('Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleConfigDelete = async (id: number) => {
    if (!confirm('Supprimer cette configuration ?')) return
    try {
      await api.delete(`/temperature/configs/${id}`)
      fetchData()
    } catch {
      alert('Erreur')
    }
  }

  const nonCompliantCount = checks.filter((c) => c.is_compliant === false).length

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Controle temperature — Chaine du froid
      </h1>

      {/* Configurations seuils */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Configurations seuils temperature
          </h2>
          <button
            onClick={openConfigCreate}
            className="px-3 py-1 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            + Ajouter
          </button>
        </div>
        {configs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Aucune configuration. Ajoutez FRAIS, GEL, SURGELE, etc.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                className="rounded-lg border p-3 cursor-pointer hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
                onClick={() => openConfigEdit(cfg)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{cfg.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleConfigDelete(cfg.id) }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Suppr.
                  </button>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {cfg.min_temperature}°C a {cfg.max_temperature}°C
                  {cfg.default_setpoint != null && ` — consigne ${cfg.default_setpoint}°C`}
                  {cfg.requires_cooling_check && ' — groupe froid requis'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Releves temperature */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Releves ({checks.length})
            {nonCompliantCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
                {nonCompliantCount} hors seuil
              </span>
            )}
          </h2>
          <input
            type="number"
            placeholder="Filtrer par ID tournee"
            value={tourIdFilter}
            onChange={(e) => setTourIdFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border w-48"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Tournee</th>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Point controle</th>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>PDV</th>
                <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Temp.</th>
                <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Consigne</th>
                <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Grp. froid</th>
                <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Conforme</th>
                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Chargement...</td></tr>
              ) : checks.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucun releve</td></tr>
              ) : checks.map((c) => (
                <tr
                  key={c.id}
                  className="border-t"
                  style={{
                    borderColor: 'var(--border-color)',
                    backgroundColor: c.is_compliant === false ? 'rgba(239,68,68,0.05)' : undefined,
                  }}
                >
                  <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                    {c.timestamp?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                    {c.tour_id}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                    {CHECKPOINT_LABELS[c.checkpoint] || c.checkpoint}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                    {c.stop_pdv_name || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium" style={{
                    color: c.is_compliant === false ? 'var(--color-danger)' : 'var(--text-primary)',
                  }}>
                    {c.temperature}°C
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: 'var(--text-muted)' }}>
                    {c.setpoint_temperature != null ? `${c.setpoint_temperature}°C` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.cooling_unit_ok === true && <span style={{ color: '#22c55e' }}>OK</span>}
                    {c.cooling_unit_ok === false && <span style={{ color: 'var(--color-danger)' }}>KO</span>}
                    {c.cooling_unit_ok == null && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.is_compliant === true && <span style={{ color: '#22c55e' }}>OK</span>}
                    {c.is_compliant === false && <span className="font-bold" style={{ color: 'var(--color-danger)' }}>NON</span>}
                    {c.is_compliant == null && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-3 py-2 max-w-[150px] truncate" style={{ color: 'var(--text-muted)' }} title={c.notes || ''}>
                    {c.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Config dialog */}
      {showConfigDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowConfigDialog(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border shadow-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editConfig ? 'Modifier configuration' : 'Nouvelle configuration'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Nom (ex: FRAIS, GEL)</label>
                <input
                  type="text"
                  value={cfgName}
                  onChange={(e) => setCfgName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Temp. min (°C)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={cfgMin}
                    onChange={(e) => setCfgMin(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Temp. max (°C)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={cfgMax}
                    onChange={(e) => setCfgMax(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Consigne par defaut (°C)</label>
                <input
                  type="number"
                  step={0.1}
                  value={cfgSetpoint}
                  onChange={(e) => setCfgSetpoint(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm border"
                  style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={cfgCooling}
                  onChange={(e) => setCfgCooling(e.target.checked)}
                />
                Verification groupe froid requise
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowConfigDialog(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfigSave}
                disabled={saving || !cfgName || !cfgMin || !cfgMax}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
