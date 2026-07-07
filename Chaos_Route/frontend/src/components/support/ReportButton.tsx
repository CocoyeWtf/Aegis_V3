/* Cluster flottant présent sur toutes les pages :
   - « 🔴 Démarrer l'enregistrement » : lance une capture de session À LA DEMANDE
     (rien n'est capturé avant). Pendant l'enregistrement : chrono + zone de notes
     pour épingler des commentaires aux moments clés, puis « Arrêter » ou
     « Créer le ticket ».
   - « 🎫 Signaler » : ouvre la modale de création de ticket (le contexte et
     l'éventuel enregistrement sont joints automatiquement). */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateTicketModal } from './CreateTicketModal'
import {
  recordUserNote, startRecording, stopRecording, clearSession,
  isRecording, recordingElapsedMs, recordedEventCount,
} from '../../services/supportContext'

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ReportButton() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(isRecording())
  const [elapsed, setElapsed] = useState(0)
  const [evtCount, setEvtCount] = useState(0)
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState(false)

  /* Chrono + compteur d'événements pendant l'enregistrement */
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      setElapsed(Math.floor(recordingElapsedMs() / 1000))
      setEvtCount(recordedEventCount())
    }, 1000)
    return () => clearInterval(id)
  }, [recording])

  const start = () => { startRecording(); setRecording(true); setElapsed(0); setEvtCount(0) }
  const stop = () => { stopRecording(); setRecording(false) }
  const addNote = () => {
    const n = note.trim()
    if (n) { recordUserNote(n); setSavedNote(true); setTimeout(() => setSavedNote(false), 1400) }
    setNote('')
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 print-hide">
        {recording ? (
          <div
            className="rounded-xl shadow-lg p-3 w-72"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-danger)' }} />
                Enregistrement {mmss(elapsed)}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{evtCount} évén.</span>
            </div>

            {/* Zone de notes : épingler un commentaire à l'instant courant */}
            <div className="flex items-center gap-1 mb-1">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNote() }}
                placeholder="Note : ce qui se passe ici…"
                className="flex-1 text-xs px-2 py-1.5 rounded-md outline-none"
                style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
              <button
                onClick={addNote}
                title="Épingler la note à cet instant de l'enregistrement"
                className="text-sm px-2 py-1.5 rounded-md font-semibold text-white shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                📌
              </button>
            </div>
            <p className="text-[10px] mb-2 h-3" style={{ color: 'var(--color-success)' }}>{savedNote ? '✓ Note ajoutée' : ''}</p>

            <div className="flex gap-1">
              <button
                onClick={stop}
                className="flex-1 text-xs px-2 py-1.5 rounded-md font-semibold"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                ⏹ Arrêter
              </button>
              <button
                onClick={() => setOpen(true)}
                className="flex-1 text-xs px-2 py-1.5 rounded-md font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                🎫 Créer le ticket
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={start}
              title="Enregistrer une courte session pour illustrer un bug (rien n'est capturé avant de démarrer)"
              className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all hover:opacity-90 flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-danger)' }} />
              Démarrer l'enregistrement
            </button>
            <button
              onClick={() => setOpen(true)}
              className="px-3.5 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all hover:opacity-90 flex items-center gap-1.5"
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
              title="Signaler un bug ou une demande (contexte capturé automatiquement)"
            >
              🎫 Signaler
            </button>
          </>
        )}
      </div>

      <CreateTicketModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(t) => { clearSession(); setRecording(false); navigate(`/tickets?focus=${t.id}`) }}
      />
    </>
  )
}
