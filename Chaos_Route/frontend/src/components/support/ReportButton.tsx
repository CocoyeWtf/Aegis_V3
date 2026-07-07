/* Cluster flottant présent sur toutes les pages :
   - « 📌 Noter un moment » : épingle une note à l'instant courant (annotation
     multi-points de la dashcam, pour aider le diagnostic) ;
   - « 🎫 Signaler » : ouvre la modale de création de ticket (contexte + déroulé
     de session capturés automatiquement). */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateTicketModal } from './CreateTicketModal'
import { recordUserNote } from '../../services/supportContext'

export function ReportButton() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const submitNote = () => {
    const n = note.trim()
    if (n) {
      recordUserNote(n)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    }
    setNote('')
    setNoting(false)
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 print-hide">
        {/* Indicateur : la capture tourne en continu (rien à démarrer) */}
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm text-[11px] font-medium select-none"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          title="Capture de session active en continu : les 2 dernières minutes (navigation, clics, saisies masquées, erreurs réseau) sont enregistrées et jointes automatiquement au ticket quand vous cliquez sur « Signaler ». Il n'y a rien à démarrer."
        >
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-danger)' }} />
          Capture active
        </div>
        {noting ? (
          <div
            className="flex items-center gap-1 rounded-full shadow-lg px-2 py-1"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <input
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNote()
                if (e.key === 'Escape') { setNote(''); setNoting(false) }
              }}
              placeholder="Note : ce qui se passe ici…"
              className="text-xs px-2 py-1 rounded-md outline-none"
              style={{ minWidth: 220, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            />
            <button
              onClick={submitNote}
              className="text-xs px-2.5 py-1 rounded-md font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => setNoting(true)}
            title="Épingler une note au moment courant (aide au diagnostic du ticket)"
            className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all hover:opacity-90 flex items-center gap-1"
            style={{ backgroundColor: 'var(--bg-secondary)', color: saved ? 'var(--color-success)' : 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
          >
            {saved ? '✓ Note ajoutée' : '📌 Noter un moment'}
          </button>
        )}

        <button
          onClick={() => setOpen(true)}
          className="px-3.5 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all hover:opacity-90 flex items-center gap-1.5"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          title="Signaler un bug ou une demande (le contexte et le déroulé sont capturés automatiquement)"
        >
          🎫 Signaler
        </button>
      </div>

      <CreateTicketModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(t) => navigate(`/tickets?focus=${t.id}`)}
      />
    </>
  )
}
