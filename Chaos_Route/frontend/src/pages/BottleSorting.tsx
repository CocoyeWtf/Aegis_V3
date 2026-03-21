/* Tri vidanges bière / Beer bottle sorting page.
   Interface tactile : sélection format, grille marques avec steppers,
   session en cours, historique.
   Touch-friendly: format tabs, brand grid with steppers, session, history. */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../services/api'

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Brand {
  id: number
  name: string
  format: string
  sorting_rule: string
  mix_group: string | null
  bottles_per_crate: number
  deposit_per_bottle: number | null
  is_active: number
}

interface SortingLineData {
  brand_id: number | null
  brand_name: string
  bottle_format: string
  sorting_rule: string
  full_crates: number
  loose_bottles: number
  damaged_bottles: number
  label: string | null
}

interface SessionRead {
  id: number
  base_id: number
  base_name: string | null
  session_date: string
  status: string
  operator_name: string | null
  started_at: string
  completed_at: string | null
  total_crates: number | null
  total_bottles: number | null
  lines: {
    id: number; brand_id: number | null; brand_name: string | null
    bottle_format: string; sorting_rule: string
    full_crates: number; loose_bottles: number; damaged_bottles: number
    total_bottles: number; label: string | null
  }[]
}

interface Base { id: number; code: string; name: string }

/* ─── Constants ──────────────────────────────────────────────────────── */

const FORMATS = ['25CL', '33CL', '50CL'] as const
const FORMAT_COLORS: Record<string, string> = { '25CL': '#3b82f6', '33CL': '#f59e0b', '50CL': '#22c55e' }
const RULE_LABELS: Record<string, string> = { MONO: 'Mono-marque', MIX_ALLOWED: 'Melange tolere', FORMAT_MIX: 'Melange format' }
const RULE_ICONS: Record<string, string> = { MONO: '🔒', MIX_ALLOWED: '🔀', FORMAT_MIX: '📦' }

/* ─── Composant stepper / Stepper component ──────────────────────────── */

function CrateStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: '0.7em', color: 'var(--text-muted)', minWidth: 50 }}>{label}</span>
      <button onClick={() => onChange(Math.max(0, value - 1))} style={miniBtn('#ef4444')}>-</button>
      <span style={{
        minWidth: 32, textAlign: 'center', fontWeight: 700, fontSize: '1em',
        color: value > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
      }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={miniBtn('#22c55e')}>+</button>
    </div>
  )
}

const miniBtn = (color: string): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 6, border: 'none',
  background: `${color}22`, color, cursor: 'pointer', fontWeight: 700, fontSize: '1em',
})

/* ─── Composant principal / Main component ───────────────────────────── */

export default function BottleSorting() {
  const [tab, setTab] = useState<'sorting' | 'history'>('sorting')
  const [brands, setBrands] = useState<Brand[]>([])
  const [bases, setBases] = useState<Base[]>([])
  const [sessions, setSessions] = useState<SessionRead[]>([])
  const [selectedBase, setSelectedBase] = useState<number | ''>('')
  const [selectedFormat, setSelectedFormat] = useState<string>('25CL')
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [operatorName, setOperatorName] = useState('')
  const [lines, setLines] = useState<Map<string, SortingLineData>>(new Map())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedSession, setExpandedSession] = useState<number | null>(null)

  /* ─── Fetch ────────────────────────────────────────────────────────── */

  const fetchBrands = useCallback(async () => {
    try {
      const data = await apiFetch('/api/bottle-sorting/brands/')
      setBrands(data || [])
    } catch { /* non-bloquant */ }
  }, [])

  const fetchBases = useCallback(async () => {
    try { setBases(await apiFetch('/api/bases/') || []) } catch { /* */ }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedBase) params.set('base_id', String(selectedBase))
      const data = await apiFetch(`/api/bottle-sorting/sessions/?${params}`)
      setSessions(data || [])
    } catch { /* non-bloquant */ }
  }, [selectedBase])

  useEffect(() => { fetchBrands(); fetchBases() }, [fetchBrands, fetchBases])
  useEffect(() => { if (tab === 'history') fetchSessions() }, [tab, fetchSessions])

  /* ─── Seed marques si vide / Seed brands if empty ──────────────────── */

  const handleSeed = async () => {
    try {
      const res = await apiFetch('/api/bottle-sorting/brands/seed/', { method: 'POST' })
      setMessage(res.message)
      fetchBrands()
    } catch { /* */ }
  }

  /* ─── Démarrer session / Start session ─────────────────────────────── */

  const handleStartSession = async () => {
    if (!selectedBase) { setMessage('Selectionnez une base'); return }
    try {
      const res = await apiFetch('/api/bottle-sorting/sessions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_id: Number(selectedBase),
          session_date: new Date().toISOString().slice(0, 10),
          operator_name: operatorName || null,
        }),
      })
      setSessionId(res.id)
      setLines(new Map())
      setMessage('Session demarree')
    } catch { setMessage('Erreur demarrage session') }
  }

  /* ─── Update ligne / Update line ───────────────────────────────────── */

  const updateLine = (key: string, brand: Brand | null, field: 'full_crates' | 'loose_bottles' | 'damaged_bottles', value: number) => {
    setLines(prev => {
      const next = new Map(prev)
      const existing = next.get(key) || {
        brand_id: brand?.id || null,
        brand_name: brand?.name || `Melange ${selectedFormat}`,
        bottle_format: selectedFormat,
        sorting_rule: brand?.sorting_rule || 'FORMAT_MIX',
        full_crates: 0, loose_bottles: 0, damaged_bottles: 0,
        label: brand ? null : `Melange ${selectedFormat}`,
      }
      next.set(key, { ...existing, [field]: value })
      return next
    })
  }

  /* ─── Sauvegarder / Save ───────────────────────────────────────────── */

  const handleSave = async () => {
    if (!sessionId) return
    setSaving(true)
    try {
      const payload = {
        session_id: sessionId,
        lines: Array.from(lines.values()).map(l => ({
          brand_id: l.brand_id, bottle_format: l.bottle_format,
          sorting_rule: l.sorting_rule,
          full_crates: l.full_crates, loose_bottles: l.loose_bottles,
          damaged_bottles: l.damaged_bottles, label: l.label,
        })),
      }
      await apiFetch('/api/bottle-sorting/lines/batch/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setMessage('Tri sauvegarde')
    } catch { setMessage('Erreur sauvegarde') }
    finally { setSaving(false) }
  }

  const handleComplete = async () => {
    if (!sessionId) return
    await handleSave()
    try {
      const res = await apiFetch(`/api/bottle-sorting/sessions/${sessionId}/complete`, { method: 'POST' })
      setMessage(`Session terminee : ${res.total_crates} casiers, ${res.total_bottles} bouteilles`)
      setSessionId(null)
      setLines(new Map())
    } catch { setMessage('Erreur completion') }
  }

  /* ─── Filtrage marques par format / Filter brands by format ────────── */

  const formatBrands = brands.filter(b => b.format === selectedFormat)
  const monoBrands = formatBrands.filter(b => b.sorting_rule === 'MONO')
  const mixAllowed = formatBrands.filter(b => b.sorting_rule === 'MIX_ALLOWED')
  const formatMix = formatBrands.filter(b => b.sorting_rule === 'FORMAT_MIX')

  // Grouper les MIX_ALLOWED par mix_group
  const mixGroups = new Map<string, Brand[]>()
  mixAllowed.forEach(b => {
    const g = b.mix_group || b.name
    if (!mixGroups.has(g)) mixGroups.set(g, [])
    mixGroups.get(g)!.push(b)
  })

  /* ─── Totaux session / Session totals ──────────────────────────────── */

  const totalCrates = Array.from(lines.values()).reduce((s, l) => s + l.full_crates, 0)
  const totalLoose = Array.from(lines.values()).reduce((s, l) => s + l.loose_bottles, 0)
  const totalDamaged = Array.from(lines.values()).reduce((s, l) => s + l.damaged_bottles, 0)

  /* ─── Styles ───────────────────────────────────────────────────────── */

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1em',
  }

  /* ─── Rendu / Render ───────────────────────────────────────────────── */

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '0.25rem' }}>
        Tri Vidanges
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Tri des bouteilles retournees par format et marque
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['sorting', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: tab === t ? '#fff' : 'var(--text-primary)', fontWeight: tab === t ? 700 : 400,
          }}>
            {t === 'sorting' ? 'Tri en cours' : 'Historique'}
          </button>
        ))}
        {brands.length === 0 && (
          <button onClick={handleSeed} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: '#f59e0b', color: '#fff', fontWeight: 600, marginLeft: 'auto',
          }}>
            Initialiser marques belges
          </button>
        )}
      </div>

      {message && (
        <div style={{
          padding: '0.5rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85em',
          background: message.includes('Erreur') ? '#ef444422' : '#22c55e22',
          color: message.includes('Erreur') ? '#ef4444' : '#22c55e', fontWeight: 600,
        }}>{message}</div>
      )}

      {/* ─── Onglet TRI ─────────────────────────────────────────────── */}
      {tab === 'sorting' && (
        <>
          {/* Démarrage session */}
          {!sessionId && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 8, padding: '1.5rem',
              display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem',
            }}>
              <label style={{ color: 'var(--text-primary)' }}>
                <div style={{ fontSize: '0.85em', marginBottom: 4 }}>Base</div>
                <select value={selectedBase} onChange={e => setSelectedBase(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
                  <option value="">Selectionner...</option>
                  {bases.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
                </select>
              </label>
              <label style={{ color: 'var(--text-primary)' }}>
                <div style={{ fontSize: '0.85em', marginBottom: 4 }}>Operateur</div>
                <input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Nom operateur" style={inputStyle} />
              </label>
              <button onClick={handleStartSession} style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--accent-primary)', color: '#fff', fontWeight: 700,
              }}>
                Demarrer une session
              </button>
            </div>
          )}

          {/* Session active */}
          {sessionId && (
            <>
              {/* Onglets format */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {FORMATS.map(f => (
                  <button key={f} onClick={() => setSelectedFormat(f)} style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedFormat === f ? FORMAT_COLORS[f] : 'var(--bg-secondary)',
                    color: selectedFormat === f ? '#fff' : 'var(--text-primary)',
                    fontWeight: 700, fontSize: '1.1em',
                  }}>
                    {f}
                  </button>
                ))}
              </div>

              {/* Grille marques MONO */}
              {monoBrands.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: '1em', margin: '0 0 0.5rem' }}>
                    {RULE_ICONS.MONO} Mono-marque — chaque bouteille dans son casier
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                    {monoBrands.map(b => {
                      const key = `mono_${b.id}`
                      const line = lines.get(key)
                      return (
                        <div key={b.id} style={{
                          background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem',
                          borderLeft: `3px solid ${FORMAT_COLORS[selectedFormat]}`,
                        }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{b.name}</div>
                          <CrateStepper label="Casiers" value={line?.full_crates || 0} onChange={v => updateLine(key, b, 'full_crates', v)} />
                          <CrateStepper label="Isolees" value={line?.loose_bottles || 0} onChange={v => updateLine(key, b, 'loose_bottles', v)} />
                          <CrateStepper label="Cassees" value={line?.damaged_bottles || 0} onChange={v => updateLine(key, b, 'damaged_bottles', v)} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Groupes MIX_ALLOWED */}
              {mixGroups.size > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: '1em', margin: '0 0 0.5rem' }}>
                    {RULE_ICONS.MIX_ALLOWED} Melanges toleres
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {Array.from(mixGroups.entries()).map(([group, groupBrands]) => (
                      <div key={group} style={{
                        background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem',
                        borderLeft: '3px solid #8b5cf6',
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {groupBrands.map(b => b.name).join(' + ')}
                        </div>
                        <div style={{ fontSize: '0.75em', color: 'var(--text-muted)', marginBottom: 6 }}>Melange autorise dans un casier</div>
                        {groupBrands.map(b => {
                          const key = `mix_${b.id}`
                          const line = lines.get(key)
                          return (
                            <div key={b.id} style={{ marginBottom: 4 }}>
                              <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginBottom: 2 }}>{b.name}</div>
                              <CrateStepper label="Casiers" value={line?.full_crates || 0} onChange={v => updateLine(key, b, 'full_crates', v)} />
                              <CrateStepper label="Isolees" value={line?.loose_bottles || 0} onChange={v => updateLine(key, b, 'loose_bottles', v)} />
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FORMAT_MIX — casier générique */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1em', margin: '0 0 0.5rem' }}>
                  {RULE_ICONS.FORMAT_MIX} Melange format {selectedFormat} — casier generique
                </h3>
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem',
                  borderLeft: '3px solid #22c55e',
                }}>
                  <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {formatMix.map(b => b.name).join(', ') || 'Toutes marques du format'}
                  </div>
                  {(() => {
                    const key = `format_mix_${selectedFormat}`
                    const line = lines.get(key)
                    return (
                      <>
                        <CrateStepper label="Casiers" value={line?.full_crates || 0} onChange={v => updateLine(key, null, 'full_crates', v)} />
                        <CrateStepper label="Isolees" value={line?.loose_bottles || 0} onChange={v => updateLine(key, null, 'loose_bottles', v)} />
                        <CrateStepper label="Cassees" value={line?.damaged_bottles || 0} onChange={v => updateLine(key, null, 'damaged_bottles', v)} />
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Barre résumé + actions */}
              <div style={{
                position: 'sticky', bottom: 0, background: 'var(--bg-secondary)',
                borderTop: '2px solid var(--accent-primary)', borderRadius: '12px 12px 0 0',
                padding: '1rem 1.5rem', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
                boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
              }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>Casiers</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.3em' }}>{totalCrates}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>Isolees</div>
                    <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.3em' }}>{totalLoose}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>Cassees</div>
                    <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '1.3em' }}>{totalDamaged}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleSave} disabled={saving} style={{
                    padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#3b82f6', color: '#fff', fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                  }}>
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                  <button onClick={handleComplete} style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#22c55e', color: '#fff', fontWeight: 700,
                  }}>
                    Terminer la session
                  </button>
                  <button onClick={() => { setSessionId(null); setLines(new Map()) }} style={{
                    padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#6b728022', color: 'var(--text-primary)', fontWeight: 600,
                  }}>
                    Annuler
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── Onglet HISTORIQUE ───────────────────────────────────────── */}
      {tab === 'history' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <select value={selectedBase} onChange={e => setSelectedBase(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
              <option value="">Toutes les bases</option>
              {bases.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
          </div>
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>Aucune session</div>
          )}
          {sessions.map(s => (
            <div key={s.id} style={{
              background: 'var(--bg-secondary)', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem',
              borderLeft: `3px solid ${s.status === 'COMPLETED' ? '#22c55e' : '#f59e0b'}`,
              cursor: 'pointer',
            }} onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.session_date}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{s.base_name}</span>
                  {s.operator_name && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {s.operator_name}</span>}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.8em', fontWeight: 600,
                    background: s.status === 'COMPLETED' ? '#22c55e22' : '#f59e0b22',
                    color: s.status === 'COMPLETED' ? '#22c55e' : '#f59e0b',
                  }}>
                    {s.status === 'COMPLETED' ? 'Termine' : 'En cours'}
                  </span>
                  {s.total_crates != null && (
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {s.total_crates} casiers / {s.total_bottles} bout.
                    </span>
                  )}
                </div>
              </div>
              {expandedSession === s.id && s.lines.length > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-primary)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th style={{ textAlign: 'left', padding: 4 }}>Marque</th>
                        <th style={{ textAlign: 'left', padding: 4 }}>Format</th>
                        <th style={{ textAlign: 'left', padding: 4 }}>Regle</th>
                        <th style={{ textAlign: 'right', padding: 4 }}>Casiers</th>
                        <th style={{ textAlign: 'right', padding: 4 }}>Isolees</th>
                        <th style={{ textAlign: 'right', padding: 4 }}>Cassees</th>
                        <th style={{ textAlign: 'right', padding: 4 }}>Total bout.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lines.map((l, i) => (
                        <tr key={i} style={{ color: 'var(--text-primary)' }}>
                          <td style={{ padding: 4 }}>{l.brand_name || l.label || 'Melange'}</td>
                          <td style={{ padding: 4 }}><span style={{ color: FORMAT_COLORS[l.bottle_format] }}>{l.bottle_format}</span></td>
                          <td style={{ padding: 4 }}><span style={{ fontSize: '0.85em' }}>{RULE_LABELS[l.sorting_rule]}</span></td>
                          <td style={{ padding: 4, textAlign: 'right', fontWeight: 600 }}>{l.full_crates}</td>
                          <td style={{ padding: 4, textAlign: 'right' }}>{l.loose_bottles}</td>
                          <td style={{ padding: 4, textAlign: 'right', color: l.damaged_bottles > 0 ? '#ef4444' : 'inherit' }}>{l.damaged_bottles}</td>
                          <td style={{ padding: 4, textAlign: 'right', fontWeight: 700 }}>{l.total_bottles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
