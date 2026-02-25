/* Dialogue "À propos" / About dialog */

interface AboutDialogProps {
  open: boolean
  onClose: () => void
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 10000 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center">
          {/* Titre application */}
          <h2
            className="text-2xl font-black tracking-widest mb-6"
            style={{ color: 'var(--color-primary)' }}
          >
            CHAOS ROUTEMANAGER
          </h2>

          {/* Section principale */}
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Conception, Architecture &amp; Développement
          </p>
          <p
            className="text-xl font-bold mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            Dominic Verleyen
          </p>

          {/* Séparateur */}
          <div className="mx-auto w-16 border-t mb-6" style={{ borderColor: 'var(--border-color)' }} />

          {/* Section légale */}
          <div className="text-xs leading-relaxed space-y-1" style={{ color: 'var(--text-muted)' }}>
            <p>Logiciel propriétaire — Tous droits réservés</p>
            <p>Licence d'exploitation exclusive accordée par Dominic Verleyen</p>
            <p>Licence révocable à tout moment en l'absence d'accord contractuel</p>
            <p>Toute reproduction, distribution ou utilisation non autorisée est interdite</p>
            <p className="mt-3 font-medium">© 2026 Dominic Verleyen</p>
          </div>

          {/* Bouton Fermer */}
          <button
            onClick={onClose}
            className="mt-8 px-6 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
