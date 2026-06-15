/* Bouton flottant « Signaler » présent sur toutes les pages.
   Ouvre la modale de création de ticket (contexte capturé automatiquement). */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreateTicketModal } from './CreateTicketModal'

export function ReportButton() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 px-3.5 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all hover:opacity-90 print-hide flex items-center gap-1.5"
        style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        title="Signaler un bug ou une demande (le contexte est capturé automatiquement)"
      >
        🎫 Signaler
      </button>

      <CreateTicketModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(t) => navigate(`/tickets?focus=${t.id}`)}
      />
    </>
  )
}
