/* Modale de création de ticket — réutilisée par le bouton flottant « Signaler »
   et par le bouton « + Nouveau ticket » du board. Capture le contexte à l'envoi. */

import { useState } from 'react'
import api from '../../services/api'
import { captureContext } from '../../services/supportContext'
import { useAppStore } from '../../stores/useAppStore'
import type { Ticket, TicketType, TicketPriority } from '../../types'

const TYPES: { v: TicketType; label: string }[] = [
  { v: 'BUG', label: '🐞 Bug' },
  { v: 'FEATURE', label: '✨ Évolution' },
  { v: 'QUESTION', label: '❓ Question' },
]
const PRIOS: { v: TicketPriority; label: string }[] = [
  { v: 'LOW', label: 'Basse' },
  { v: 'MEDIUM', label: 'Moyenne' },
  { v: 'HIGH', label: 'Haute' },
  { v: 'CRITICAL', label: 'Critique' },
]

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (ticket: Ticket) => void
}

export function CreateTicketModal({ open, onClose, onCreated }: Props) {
  const { selectedRegionId, selectedCountryId } = useAppStore()
  const [type, setType] = useState<TicketType>('BUG')
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => { setTitle(''); setDescription(''); setType('BUG'); setPriority('MEDIUM') }

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const context = captureContext({ region_id: selectedRegionId, country_id: selectedCountryId })
      const { data } = await api.post<Ticket>('/tickets/', {
        title: title.trim(),
        description: description.trim() || null,
        ticket_type: type,
        priority,
        context,
      })
      reset()
      onClose()
      onCreated?.(data)
    } catch (e) {
      console.error('Création ticket échouée', e)
      alert("Échec de la création du ticket.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Nouveau ticket</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Le contexte (écran, dernières actions, version, erreurs) est joint automatiquement.
          </p>

          <div className="flex gap-2 mb-3">
            {TYPES.map((t) => (
              <button key={t.v} onClick={() => setType(t.v)}
                className="flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={{
                  borderColor: type === t.v ? 'var(--color-primary)' : 'var(--border-color)',
                  backgroundColor: type === t.v ? 'rgba(249,115,22,0.1)' : 'var(--bg-primary)',
                  color: type === t.v ? 'var(--color-primary)' : 'var(--text-secondary)',
                }}>{t.label}</button>
            ))}
          </div>

          <input
            value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder="Titre court (ex. « bouton export ne répond pas »)"
            className="w-full px-3 py-2 rounded-lg border text-sm mb-3"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder="Décris ce qui s'est passé ou ce que tu veux…"
            className="w-full px-3 py-2 rounded-lg border text-sm mb-3 resize-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />

          <div className="flex items-center gap-2 mb-4">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Priorité</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}
              className="px-2 py-1.5 rounded-lg border text-xs"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              {PRIOS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>Annuler</button>
            <button onClick={submit} disabled={saving || !title.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}>
              {saving ? '...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
