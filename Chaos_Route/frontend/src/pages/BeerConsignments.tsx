/* Page consignes bière / Beer consignment tracking page.
   3 onglets : Soldes PDV | Historique transactions | Nouvelle transaction
   Tabs: PDV balances | Transaction history | New transaction */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../services/api'

/* ─── Types locaux / Local types ─────────────────────────────────────── */

interface BeerBalanceDetail {
  pdv_id: number
  pdv_code: string
  pdv_name: string
  support_type_id: number
  support_type_code: string
  support_type_name: string
  unit_value: number | null
  bottles_per_crate: number | null
  bottle_value: number | null
  crate_balance: number
  loose_bottle_balance: number
  total_delivered: number
  total_returned: number
  total_write_off: number
  balance_value: number
  last_delivery_date: string | null
  last_return_date: string | null
}

interface BeerTxDetail {
  id: number
  pdv_id: number
  pdv_code: string
  pdv_name: string
  support_type_id: number
  support_type_code: string
  support_type_name: string
  transaction_type: string
  crate_qty: number
  loose_bottle_qty: number
  unit_value_snapshot: number | null
  bottle_value_snapshot: number | null
  financial_value: number
  reference: string | null
  transaction_date: string
  created_at: string
  notes: string | null
}

interface BeerStats {
  pdv_with_balance: number
  total_crate_balance: number
  total_delivered: number
  total_returned: number
  total_write_off: number
  total_balance_value: number
  return_rate: number
}

interface SupportType {
  id: number
  code: string
  name: string
  content_items_per_unit?: number | null
}

interface Pdv {
  id: number
  code: string
  name: string
}

const TX_TYPE_LABELS: Record<string, string> = {
  DELIVERY: 'Livraison',
  RETURN: 'Retour vidanges',
  ADJUSTMENT: 'Correction',
  WRITE_OFF: 'Perte / casse',
}

const TX_TYPE_COLORS: Record<string, string> = {
  DELIVERY: '#3b82f6',
  RETURN: '#22c55e',
  ADJUSTMENT: '#f59e0b',
  WRITE_OFF: '#ef4444',
}

/* ─── Composant principal / Main component ───────────────────────────── */

export default function BeerConsignments() {
  const [tab, setTab] = useState<'balances' | 'history' | 'new'>('balances')
  const [balances, setBalances] = useState<BeerBalanceDetail[]>([])
  const [txHistory, setTxHistory] = useState<BeerTxDetail[]>([])
  const [stats, setStats] = useState<BeerStats | null>(null)
  const [supportTypes, setSupportTypes] = useState<SupportType[]>([])
  const [pdvs, setPdvs] = useState<Pdv[]>([])
  const [filterST, setFilterST] = useState<number | ''>('')
  const [filterPdv, setFilterPdv] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)

  // Form state pour nouvelle transaction
  const [form, setForm] = useState({
    pdv_id: '',
    support_type_id: '',
    transaction_type: 'DELIVERY',
    crate_qty: '',
    loose_bottle_qty: '0',
    reference: '',
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  /* ─── Fetch data ───────────────────────────────────────────────────── */

  const fetchBalances = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterST) params.set('support_type_id', String(filterST))
      if (filterPdv) params.set('pdv_id', String(filterPdv))
      const data = await apiFetch(`/api/beer-consignments/balances/?${params}`)
      setBalances(data.items || [])
    } catch { /* non-bloquant */ }
  }, [filterST, filterPdv])

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterST) params.set('support_type_id', String(filterST))
      if (filterPdv) params.set('pdv_id', String(filterPdv))
      const data = await apiFetch(`/api/beer-consignments/transactions/?${params}`)
      setTxHistory(data || [])
    } catch { /* non-bloquant */ }
  }, [filterST, filterPdv])

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/beer-consignments/stats/')
      setStats(data)
    } catch { /* non-bloquant */ }
  }, [])

  const fetchRefs = useCallback(async () => {
    try {
      const [stData, pdvData] = await Promise.all([
        apiFetch('/api/support-types/'),
        apiFetch('/api/pdvs/'),
      ])
      // Filtrer les types support qui ont content_items_per_unit (= casiers bière)
      const beerTypes = (stData || []).filter((s: SupportType) => s.content_items_per_unit && s.content_items_per_unit > 0)
      setSupportTypes(beerTypes.length > 0 ? beerTypes : stData || [])
      setPdvs(pdvData || [])
    } catch { /* non-bloquant */ }
  }, [])

  useEffect(() => {
    fetchRefs()
    fetchStats()
  }, [fetchRefs, fetchStats])

  useEffect(() => {
    if (tab === 'balances') fetchBalances()
    if (tab === 'history') fetchHistory()
  }, [tab, fetchBalances, fetchHistory])

  /* ─── Soumission nouvelle transaction / Submit new transaction ──── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')
    if (!form.pdv_id || !form.support_type_id || !form.crate_qty) {
      setFormError('PDV, type de casier et quantite sont requis')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/beer-consignments/transactions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdv_id: Number(form.pdv_id),
          support_type_id: Number(form.support_type_id),
          transaction_type: form.transaction_type,
          crate_qty: Number(form.crate_qty),
          loose_bottle_qty: Number(form.loose_bottle_qty) || 0,
          reference: form.reference || null,
          transaction_date: form.transaction_date,
          notes: form.notes || null,
        }),
      })
      setFormSuccess('Transaction enregistree')
      setForm(f => ({ ...f, crate_qty: '', loose_bottle_qty: '0', reference: '', notes: '' }))
      fetchStats()
      if (tab === 'balances') fetchBalances()
      if (tab === 'history') fetchHistory()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  /* ─── Suppression transaction / Delete transaction ─────────────── */

  const handleDelete = async (txId: number) => {
    if (!confirm('Supprimer cette transaction ? Le solde sera recalcule.')) return
    try {
      await apiFetch(`/api/beer-consignments/transactions/${txId}`, { method: 'DELETE' })
      fetchHistory()
      fetchBalances()
      fetchStats()
    } catch { /* non-bloquant */ }
  }

  /* ─── KPI cards ────────────────────────────────────────────────────── */

  const kpiCards = stats ? [
    { label: 'PDV avec solde', value: stats.pdv_with_balance, color: '#3b82f6' },
    { label: 'Casiers en circulation', value: stats.total_crate_balance.toLocaleString('fr-BE'), color: '#f59e0b' },
    { label: 'Valeur immobilisee', value: `${stats.total_balance_value.toLocaleString('fr-BE', { minimumFractionDigits: 2 })} EUR`, color: '#ef4444' },
    { label: 'Total livres', value: stats.total_delivered.toLocaleString('fr-BE'), color: '#3b82f6' },
    { label: 'Total retournes', value: stats.total_returned.toLocaleString('fr-BE'), color: '#22c55e' },
    { label: 'Taux retour', value: `${stats.return_rate}%`, color: stats.return_rate >= 90 ? '#22c55e' : stats.return_rate >= 70 ? '#f59e0b' : '#ef4444' },
  ] : []

  /* ─── Colonnes tables ─────────────────────────────────────────────── */

  const balanceCols = [
    { key: 'pdv_code', header: 'PDV' },
    { key: 'pdv_name', header: 'Nom PDV' },
    { key: 'support_type_name', header: 'Type casier' },
    { key: 'crate_balance', header: 'Solde casiers', render: (r: BeerBalanceDetail) => (
      <span style={{ color: r.crate_balance > 0 ? '#f59e0b' : r.crate_balance < 0 ? '#ef4444' : 'var(--text-primary)', fontWeight: 600 }}>
        {r.crate_balance}
      </span>
    )},
    { key: 'loose_bottle_balance', header: 'Bouteilles isolees' },
    { key: 'total_delivered', header: 'Livres' },
    { key: 'total_returned', header: 'Retournes' },
    { key: 'total_write_off', header: 'Pertes' },
    { key: 'balance_value', header: 'Valeur EUR', render: (r: BeerBalanceDetail) => (
      <span style={{ fontWeight: 600 }}>{r.balance_value.toLocaleString('fr-BE', { minimumFractionDigits: 2 })}</span>
    )},
    { key: 'last_delivery_date', header: 'Dern. livraison' },
    { key: 'last_return_date', header: 'Dern. retour' },
  ]

  const txCols = [
    { key: 'transaction_date', header: 'Date' },
    { key: 'pdv_code', header: 'PDV' },
    { key: 'support_type_name', header: 'Type casier' },
    { key: 'transaction_type', header: 'Type', render: (r: BeerTxDetail) => (
      <span style={{
        padding: '2px 8px', borderRadius: 4, fontSize: '0.85em', fontWeight: 600,
        background: `${TX_TYPE_COLORS[r.transaction_type]}22`,
        color: TX_TYPE_COLORS[r.transaction_type],
      }}>
        {TX_TYPE_LABELS[r.transaction_type] || r.transaction_type}
      </span>
    )},
    { key: 'crate_qty', header: 'Casiers', render: (r: BeerTxDetail) => (
      <span style={{ fontWeight: 600, color: r.crate_qty >= 0 ? '#3b82f6' : '#ef4444' }}>
        {r.crate_qty >= 0 ? `+${r.crate_qty}` : r.crate_qty}
      </span>
    )},
    { key: 'loose_bottle_qty', header: 'Bouteilles' },
    { key: 'financial_value', header: 'Valeur EUR', render: (r: BeerTxDetail) => (
      <span style={{ fontWeight: 600 }}>{r.financial_value.toLocaleString('fr-BE', { minimumFractionDigits: 2 })}</span>
    )},
    { key: 'reference', header: 'Reference' },
    { key: 'notes', header: 'Notes' },
    { key: 'actions', header: '', render: (r: BeerTxDetail) => (
      <button
        onClick={() => handleDelete(r.id)}
        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85em' }}
        title="Supprimer"
      >Suppr.</button>
    )},
  ]

  /* ─── Rendu / Render ───────────────────────────────────────────────── */

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 6,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: '0.9em',
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
        Consignes Biere
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Suivi des casiers livres et retournes par point de vente
      </p>

      {/* KPI */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {kpiCards.map(k => (
            <div key={k.label} style={{
              background: 'var(--bg-secondary)', borderRadius: 8, padding: '1rem',
              borderLeft: `4px solid ${k.color}`,
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.3em', fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['balances', 'history', 'new'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: tab === t ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            color: tab === t ? '#fff' : 'var(--text-primary)',
            fontWeight: tab === t ? 700 : 400,
          }}>
            {t === 'balances' ? 'Soldes PDV' : t === 'history' ? 'Historique' : 'Nouvelle transaction'}
          </button>
        ))}
      </div>

      {/* Filtres */}
      {tab !== 'new' && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <select value={filterST} onChange={e => setFilterST(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
            <option value="">Tous les casiers</option>
            {supportTypes.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <select value={filterPdv} onChange={e => setFilterPdv(e.target.value ? Number(e.target.value) : '')} style={inputStyle}>
            <option value="">Tous les PDV</option>
            {pdvs.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
      )}

      {/* Tab content */}
      {tab === 'balances' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                {balanceCols.map(c => <th key={c.key} style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {balances.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {balanceCols.map(c => <td key={c.key} style={{ padding: '8px', color: 'var(--text-primary)' }}>{c.render ? c.render(r) : (r as unknown as Record<string, unknown>)[c.key] as string}</td>)}
                </tr>
              ))}
              {balances.length === 0 && <tr><td colSpan={balanceCols.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnee</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
                {txCols.map(c => <th key={c.key} style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {txHistory.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {txCols.map(c => <td key={c.key} style={{ padding: '8px', color: 'var(--text-primary)' }}>{c.render ? c.render(r) : (r as unknown as Record<string, unknown>)[c.key] as string}</td>)}
                </tr>
              ))}
              {txHistory.length === 0 && <tr><td colSpan={txCols.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune donnee</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'new' && (
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-secondary)', borderRadius: 8, padding: '1.5rem',
          maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 4, fontSize: '0.85em' }}>PDV *</div>
              <select value={form.pdv_id} onChange={e => setForm(f => ({ ...f, pdv_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }} required>
                <option value="">Selectionner...</option>
                {pdvs.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </label>
            <label style={{ color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Type de casier *</div>
              <select value={form.support_type_id} onChange={e => setForm(f => ({ ...f, support_type_id: e.target.value }))} style={{ ...inputStyle, width: '100%' }} required>
                <option value="">Selectionner...</option>
                {supportTypes.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Type de transaction *</div>
              <select value={form.transaction_type} onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
                <option value="DELIVERY">Livraison</option>
                <option value="RETURN">Retour vidanges</option>
                <option value="ADJUSTMENT">Correction inventaire</option>
                <option value="WRITE_OFF">Perte / casse</option>
              </select>
            </label>
            <label style={{ color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Date *</div>
              <input type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} style={{ ...inputStyle, width: '100%' }} required />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Quantite casiers *</div>
              <input type="number" value={form.crate_qty} onChange={e => setForm(f => ({ ...f, crate_qty: e.target.value }))} style={{ ...inputStyle, width: '100%' }} required min={0} />
            </label>
            <label style={{ color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Bouteilles isolees</div>
              <input type="number" value={form.loose_bottle_qty} onChange={e => setForm(f => ({ ...f, loose_bottle_qty: e.target.value }))} style={{ ...inputStyle, width: '100%' }} min={0} />
            </label>
          </div>

          <label style={{ color: 'var(--text-primary)' }}>
            <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Reference (bon de livraison, n. tournee...)</div>
            <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} style={{ ...inputStyle, width: '100%' }} />
          </label>

          <label style={{ color: 'var(--text-primary)' }}>
            <div style={{ marginBottom: 4, fontSize: '0.85em' }}>Notes</div>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical' }} />
          </label>

          {formError && <div style={{ color: '#ef4444', fontSize: '0.9em' }}>{formError}</div>}
          {formSuccess && <div style={{ color: '#22c55e', fontSize: '0.9em' }}>{formSuccess}</div>}

          <button type="submit" disabled={loading} style={{
            padding: '10px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--accent-primary)', color: '#fff', fontWeight: 700,
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Enregistrement...' : 'Enregistrer la transaction'}
          </button>
        </form>
      )}
    </div>
  )
}
