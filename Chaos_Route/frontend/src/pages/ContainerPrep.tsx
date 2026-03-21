/* Page mise à disposition contenants / Container preparation page.
   Interface tactile pour magasiniers : cards visuelles, stepper +/-,
   groupage par pile, résumé avant validation.
   Touch-friendly interface for warehouse workers. */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../services/api'

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SupportType {
  id: number
  code: string
  short_code: string | null
  name: string
  unit_quantity: number  // ex: 15 par pile
  unit_label: string | null  // ex: "pile de 15"
  is_active: boolean
  image_path: string | null
  unit_value: number | null
  content_items_per_unit: number | null
  content_item_label: string | null
}

interface BaseStock {
  id: number
  base_id: number
  base_code: string
  base_name: string
  support_type_id: number
  support_type_code: string
  support_type_name: string
  unit_quantity: number
  unit_label: string | null
  current_stock: number
  last_updated_at: string | null
}

interface Base {
  id: number
  code: string
  name: string
}

interface PrepLine {
  support_type_id: number
  support_type: SupportType
  quantity: number       // unités individuelles
  available_stock: number
}

/* ─── Composant carte support / Support card ─────────────────────────── */

function SupportCard({ line, onChange }: {
  line: PrepLine
  onChange: (qty: number) => void
}) {
  const st = line.support_type
  const stacks = st.unit_quantity > 1 ? Math.floor(line.quantity / st.unit_quantity) : 0
  const remainder = st.unit_quantity > 1 ? line.quantity % st.unit_quantity : line.quantity
  const pctUsed = line.available_stock > 0 ? Math.round((line.quantity / line.available_stock) * 100) : 0

  const increment = (delta: number) => {
    const next = Math.max(0, Math.min(line.available_stock, line.quantity + delta))
    onChange(next)
  }

  const addStack = () => {
    if (st.unit_quantity > 1) increment(st.unit_quantity)
    else increment(1)
  }

  const removeStack = () => {
    if (st.unit_quantity > 1) increment(-st.unit_quantity)
    else increment(-1)
  }

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 12, padding: '1rem',
      border: line.quantity > 0 ? '2px solid var(--accent-primary)' : '2px solid transparent',
      transition: 'border-color 0.2s',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      {/* Header avec image ou icone */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 8, background: 'var(--bg-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8em', flexShrink: 0,
        }}>
          {st.content_items_per_unit ? '🍺' : '📦'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1em' }}>
            {st.short_code || st.code}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>{st.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>
            Stock: <b style={{ color: line.available_stock <= 10 ? '#ef4444' : 'var(--text-primary)' }}>
              {line.available_stock}
            </b>
            {st.unit_quantity > 1 && ` (${Math.floor(line.available_stock / st.unit_quantity)} ${st.unit_label || 'piles'})`}
          </div>
        </div>
      </div>

      {/* Stepper unités */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <button onClick={() => increment(-1)} style={stepperBtnStyle('#ef4444')} disabled={line.quantity <= 0}>-1</button>
        <input
          type="number"
          value={line.quantity}
          onChange={e => onChange(Math.max(0, Math.min(line.available_stock, Number(e.target.value) || 0)))}
          style={{
            width: 70, textAlign: 'center', padding: '8px', borderRadius: 8,
            border: '1px solid var(--border-primary)', background: 'var(--bg-primary)',
            color: 'var(--text-primary)', fontSize: '1.2em', fontWeight: 700,
          }}
        />
        <button onClick={() => increment(1)} style={stepperBtnStyle('#22c55e')} disabled={line.quantity >= line.available_stock}>+1</button>
      </div>

      {/* Stepper piles (si unit_quantity > 1) */}
      {st.unit_quantity > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <button onClick={removeStack} style={stepperBtnStyle('#f59e0b', true)} disabled={line.quantity < st.unit_quantity}>
            -{st.unit_quantity}
          </button>
          <div style={{
            textAlign: 'center', minWidth: 90, padding: '6px 8px', borderRadius: 8,
            background: stacks > 0 ? 'var(--accent-primary)' : 'var(--bg-primary)',
            color: stacks > 0 ? '#fff' : 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.9em',
          }}>
            {stacks} {st.unit_label || 'pile(s)'}
            {remainder > 0 && ` + ${remainder}`}
          </div>
          <button onClick={addStack} style={stepperBtnStyle('#f59e0b', true)} disabled={line.quantity + st.unit_quantity > line.available_stock}>
            +{st.unit_quantity}
          </button>
        </div>
      )}

      {/* Barre progression */}
      {line.quantity > 0 && (
        <div style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, pctUsed)}%`, height: '100%', borderRadius: 4,
            background: pctUsed > 80 ? '#ef4444' : pctUsed > 50 ? '#f59e0b' : 'var(--accent-primary)',
            transition: 'width 0.2s',
          }} />
        </div>
      )}

      {/* Valeur consigne */}
      {st.unit_value && line.quantity > 0 && (
        <div style={{ textAlign: 'center', fontSize: '0.8em', color: 'var(--text-muted)' }}>
          Valeur: <b style={{ color: 'var(--text-primary)' }}>{(line.quantity * st.unit_value).toFixed(2)} EUR</b>
        </div>
      )}
    </div>
  )
}

const stepperBtnStyle = (color: string, large = false): React.CSSProperties => ({
  width: large ? 52 : 44, height: 44, borderRadius: 8, border: 'none',
  background: `${color}22`, color, cursor: 'pointer',
  fontWeight: 700, fontSize: large ? '0.85em' : '1em',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
})

/* ─── Composant principal / Main component ───────────────────────────── */

export default function ContainerPrep() {
  const [bases, setBases] = useState<Base[]>([])
  const [selectedBase, setSelectedBase] = useState<number | ''>('')
  const [stocks, setStocks] = useState<BaseStock[]>([])
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [lines, setLines] = useState<PrepLine[]>([])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  /* ─── Fetch data ─────────────────────────────────────────────────── */

  const fetchRefs = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        apiFetch('/api/bases/'), apiFetch('/api/support-types/'),
      ])
      setBases(b || [])
      setSupportTypes((s || []).filter((st: SupportType) => st.is_active))
    } catch { /* non-bloquant */ }
  }, [])

  const fetchStock = useCallback(async () => {
    if (!selectedBase) { setStocks([]); setLines([]); return }
    try {
      const data = await apiFetch(`/api/base-container-stock/?base_id=${selectedBase}`)
      setStocks(data || [])
    } catch { /* non-bloquant */ }
  }, [selectedBase])

  useEffect(() => { fetchRefs() }, [fetchRefs])
  useEffect(() => { fetchStock() }, [fetchStock])

  // Construire les lignes de préparation quand stock ou types changent
  useEffect(() => {
    if (!stocks.length || !supportTypes.length) { setLines([]); return }
    const newLines: PrepLine[] = supportTypes.map(st => {
      const stock = stocks.find(s => s.support_type_id === st.id)
      return {
        support_type_id: st.id,
        support_type: st,
        quantity: 0,
        available_stock: stock?.current_stock || 0,
      }
    }).filter(l => l.available_stock > 0)
    setLines(newLines)
  }, [stocks, supportTypes])

  /* ─── Handlers ─────────────────────────────────────────────────────── */

  const updateQty = (stId: number, qty: number) => {
    setLines(prev => prev.map(l => l.support_type_id === stId ? { ...l, quantity: qty } : l))
  }

  const activeLines = lines.filter(l => l.quantity > 0)
  const totalUnits = activeLines.reduce((s, l) => s + l.quantity, 0)
  const totalValue = activeLines.reduce((s, l) => {
    const uv = l.support_type.unit_value || 0
    return s + l.quantity * uv
  }, 0)

  const handleSubmit = async () => {
    if (!selectedBase || activeLines.length === 0) return
    setSubmitting(true)
    setResult(null)
    try {
      const payload = {
        base_id: Number(selectedBase),
        lines: activeLines.map(l => ({
          support_type_id: l.support_type_id,
          quantity: l.quantity,
          stacks: l.support_type.unit_quantity > 1 ? Math.floor(l.quantity / l.support_type.unit_quantity) : 0,
        })),
        reference: reference || null,
        notes: notes || null,
      }
      await apiFetch('/api/base-container-stock/prep-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setResult(`Preparation validee : ${totalUnits} unites sorties`)
      setShowSummary(false)
      // Reset quantities
      setLines(prev => prev.map(l => ({ ...l, quantity: 0 })))
      setReference('')
      setNotes('')
      fetchStock()
    } catch (err: unknown) {
      setResult(`Erreur: ${err instanceof Error ? err.message : 'inconnue'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setLines(prev => prev.map(l => ({ ...l, quantity: 0 })))
    setReference('')
    setNotes('')
    setResult(null)
  }

  /* ─── Filtrage ─────────────────────────────────────────────────────── */

  const filteredLines = filterText
    ? lines.filter(l =>
        l.support_type.code.toLowerCase().includes(filterText.toLowerCase()) ||
        l.support_type.name.toLowerCase().includes(filterText.toLowerCase()) ||
        (l.support_type.short_code || '').toLowerCase().includes(filterText.toLowerCase())
      )
    : lines

  /* ─── Styles ───────────────────────────────────────────────────────── */

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', borderRadius: 8,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: '1em',
  }

  /* ─── Rendu / Render ───────────────────────────────────────────────── */

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '0.25rem' }}>
        Mise a disposition
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Preparation des contenants pour livraison — interface magasinier
      </p>

      {/* Sélection base + référence */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select
          value={selectedBase}
          onChange={e => setSelectedBase(e.target.value ? Number(e.target.value) : '')}
          style={{ ...inputStyle, minWidth: 220 }}
        >
          <option value="">Selectionner la base...</option>
          {bases.map(b => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
        </select>
        <input
          value={reference}
          onChange={e => setReference(e.target.value)}
          placeholder="Reference (bon de livraison, tournee...)"
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Filtrer les types..."
          style={{ ...inputStyle, minWidth: 160 }}
        />
      </div>

      {/* Message résultat */}
      {result && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem',
          background: result.startsWith('Erreur') ? '#ef444422' : '#22c55e22',
          color: result.startsWith('Erreur') ? '#ef4444' : '#22c55e',
          fontWeight: 600, fontSize: '0.9em',
        }}>
          {result}
        </div>
      )}

      {/* Grille de cards */}
      {selectedBase && filteredLines.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem', marginBottom: '1.5rem',
        }}>
          {filteredLines.map(line => (
            <SupportCard
              key={line.support_type_id}
              line={line}
              onChange={qty => updateQty(line.support_type_id, qty)}
            />
          ))}
        </div>
      )}

      {selectedBase && filteredLines.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
          {lines.length === 0 ? 'Aucun stock disponible pour cette base' : 'Aucun resultat pour ce filtre'}
        </div>
      )}

      {/* Barre résumé flottante */}
      {activeLines.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-secondary)', borderTop: '2px solid var(--accent-primary)',
          borderRadius: '12px 12px 0 0', padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.75rem',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>Types</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2em' }}>{activeLines.length}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>Unites</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2em' }}>{totalUnits}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>Valeur</div>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1.2em' }}>{totalValue.toFixed(2)} EUR</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleReset} style={{
              padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#6b728022', color: 'var(--text-primary)', fontWeight: 600,
            }}>
              Reinitialiser
            </button>
            <button onClick={() => setShowSummary(true)} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '1em',
            }}>
              Valider la preparation
            </button>
          </div>
        </div>
      )}

      {/* ─── Dialog résumé / Summary dialog ──────────────────────────── */}
      {showSummary && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }} onClick={() => setShowSummary(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem',
              width: '90%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              Resume de la preparation
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginBottom: 4 }}>
                Base: <b style={{ color: 'var(--text-primary)' }}>
                  {bases.find(b => b.id === selectedBase)?.name || '—'}
                </b>
              </div>
              {reference && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                  Ref: <b style={{ color: 'var(--text-primary)' }}>{reference}</b>
                </div>
              )}
            </div>

            {/* Lignes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {activeLines.map(l => {
                const st = l.support_type
                const stacks = st.unit_quantity > 1 ? Math.floor(l.quantity / st.unit_quantity) : 0
                const remainder = st.unit_quantity > 1 ? l.quantity % st.unit_quantity : l.quantity
                const val = (st.unit_value || 0) * l.quantity
                return (
                  <div key={l.support_type_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95em' }}>
                        {st.short_code || st.code} — {st.name}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                        {l.quantity} unites
                        {stacks > 0 && ` (${stacks} ${st.unit_label || 'piles'}${remainder > 0 ? ` + ${remainder}` : ''})`}
                      </div>
                    </div>
                    {val > 0 && (
                      <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.95em' }}>
                        {val.toFixed(2)} EUR
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Totaux */}
            <div style={{
              borderTop: '1px solid var(--border-primary)', paddingTop: '0.75rem',
              display: 'flex', justifyContent: 'space-between', marginBottom: '1rem',
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total</div>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 16 }}>{totalUnits} unites</span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>{totalValue.toFixed(2)} EUR</span>
              </div>
            </div>

            {/* Notes */}
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optionnel)..."
              style={{ ...inputStyle, width: '100%', minHeight: 50, resize: 'vertical', marginBottom: '1rem' }}
            />

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSummary(false)} style={{
                padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#6b728022', color: 'var(--text-primary)', fontWeight: 600,
              }}>
                Modifier
              </button>
              <button onClick={handleSubmit} disabled={submitting} style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '1em',
                opacity: submitting ? 0.6 : 1,
              }}>
                {submitting ? 'Enregistrement...' : 'Confirmer et sortir du stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
