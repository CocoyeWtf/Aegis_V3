/* Rapport consolidé contenants / Consolidated container report.
   KPI agrégés, sections thématiques, export CSV, impression.
   Aggregated KPIs, themed sections, CSV export, print. */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../services/api'
import api from '../services/api'

/* ─── Types ──────────────────────────────────────────────────────────── */

interface ReportSummary {
  generated_at: string
  base_stock: {
    total_units: number
    by_type: { code: string; name: string; stock: number }[]
  }
  pdv_stock: {
    total_units: number
    pdv_count: number
    puo_overage_count: number
    puo_overage_units: number
  }
  beer_consignments: {
    crate_balance: number
    total_delivered: number
    total_returned: number
    pdv_count: number
    return_rate: number
  }
  bottle_sorting_30d: {
    sessions: number
    total_crates: number
    total_bottles: number
  }
  anomalies: {
    total_active: number
    open: number
    critical: number
    total_impact: number
  }
  movements_7d: Record<string, number>
}

const MVT_LABELS: Record<string, string> = {
  RECEIVED_FROM_PDV: 'Reception PDV',
  DELIVERY_PREP: 'Sortie preparation',
  SUPPLIER_RETURN: 'Retour fournisseur',
  INVENTORY_ADJUSTMENT: 'Ajustement',
  BASE_INVENTORY: 'Inventaire',
}

/* ─── Composant section / Section component ──────────────────────────── */

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 10, padding: '1.25rem',
      borderTop: `3px solid ${color}`, marginBottom: '1.25rem',
    }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', margin: '0 0 1rem', fontWeight: 700 }}>{title}</h2>
      {children}
    </div>
  )
}

function Metric({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.75em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1.4em', fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString('fr-BE') : value}
        {unit && <span style={{ fontSize: '0.6em', fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 8, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  )
}

/* ─── Composant principal / Main component ───────────────────────────── */

export default function ContainerReport() {
  const [data, setData] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/container-report/summary/')
      setData(res)
    } catch { /* non-bloquant */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  const handleExportCsv = async () => {
    try {
      const res = await api.get('/container-report/export-csv/', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport_contenants_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
  }

  const handlePrint = () => window.print()

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chargement du rapport...</div>
  }
  if (!data) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Erreur chargement</div>
  }

  const totalMvt7d = Object.values(data.movements_7d).reduce((s, v) => s + v, 0)

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1000, margin: '0 auto' }} className="print-report">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', margin: 0 }}>Rapport Contenants</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85em', margin: '4px 0 0' }}>
            Genere le {new Date(data.generated_at).toLocaleDateString('fr-BE')} a {new Date(data.generated_at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }} className="no-print">
          <button onClick={fetchReport} style={actionBtn('#6b7280')}>Actualiser</button>
          <button onClick={handleExportCsv} style={actionBtn('#3b82f6')}>Export CSV</button>
          <button onClick={handlePrint} style={actionBtn('var(--accent-primary)')}>Imprimer</button>
        </div>
      </div>

      {/* ─── Section 1: Stock Base ───────────────────────────────────── */}
      <Section title="Stock Base Logistique" color="#3b82f6">
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <Metric label="Total unites en stock" value={data.base_stock.total_units} color="#3b82f6" />
          <Metric label="Types de support" value={data.base_stock.by_type.length} />
          <Metric label="Mouvements 7j" value={totalMvt7d} />
        </div>
        {data.base_stock.by_type.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {data.base_stock.by_type.map(t => (
              <div key={t.code} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem',
                background: 'var(--bg-primary)', borderRadius: 6,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85em', flex: 1 }}>
                  {t.code}
                </span>
                <span style={{ fontWeight: 700, color: '#3b82f6' }}>{t.stock.toLocaleString('fr-BE')}</span>
              </div>
            ))}
          </div>
        )}
        {totalMvt7d > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginBottom: 4 }}>Mouvements 7 derniers jours</div>
            {Object.entries(data.movements_7d).map(([type, qty]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.8em', color: 'var(--text-muted)', minWidth: 140 }}>{MVT_LABELS[type] || type}</span>
                <ProgressBar value={qty} max={totalMvt7d} color="#3b82f6" />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85em', minWidth: 40, textAlign: 'right' }}>{qty}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── Section 2: Stock PDV ────────────────────────────────────── */}
      <Section title="Stock PDV" color="#22c55e">
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Metric label="Total unites chez PDV" value={data.pdv_stock.total_units} color="#22c55e" />
          <Metric label="PDV concernes" value={data.pdv_stock.pdv_count} />
          <Metric label="Depassements PUO" value={data.pdv_stock.puo_overage_count} color={data.pdv_stock.puo_overage_count > 0 ? '#ef4444' : '#22c55e'} />
          <Metric label="Unites en depassement" value={data.pdv_stock.puo_overage_units} color="#f59e0b" />
        </div>
      </Section>

      {/* ─── Section 3: Consignes Bière ──────────────────────────────── */}
      <Section title="Consignes Biere" color="#f59e0b">
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Metric label="Casiers en circulation" value={data.beer_consignments.crate_balance} color="#f59e0b" />
          <Metric label="Total livres" value={data.beer_consignments.total_delivered} color="#3b82f6" />
          <Metric label="Total retournes" value={data.beer_consignments.total_returned} color="#22c55e" />
          <Metric label="PDV avec solde" value={data.beer_consignments.pdv_count} />
          <Metric
            label="Taux de retour"
            value={`${data.beer_consignments.return_rate}%`}
            color={data.beer_consignments.return_rate >= 90 ? '#22c55e' : data.beer_consignments.return_rate >= 70 ? '#f59e0b' : '#ef4444'}
          />
        </div>
      </Section>

      {/* ─── Section 4: Tri Vidanges ─────────────────────────────────── */}
      <Section title="Tri Vidanges — 30 derniers jours" color="#8b5cf6">
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Metric label="Sessions completees" value={data.bottle_sorting_30d.sessions} color="#8b5cf6" />
          <Metric label="Casiers tries" value={data.bottle_sorting_30d.total_crates} />
          <Metric label="Bouteilles triees" value={data.bottle_sorting_30d.total_bottles} />
        </div>
      </Section>

      {/* ─── Section 5: Anomalies ────────────────────────────────────── */}
      <Section title="Anomalies Contenants" color="#ef4444">
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Metric label="Anomalies actives" value={data.anomalies.total_active} color={data.anomalies.total_active > 0 ? '#ef4444' : '#22c55e'} />
          <Metric label="A traiter" value={data.anomalies.open} color={data.anomalies.open > 0 ? '#ef4444' : '#22c55e'} />
          <Metric label="Critiques" value={data.anomalies.critical} color={data.anomalies.critical > 0 ? '#ef4444' : '#22c55e'} />
          <Metric label="Impact financier" value={`${data.anomalies.total_impact.toLocaleString('fr-BE', { minimumFractionDigits: 2 })}`} unit="EUR" color="#f59e0b" />
        </div>
      </Section>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-report { max-width: 100% !important; padding: 0 !important; }
          body { background: white !important; color: black !important; }
          * { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  )
}

const actionBtn = (bg: string): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: bg, color: '#fff', fontWeight: 600, fontSize: '0.85em',
})
