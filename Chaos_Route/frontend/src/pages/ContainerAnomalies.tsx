/* Anomalies contenants — vue kanban / Container anomalies — kanban view.
   3 colonnes : A traiter | En cours | Résolu
   + dialog création + détail avec photos/commentaires */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../services/api'

/* ─── Types ──────────────────────────────────────────────────────────── */

interface AnomalyDetail {
  id: number
  pdv_id: number | null
  pdv_code: string | null
  pdv_name: string | null
  base_id: number | null
  base_name: string | null
  support_type_id: number | null
  support_type_code: string | null
  support_type_name: string | null
  category: string
  severity: string
  status: string
  title: string
  description: string | null
  quantity_expected: number | null
  quantity_actual: number | null
  financial_impact: number | null
  reference: string | null
  created_at: string
  created_by_name: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  started_at: string | null
  resolved_at: string | null
  resolution_notes: string | null
  due_date: string | null
  delay_hours: number | null
  photo_count: number
  comment_count: number
}

interface KanbanBoard {
  open: AnomalyDetail[]
  in_progress: AnomalyDetail[]
  resolved: AnomalyDetail[]
  stats: { total: number; open: number; critical: number; total_impact: number }
}

interface CommentRead {
  id: number
  user_name: string | null
  content: string
  created_at: string
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  MISSING: 'Manquants', DAMAGED: 'Endommages', SURPLUS: 'Excedent',
  WRONG_TYPE: 'Mauvais type', DISPUTE: 'Litige', EXPIRED: 'Hors service', OTHER: 'Autre',
}
const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#3b82f6', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'A traiter', IN_PROGRESS: 'En cours', RESOLVED: 'Resolu', CLOSED: 'Classe',
}
const COLUMN_COLORS: Record<string, string> = {
  OPEN: '#ef4444', IN_PROGRESS: '#f59e0b', RESOLVED: '#22c55e',
}

/* ─── Composant carte anomalie / Anomaly card ────────────────────────── */

function AnomalyCard({ item, onClick }: { item: AnomalyDetail; onClick: () => void }) {
  const sevColor = SEVERITY_COLORS[item.severity] || '#6b7280'
  const isOverdue = item.due_date && item.due_date < new Date().toISOString().slice(0, 10) && item.status !== 'RESOLVED'

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-primary)', borderRadius: 8, padding: '0.75rem',
        borderLeft: `4px solid ${sevColor}`, cursor: 'pointer',
        marginBottom: '0.5rem', transition: 'transform 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9em', color: 'var(--text-primary)', flex: 1 }}>
          {item.title}
        </div>
        <span style={{
          fontSize: '0.7em', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: `${sevColor}22`, color: sevColor,
        }}>
          {item.severity}
        </span>
      </div>

      <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: 4 }}>
        {CATEGORY_LABELS[item.category] || item.category}
        {item.pdv_code && <span> — {item.pdv_code}</span>}
        {item.support_type_code && <span> — {item.support_type_code}</span>}
      </div>

      {(item.quantity_expected != null || item.quantity_actual != null) && (
        <div style={{ fontSize: '0.8em', color: 'var(--text-muted)', marginTop: 2 }}>
          Attendu: {item.quantity_expected ?? '?'} / Reel: {item.quantity_actual ?? '?'}
          {item.quantity_expected != null && item.quantity_actual != null && (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>
              {' '}(ecart: {item.quantity_actual - item.quantity_expected})
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>
          {item.delay_hours != null && (
            <span style={{ color: item.delay_hours > 48 ? '#ef4444' : item.delay_hours > 24 ? '#f59e0b' : 'var(--text-muted)' }}>
              {item.delay_hours < 24 ? `${item.delay_hours}h` : `${Math.floor(item.delay_hours / 24)}j`}
            </span>
          )}
          {isOverdue && <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: 6 }}>EN RETARD</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: '0.75em', color: 'var(--text-muted)' }}>
          {item.financial_impact != null && item.financial_impact > 0 && (
            <span style={{ fontWeight: 600 }}>{item.financial_impact.toFixed(0)} EUR</span>
          )}
          {item.photo_count > 0 && <span>📷 {item.photo_count}</span>}
          {item.comment_count > 0 && <span>💬 {item.comment_count}</span>}
          {item.assigned_to_name && <span>→ {item.assigned_to_name}</span>}
        </div>
      </div>
    </div>
  )
}

/* ─── Composant colonne kanban / Kanban column ───────────────────────── */

function KanbanColumn({ status, items, onCardClick }: {
  status: string; items: AnomalyDetail[]; onCardClick: (a: AnomalyDetail) => void
}) {
  return (
    <div style={{
      flex: 1, minWidth: 300, background: 'var(--bg-secondary)', borderRadius: 8,
      padding: '0.75rem', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 300px)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem',
        paddingBottom: '0.5rem', borderBottom: `2px solid ${COLUMN_COLORS[status]}`,
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{STATUS_LABELS[status]}</span>
        <span style={{
          background: COLUMN_COLORS[status], color: '#fff', borderRadius: '50%',
          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8em', fontWeight: 700,
        }}>
          {items.length}
        </span>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {items.map(a => (
          <AnomalyCard key={a.id} item={a} onClick={() => onCardClick(a)} />
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.85em' }}>
            Aucune anomalie
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Composant principal / Main component ───────────────────────────── */

export default function ContainerAnomalies() {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [selected, setSelected] = useState<AnomalyDetail | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [comments, setComments] = useState<CommentRead[]>([])
  const [newComment, setNewComment] = useState('')
  const [pdvs, setPdvs] = useState<{ id: number; code: string; name: string }[]>([])
  const [supportTypes, setSupportTypes] = useState<{ id: number; code: string; name: string }[]>([])
  const [users, setUsers] = useState<{ id: number; username: string }[]>([])
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')

  // Formulaire création
  const [form, setForm] = useState({
    pdv_id: '', support_type_id: '', category: 'MISSING', severity: 'MEDIUM',
    title: '', description: '', quantity_expected: '', quantity_actual: '',
    financial_impact: '', reference: '', assigned_to: '', due_date: '',
  })

  const fetchBoard = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      if (filterSeverity) params.set('severity', filterSeverity)
      const data = await apiFetch(`/api/container-anomalies/board/?${params}`)
      setBoard(data)
    } catch { /* non-bloquant */ }
  }, [filterCategory, filterSeverity])

  const fetchRefs = useCallback(async () => {
    try {
      const [p, s, u] = await Promise.all([
        apiFetch('/api/pdvs/'), apiFetch('/api/support-types/'), apiFetch('/api/users/'),
      ])
      setPdvs(p || [])
      setSupportTypes(s || [])
      setUsers(u || [])
    } catch { /* non-bloquant */ }
  }, [])

  useEffect(() => { fetchBoard(); fetchRefs() }, [fetchBoard, fetchRefs])

  const fetchComments = async (anomalyId: number) => {
    try {
      const data = await apiFetch(`/api/container-anomalies/${anomalyId}/comments/`)
      setComments(data || [])
    } catch { /* non-bloquant */ }
  }

  const handleCardClick = (a: AnomalyDetail) => {
    setSelected(a)
    setComments([])  // Clear stale comments before fetching
    fetchComments(a.id)
  }

  /* ─── Actions ──────────────────────────────────────────────────────── */

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await apiFetch(`/api/container-anomalies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      fetchBoard()
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: newStatus } : null)
    } catch { /* non-bloquant */ }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return
    try {
      await apiFetch('/api/container-anomalies/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdv_id: form.pdv_id ? Number(form.pdv_id) : null,
          support_type_id: form.support_type_id ? Number(form.support_type_id) : null,
          category: form.category,
          severity: form.severity,
          title: form.title,
          description: form.description || null,
          quantity_expected: form.quantity_expected ? Number(form.quantity_expected) : null,
          quantity_actual: form.quantity_actual ? Number(form.quantity_actual) : null,
          financial_impact: form.financial_impact ? Number(form.financial_impact) : null,
          reference: form.reference || null,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          due_date: form.due_date || null,
        }),
      })
      setShowCreate(false)
      setForm({ pdv_id: '', support_type_id: '', category: 'MISSING', severity: 'MEDIUM', title: '', description: '', quantity_expected: '', quantity_actual: '', financial_impact: '', reference: '', assigned_to: '', due_date: '' })
      fetchBoard()
    } catch { /* non-bloquant */ }
  }

  const handleAddComment = async () => {
    if (!selected || !newComment.trim()) return
    try {
      await apiFetch(`/api/container-anomalies/${selected.id}/comments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })
      setNewComment('')
      fetchComments(selected.id)
    } catch { /* non-bloquant */ }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette anomalie ?')) return
    try {
      await apiFetch(`/api/container-anomalies/${id}`, { method: 'DELETE' })
      setSelected(null)
      fetchBoard()
    } catch { /* non-bloquant */ }
  }

  /* ─── Styles ───────────────────────────────────────────────────────── */

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 6,
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: '0.9em', width: '100%',
  }
  const btnStyle = (bg: string): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: bg, color: '#fff', fontWeight: 600, fontSize: '0.85em',
  })

  /* ─── Rendu / Render ───────────────────────────────────────────────── */

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', margin: 0 }}>Anomalies Contenants</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Suivi et resolution des ecarts contenants
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnStyle('var(--accent-primary)')}>
          + Signaler une anomalie
        </button>
      </div>

      {/* KPI */}
      {board && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Total actives', value: board.stats.total, color: '#3b82f6' },
            { label: 'A traiter', value: board.stats.open, color: '#ef4444' },
            { label: 'Critiques', value: board.stats.critical, color: '#f97316' },
            { label: 'Impact financier', value: `${board.stats.total_impact.toLocaleString('fr-BE')} EUR`, color: '#f59e0b' },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--bg-secondary)', borderRadius: 8, padding: '0.75rem',
              borderLeft: `3px solid ${k.color}`,
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75em' }}>{k.label}</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.2em', fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="">Toutes categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="">Toutes severites</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Board kanban */}
      {board && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <KanbanColumn status="OPEN" items={board.open} onCardClick={handleCardClick} />
          <KanbanColumn status="IN_PROGRESS" items={board.in_progress} onCardClick={handleCardClick} />
          <KanbanColumn status="RESOLVED" items={board.resolved} onCardClick={handleCardClick} />
        </div>
      )}

      {/* ─── Dialog détail anomalie ──────────────────────────────────── */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '5vh',
        }} onClick={() => setSelected(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem',
              width: '90%', maxWidth: 650, maxHeight: '85vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>{selected.title}</h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginTop: 4 }}>
                  {CATEGORY_LABELS[selected.category]} — {selected.severity}
                  {selected.pdv_code && ` — ${selected.pdv_code} ${selected.pdv_name}`}
                  {selected.support_type_name && ` — ${selected.support_type_name}`}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5em', cursor: 'pointer' }}>x</button>
            </div>

            {selected.description && (
              <p style={{ color: 'var(--text-primary)', margin: '1rem 0 0.5rem', fontSize: '0.9em' }}>{selected.description}</p>
            )}

            {/* Infos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '1rem 0', fontSize: '0.85em' }}>
              {selected.quantity_expected != null && <div style={{ color: 'var(--text-muted)' }}>Attendu: <b style={{ color: 'var(--text-primary)' }}>{selected.quantity_expected}</b></div>}
              {selected.quantity_actual != null && <div style={{ color: 'var(--text-muted)' }}>Reel: <b style={{ color: 'var(--text-primary)' }}>{selected.quantity_actual}</b></div>}
              {selected.financial_impact != null && <div style={{ color: 'var(--text-muted)' }}>Impact: <b style={{ color: '#ef4444' }}>{selected.financial_impact.toFixed(2)} EUR</b></div>}
              {selected.reference && <div style={{ color: 'var(--text-muted)' }}>Ref: <b style={{ color: 'var(--text-primary)' }}>{selected.reference}</b></div>}
              <div style={{ color: 'var(--text-muted)' }}>Cree le: <b style={{ color: 'var(--text-primary)' }}>{selected.created_at.slice(0, 10)}</b></div>
              {selected.created_by_name && <div style={{ color: 'var(--text-muted)' }}>Par: <b style={{ color: 'var(--text-primary)' }}>{selected.created_by_name}</b></div>}
              {selected.assigned_to_name && <div style={{ color: 'var(--text-muted)' }}>Assigne a: <b style={{ color: 'var(--text-primary)' }}>{selected.assigned_to_name}</b></div>}
              {selected.due_date && <div style={{ color: 'var(--text-muted)' }}>Echeance: <b style={{ color: selected.due_date < new Date().toISOString().slice(0, 10) ? '#ef4444' : 'var(--text-primary)' }}>{selected.due_date}</b></div>}
              {selected.delay_hours != null && <div style={{ color: 'var(--text-muted)' }}>Ouvert depuis: <b style={{ color: selected.delay_hours > 48 ? '#ef4444' : 'var(--text-primary)' }}>{selected.delay_hours < 24 ? `${selected.delay_hours}h` : `${Math.floor(selected.delay_hours / 24)} jours`}</b></div>}
              {selected.resolved_at && <div style={{ color: 'var(--text-muted)' }}>Resolu le: <b style={{ color: '#22c55e' }}>{selected.resolved_at.slice(0, 10)}</b></div>}
            </div>

            {selected.resolution_notes && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '0.75rem', margin: '0.5rem 0', fontSize: '0.85em' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Resolution:</div>
                <div style={{ color: 'var(--text-primary)' }}>{selected.resolution_notes}</div>
              </div>
            )}

            {/* Boutons workflow */}
            <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0', flexWrap: 'wrap' }}>
              {selected.status === 'OPEN' && (
                <button onClick={() => handleStatusChange(selected.id, 'IN_PROGRESS')} style={btnStyle('#f59e0b')}>
                  Prendre en charge
                </button>
              )}
              {(selected.status === 'OPEN' || selected.status === 'IN_PROGRESS') && (
                <button onClick={() => {
                  const notes = prompt('Notes de resolution:')
                  if (notes !== null) {
                    apiFetch(`/api/container-anomalies/${selected.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'RESOLVED', resolution_notes: notes }),
                    }).then(() => { fetchBoard(); setSelected(null) })
                  }
                }} style={btnStyle('#22c55e')}>
                  Marquer resolu
                </button>
              )}
              {selected.status === 'RESOLVED' && (
                <button onClick={() => handleStatusChange(selected.id, 'CLOSED')} style={btnStyle('#6b7280')}>
                  Classer
                </button>
              )}
              <button onClick={() => handleDelete(selected.id)} style={btnStyle('#ef4444')}>
                Supprimer
              </button>
            </div>

            {/* Commentaires */}
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1em', margin: '0 0 0.5rem' }}>
                Commentaires ({comments.length})
              </h3>
              {comments.map(c => (
                <div key={c.id} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.85em' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8em' }}>
                    {c.user_name || 'Anonyme'} — {c.created_at.slice(0, 16).replace('T', ' ')}
                  </div>
                  <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>{c.content}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  value={newComment} onChange={e => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                />
                <button onClick={handleAddComment} style={btnStyle('var(--accent-primary)')}>Envoyer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Dialog création ─────────────────────────────────────────── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '5vh',
        }} onClick={() => setShowCreate(false)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleCreate}
            style={{
              background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem',
              width: '90%', maxWidth: 550, maxHeight: '85vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
            }}
          >
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>Signaler une anomalie</h2>

            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre *" style={inputStyle} required />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={inputStyle}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <select value={form.pdv_id} onChange={e => setForm(f => ({ ...f, pdv_id: e.target.value }))} style={inputStyle}>
                <option value="">PDV (optionnel)</option>
                {pdvs.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
              <select value={form.support_type_id} onChange={e => setForm(f => ({ ...f, support_type_id: e.target.value }))} style={inputStyle}>
                <option value="">Type support (opt.)</option>
                {supportTypes.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>

            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description..." style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <input type="number" value={form.quantity_expected} onChange={e => setForm(f => ({ ...f, quantity_expected: e.target.value }))} placeholder="Qte attendue" style={inputStyle} />
              <input type="number" value={form.quantity_actual} onChange={e => setForm(f => ({ ...f, quantity_actual: e.target.value }))} placeholder="Qte reelle" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <input type="number" step="0.01" value={form.financial_impact} onChange={e => setForm(f => ({ ...f, financial_impact: e.target.value }))} placeholder="Impact EUR" style={inputStyle} />
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Reference" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={inputStyle}>
                <option value="">Assigner a (opt.)</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
              </select>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)} style={btnStyle('#6b7280')}>Annuler</button>
              <button type="submit" style={btnStyle('var(--accent-primary)')}>Creer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
