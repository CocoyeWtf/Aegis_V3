/* Guide utilisateur Booking Fournisseurs — role Approvisionneur */
/* User guide for Supplier Booking — Procurement role */

import { useState } from 'react'

/* ───────── couleurs statuts & quais (identiques au module booking) ───────── */
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#737373', CONFIRMED: '#f97316', CHECKED_IN: '#3b82f6',
  AT_DOCK: '#f59e0b', UNLOADING: '#a855f7', DOCK_LEFT: '#06b6d4',
  COMPLETED: '#22c55e', CANCELLED: '#6b7280', REFUSED: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Planifie', CONFIRMED: 'Confirme', CHECKED_IN: 'Arrive sur site',
  AT_DOCK: 'A quai', UNLOADING: 'Dechargement', DOCK_LEFT: 'Parti du quai',
  COMPLETED: 'Parti du site', CANCELLED: 'Annule', REFUSED: 'Refuse',
}
const DOCK_COLORS: Record<string, string> = {
  SEC: '#a3a3a3', FRAIS: '#3b82f6', GEL: '#8b5cf6', FFL: '#22c55e',
}

/* ───────── composants visuels mock ───────── */

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  )
}

function Dot({ color, label }: { color: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function MockBtn({ label, color = 'var(--color-primary)', outline }: { label: string; color?: string; outline?: boolean }) {
  return (
    <span
      className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold"
      style={outline
        ? { border: `1px solid ${color}`, color }
        : { backgroundColor: color, color: '#fff' }}
    >
      {label}
    </span>
  )
}

function MockInput({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs font-medium w-32 text-right" style={{ color: 'var(--text-muted)' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </span>
      <span
        className="flex-1 px-2 py-1 rounded text-xs border"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  )
}

function MockCheckbox({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2 ml-34">
      <span
        className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px]"
        style={{ borderColor: 'var(--border-color)', backgroundColor: checked ? 'var(--color-primary)' : 'transparent', color: '#fff' }}
      >
        {checked && '✓'}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </div>
  )
}

/* ───────── sections du guide ───────── */

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      className="rounded-xl border p-5 mb-6 scroll-mt-20"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
    >
      <h2 className="text-base font-bold mb-4" style={{ color: 'var(--color-primary)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{children}</p>
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
        style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
      >
        {n}
      </span>
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{children}</span>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border-l-4 p-3 mt-3 mb-3 text-xs"
      style={{ borderColor: '#f59e0b', backgroundColor: '#f59e0b11', color: 'var(--text-primary)' }}
    >
      <strong>Astuce :</strong> {children}
    </div>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border-l-4 p-3 mt-3 mb-3 text-xs"
      style={{ borderColor: '#ef4444', backgroundColor: '#ef444411', color: 'var(--text-primary)' }}
    >
      <strong>Attention :</strong> {children}
    </div>
  )
}

/* ───────── mock planning grid ───────── */

function MockPlanningGrid() {
  const bookings = [
    { dock: 0, start: 0, span: 4, supplier: 'DUPONT SA', pallets: 20, status: 'CONFIRMED', order: 'RD4521' },
    { dock: 1, start: 1, span: 3, supplier: 'MARTIN FRERES', pallets: 15, status: 'CHECKED_IN', order: 'RD4530' },
    { dock: 0, start: 5, span: 3, supplier: 'LEROY MERLIN', pallets: 30, status: 'DRAFT', order: 'RD4535' },
    { dock: 2, start: 2, span: 5, supplier: 'COLRUYT', pallets: 40, status: 'UNLOADING', order: 'RD4540' },
    { dock: 1, start: 5, span: 2, supplier: 'DELHAIZE', pallets: 10, status: 'COMPLETED', order: 'RD4545' },
  ]
  const hours = ['06:00', '06:15', '06:30', '06:45', '07:00', '07:15', '07:30', '07:45']
  const docks = [
    { n: 1, type: 'SEC' }, { n: 2, type: 'FRAIS' }, { n: 3, type: 'FRAIS' },
  ]
  return (
    <div className="rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--border-color)' }}>
      {/* header row */}
      <div className="grid" style={{ gridTemplateColumns: '52px repeat(3, 1fr)' }}>
        <div className="p-1.5 text-center font-bold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
          Heure
        </div>
        {docks.map(d => (
          <div
            key={d.n}
            className="p-1.5 text-center font-bold border-l"
            style={{
              borderColor: 'var(--border-color)',
              background: `linear-gradient(135deg, ${DOCK_COLORS[d.type]}33, ${DOCK_COLORS[d.type]}11)`,
              color: 'var(--text-primary)',
            }}
          >
            Quai n°{d.n} <span style={{ color: DOCK_COLORS[d.type] }}>{d.type}</span>
          </div>
        ))}
      </div>
      {/* time rows */}
      {hours.map((h, ri) => (
        <div key={h} className="grid" style={{ gridTemplateColumns: '52px repeat(3, 1fr)', minHeight: 28 }}>
          <div
            className="px-1.5 py-0.5 text-right border-t"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: h.endsWith(':00') ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: h.endsWith(':00') ? 600 : 400,
            }}
          >
            {h}
          </div>
          {docks.map((d, di) => {
            const bk = bookings.find(b => b.dock === di && b.start === ri)
            const occupied = bookings.some(b => b.dock === di && ri > b.start && ri < b.start + b.span)
            return (
              <div
                key={di}
                className="border-t border-l relative"
                style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              >
                {bk && (
                  <div
                    className="absolute inset-x-0.5 rounded px-1.5 py-0.5 overflow-hidden"
                    style={{
                      top: 0,
                      height: bk.span * 28,
                      backgroundColor: STATUS_COLORS[bk.status] + '22',
                      borderLeft: `3px solid ${STATUS_COLORS[bk.status]}`,
                      zIndex: 2,
                    }}
                  >
                    <div className="font-bold truncate" style={{ color: 'var(--text-primary)', fontSize: 10 }}>
                      {bk.supplier}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                      {bk.order} · {bk.pallets} pal.
                    </div>
                    <div style={{ fontSize: 9 }}>
                      <span style={{ color: STATUS_COLORS[bk.status] }}>{STATUS_LABELS[bk.status]}</span>
                    </div>
                  </div>
                )}
                {occupied && <div className="absolute inset-0" style={{ backgroundColor: 'transparent' }} />}
              </div>
            )
          })}
        </div>
      ))}
      {/* footer totals */}
      <div
        className="px-3 py-2 text-xs font-medium border-t flex gap-4"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
      >
        <span>5 bookings</span>
        <span>115 palettes</span>
      </div>
    </div>
  )
}

/* ───────── mock booking dialog ───────── */

function MockBookingDialog() {
  return (
    <div
      className="rounded-xl border p-4 max-w-md"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
        Nouveau booking
      </div>
      <MockInput label="Type quai" value="Frais" required />
      <MockInput label="Heure debut" value="08:00" required />
      <MockInput label="Nb palettes" value="25" required />
      <MockInput label="Quai" value="Attribution automatique" />
      <MockInput label="Fournisseur" value="Dupont & Fils" />
      <MockInput label="N° commande" value="RD12345, RD12346" />
      <MockCheckbox label="Non deplacable" />
      <MockCheckbox label="Enlevement transport" />
      <MockInput label="Notes" value="" />

      {/* suggestions */}
      <div
        className="rounded-lg border p-3 mt-3"
        style={{ borderColor: 'var(--color-primary)44', backgroundColor: 'var(--color-primary)08' }}
      >
        <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
          Creneaux recommandes
        </div>
        {[
          { slot: '08:00 - 09:00 Q2', reason: 'Meilleur ajustement' },
          { slot: '09:15 - 10:15 Q1', reason: 'Capacite disponible' },
          { slot: '06:00 - 07:00 Q3', reason: 'Debut de journee' },
        ].map((s, i) => (
          <div
            key={i}
            className="rounded px-2 py-1 mb-1 flex items-center justify-between text-xs cursor-pointer"
            style={{
              backgroundColor: i === 0 ? 'var(--color-primary)22' : 'var(--bg-tertiary)',
              border: i === 0 ? '1px solid var(--color-primary)' : '1px solid transparent',
              color: 'var(--text-primary)',
            }}
          >
            <span className="font-semibold">{s.slot}</span>
            <span style={{ color: 'var(--text-muted)' }}>{s.reason}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <MockBtn label="Annuler" color="var(--text-muted)" outline />
        <MockBtn label="Creer" />
      </div>
    </div>
  )
}

/* ───────── mock config panel ───────── */

function MockConfigPanel() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
    >
      <div className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
        Configuration des quais
      </div>
      <div className="flex gap-2 mb-4">
        {Object.entries(DOCK_COLORS).map(([type, color]) => (
          <span
            key={type}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
            style={{
              borderColor: color,
              backgroundColor: type === 'FRAIS' ? color + '22' : 'transparent',
              color: type === 'FRAIS' ? color : 'var(--text-muted)',
            }}
          >
            {type === 'FRAIS' ? 'Frais ✓' : type === 'SEC' ? 'Sec +' : type === 'GEL' ? 'Gel +' : 'FFL +'}
          </span>
        ))}
      </div>
      <div className="rounded-lg border p-3" style={{ borderColor: DOCK_COLORS.FRAIS + '44', backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Dot color={DOCK_COLORS.FRAIS} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Frais — 3 quai(s)</span>
        </div>
        <div className="text-xs grid grid-cols-3 gap-2 mb-2" style={{ color: 'var(--text-muted)' }}>
          <span>Productivite : 30 pal/h</span>
          <span>Mise a quai : 10 min</span>
          <span>Depart : 8 min</span>
        </div>
        <div className="text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
          {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map(d => (
            <div key={d} className="flex gap-2">
              <span className="w-16">{d}</span>
              <span style={{ color: 'var(--text-primary)' }}>06:00 - 14:00</span>
            </div>
          ))}
          <div className="flex gap-2">
            <span className="w-16">Samedi</span>
            <span style={{ color: 'var(--text-primary)' }}>06:00 - 12:00</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── mock calendar ───────── */

function MockCalendar() {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const week = [
    { n: 24, bk: 5, open: '06-14', q: 3, type: 'FRAIS' },
    { n: 25, bk: 8, open: '06-14', q: 3, type: 'FRAIS', today: true },
    { n: 26, bk: 3, open: '06-14', q: 3, type: 'FRAIS' },
    { n: 27, bk: 12, open: '06-14', q: 3, type: 'FRAIS' },
    { n: 28, bk: 0, open: '06-14', q: 3, type: 'FRAIS', exception: true },
    { n: 29, bk: 0, open: '06-12', q: 1, type: 'FRAIS' },
    { n: 30, closed: true },
  ]
  return (
    <div className="rounded-lg border overflow-hidden text-xs" style={{ borderColor: 'var(--border-color)' }}>
      <div className="grid grid-cols-7">
        {days.map(d => (
          <div key={d} className="p-1.5 text-center font-bold" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {week.map(d => (
          <div
            key={d.n}
            className="border-t border-r p-2 min-h-[64px]"
            style={{
              borderColor: 'var(--border-color)',
              backgroundColor: d.today ? 'var(--color-primary)08' : d.closed ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
            }}
          >
            <div className="font-bold mb-1" style={{ color: d.today ? 'var(--color-primary)' : 'var(--text-primary)' }}>
              {d.n}
            </div>
            {d.closed ? (
              <span style={{ color: '#ef4444', fontSize: 9 }}>Ferme</span>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <Dot color={DOCK_COLORS[d.type!]} />
                  <span style={{ color: 'var(--text-muted)' }}>{d.open} · {d.q}q</span>
                </div>
                {d.bk! > 0 && <div style={{ color: 'var(--color-primary)', fontSize: 10 }}>{d.bk} bk</div>}
                {d.exception && <Dot color="#3b82f6" label="Exception" />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── mock stats ───────── */

function MockStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Taux exploitation', value: '78%', color: '#22c55e' },
        { label: 'Camions recus', value: '65', color: 'var(--color-primary)' },
        { label: 'Attente moyenne', value: '12 min', color: '#3b82f6' },
        { label: 'Duree quai moy.', value: '45 min', color: '#a855f7' },
      ].map(k => (
        <div
          key={k.label}
          className="rounded-lg border p-3 text-center"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{k.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ───────── mock transport pickup list ───────── */

function MockPickupList() {
  const items = [
    { status: 'PENDING', label: 'En attente', color: '#737373', supplier: 'DUPONT SA', addr: 'Rue du Commerce 12, Namur', enl: '24/03', rec: '25/03', pal: 20, type: 'FRAIS', carrier: null },
    { status: 'ASSIGNED', label: 'Transporteur assigne', color: '#f97316', supplier: 'MARTIN FRERES', addr: 'ZI Nord, Liege', enl: '23/03', rec: '24/03', pal: 15, type: 'SEC', carrier: 'Trans Express' },
    { status: 'IN_TRANSIT', label: 'En transit', color: '#a855f7', supplier: 'COLRUYT', addr: 'Edingensesteenweg 196, Halle', enl: '22/03', rec: '23/03', pal: 40, type: 'FRAIS', carrier: 'Flotte interne' },
  ]
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 border-b text-xs"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
        >
          <Badge color={it.color} label={it.label} />
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{it.supplier}</div>
            <div className="truncate" style={{ color: 'var(--text-muted)' }}>{it.addr}</div>
          </div>
          <div className="text-right" style={{ color: 'var(--text-muted)' }}>
            <div>Enl: <strong style={{ color: 'var(--text-primary)' }}>{it.enl}</strong></div>
            <div>Rec: {it.rec}</div>
          </div>
          <div className="text-center">
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{it.pal} pal</div>
            <span style={{ color: DOCK_COLORS[it.type] }}>{it.type}</span>
          </div>
          <div className="text-right w-24">
            {it.carrier ? (
              <span style={{ color: 'var(--text-primary)' }}>{it.carrier}</span>
            ) : (
              <MockBtn label="Assigner" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PAGE PRINCIPALE DU GUIDE
   ═══════════════════════════════════════════════════════════════ */

const TOC = [
  { id: 'acces', label: '1. Acces au module' },
  { id: 'vue', label: '2. Vue d\'ensemble' },
  { id: 'planning', label: '3. Planning journalier' },
  { id: 'creer', label: '4. Creer un booking' },
  { id: 'modifier', label: '5. Modifier un booking' },
  { id: 'dragdrop', label: '6. Deplacer (drag & drop)' },
  { id: 'annuler', label: '7. Annuler / Supprimer' },
  { id: 'statuts', label: '8. Comprendre les statuts' },
  { id: 'config', label: '9. Configurer les quais' },
  { id: 'import', label: '10. Import commandes' },
  { id: 'calendrier', label: '11. Calendrier mensuel' },
  { id: 'stats', label: '12. Statistiques' },
  { id: 'transport', label: '13. Enlevements transport' },
  { id: 'faq', label: '14. FAQ' },
]

export default function BookingGuide() {
  const [tocOpen, setTocOpen] = useState(true)

  const handlePrint = () => window.print()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 print:hidden">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Guide Booking Fournisseurs
        </h1>
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
        >
          Imprimer / PDF
        </button>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Guide pas a pas pour les approvisionneurs — Module Booking / Reception
      </p>

      {/* Table des matieres */}
      <div
        className="rounded-xl border p-4 mb-6 print:hidden"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="text-sm font-bold flex items-center gap-2 w-full text-left"
          style={{ color: 'var(--color-primary)' }}
        >
          <span>{tocOpen ? '▼' : '▶'}</span> Table des matieres
        </button>
        {tocOpen && (
          <div className="grid grid-cols-2 gap-1 mt-3">
            {TOC.map(t => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="text-xs px-2 py-1 rounded hover:opacity-80 transition-all"
                style={{ color: 'var(--text-primary)' }}
              >
                {t.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ─── 1. ACCES ─── */}
      <SectionCard id="acces" title="1. Acces au module Booking">
        <P>Dans la barre laterale gauche, repérez la section <strong>Approvisionnement</strong> :</P>
        <div
          className="rounded-lg border p-3 mb-3 max-w-xs"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>MENU LATERAL</div>
          <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
            <div>Dashboard</div>
            <div>...</div>
            <div className="font-bold mt-2" style={{ color: 'var(--text-primary)' }}>▼ APPROVISIONNEMENT</div>
            <div className="ml-4 flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
              <span>📅</span> <strong>Booking fournisseurs</strong> ← cliquez ici
            </div>
            <div className="ml-4 flex items-center gap-1">
              <span>🚛</span> Enlevements transport
            </div>
          </div>
        </div>
        <Step n={1}>Connectez-vous avec vos identifiants</Step>
        <Step n={2}>Cliquez sur <strong>Booking fournisseurs</strong> dans la sidebar</Step>
      </SectionCard>

      {/* ─── 2. VUE D'ENSEMBLE ─── */}
      <SectionCard id="vue" title="2. Vue d'ensemble de la page">
        <P>La page est organisee en <strong>5 onglets</strong> :</P>
        <div className="flex gap-1 mb-4">
          {['Planning', 'Config', 'Import', 'Calendrier', 'Stats'].map((tab, i) => (
            <span
              key={tab}
              className="px-3 py-1.5 rounded-t text-xs font-semibold"
              style={{
                backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                color: i === 0 ? '#fff' : 'var(--text-muted)',
              }}
            >
              {tab}
            </span>
          ))}
        </div>

        <P>La <strong>barre de filtres</strong> est toujours visible en haut :</P>
        <div
          className="rounded-lg border p-3 flex items-center gap-3 mb-3"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Base Villers ▼
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            25/03/2026 📅
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
            Type quai ▼
          </span>
          <span className="flex-1" />
          <MockBtn label="+ Booking" />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>mardi 25 mars 2026</span>
        </div>
      </SectionCard>

      {/* ─── 3. PLANNING ─── */}
      <SectionCard id="planning" title="3. Onglet Planning — Vue journaliere">
        <P>C'est l'ecran principal. La grille affiche les creneaux par quai avec un bloc par booking :</P>
        <MockPlanningGrid />

        <h3 className="text-sm font-bold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>
          Couleurs des en-tetes de quai
        </h3>
        <div className="flex gap-3 mb-3">
          {Object.entries(DOCK_COLORS).map(([type, color]) => (
            <Dot key={type} color={color} label={type} />
          ))}
        </div>

        <h3 className="text-sm font-bold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>
          Couleurs des blocs (= statut du booking)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: STATUS_COLORS[key] }} />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{label}</span>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-bold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>
          Points indicateurs sur les blocs
        </h3>
        <div className="flex flex-wrap gap-4 mb-2">
          <Dot color="#22c55e" label="Rapproche (import OK)" />
          <Dot color="#f59e0b" label="Enlevement transport" />
          <Dot color="#ef4444" label="Verrouille" />
          <Dot color="#3b82f6" label="Notes attachees" />
        </div>
      </SectionCard>

      {/* ─── 4. CREER ─── */}
      <SectionCard id="creer" title="4. Creer un booking">
        <P>Deux methodes pour creer un booking :</P>
        <Step n={1}>Cliquez sur le bouton <strong>+ Booking</strong> dans la barre de filtres</Step>
        <Step n={2}><strong>OU</strong> cliquez directement sur une <strong>cellule vide</strong> dans la grille (heure et quai pre-remplis)</Step>

        <P>Le formulaire de creation s'ouvre :</P>
        <MockBookingDialog />

        <div className="mt-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Champs obligatoires</h3>
          <div className="text-xs space-y-1 mb-3" style={{ color: 'var(--text-primary)' }}>
            <div>• <strong>Type quai</strong> — SEC, FRAIS, GEL ou FFL selon la marchandise</div>
            <div>• <strong>Heure debut</strong> — heure d'arrivee prevue (creneaux de 15 min)</div>
            <div>• <strong>Nb palettes</strong> — nombre de palettes attendues (minimum 1)</div>
          </div>
        </div>

        <Tip>
          Le systeme propose automatiquement les <strong>meilleurs creneaux disponibles</strong> quand vous selectionnez un type de quai et un nombre de palettes. Cliquez sur une suggestion pour remplir automatiquement l'heure.
        </Tip>

        <Tip>
          Le <strong>quai est attribue automatiquement</strong>. Vous n'avez pas besoin de le choisir — le systeme prend le premier quai libre.
        </Tip>
      </SectionCard>

      {/* ─── 5. MODIFIER ─── */}
      <SectionCard id="modifier" title="5. Modifier un booking existant">
        <Step n={1}>Cliquez sur un <strong>bloc booking</strong> dans la grille du planning</Step>
        <Step n={2}>Le formulaire s'ouvre en mode edition — modifiez les champs souhaites</Step>
        <Step n={3}>Cliquez sur <strong>Enregistrer</strong></Step>

        <P>En mode edition, des <strong>boutons d'action rapide</strong> apparaissent selon le statut :</P>
        <div className="flex flex-wrap gap-2 mb-3">
          <MockBtn label="Assigner quai" color="#f59e0b" />
          <MockBtn label="Debut dechargement" color="#a855f7" />
          <MockBtn label="Parti du quai" color="#06b6d4" />
          <MockBtn label="Refuser" color="#ef4444" outline />
          <MockBtn label="Annuler booking" color="#6b7280" outline />
        </div>

        <Warning>
          Les bookings aux statuts <strong>Termine</strong>, <strong>Annule</strong>, <strong>Refuse</strong> ou <strong>Parti du quai</strong> ne sont plus modifiables.
        </Warning>
      </SectionCard>

      {/* ─── 6. DRAG & DROP ─── */}
      <SectionCard id="dragdrop" title="6. Deplacer un booking (drag & drop)">
        <Step n={1}>Cliquez et maintenez sur un bloc booking</Step>
        <Step n={2}>Faites-le glisser vers une autre cellule (autre heure et/ou autre quai)</Step>
        <Step n={3}>Relachez pour valider le deplacement</Step>

        <div className="flex items-center gap-4 my-4">
          <div
            className="rounded-lg border p-3 text-center text-xs"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
          >
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>Q1 08:00</div>
            <div
              className="rounded px-2 py-1 mt-1"
              style={{ backgroundColor: STATUS_COLORS.CONFIRMED + '22', borderLeft: `3px solid ${STATUS_COLORS.CONFIRMED}`, opacity: 0.3 }}
            >
              <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>DUPONT</span>
            </div>
          </div>
          <span className="text-lg" style={{ color: 'var(--color-primary)' }}>→</span>
          <div
            className="rounded-lg border p-3 text-center text-xs"
            style={{ borderColor: '#3b82f6', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', boxShadow: '0 0 0 2px #3b82f644' }}
          >
            <div className="font-bold" style={{ color: 'var(--text-primary)' }}>Q2 09:00</div>
            <div
              className="rounded px-2 py-1 mt-1"
              style={{ backgroundColor: STATUS_COLORS.CONFIRMED + '22', borderLeft: `3px solid ${STATUS_COLORS.CONFIRMED}` }}
            >
              <span className="text-[10px]" style={{ color: 'var(--text-primary)' }}>DUPONT</span>
            </div>
          </div>
        </div>

        <Warning>
          Seuls les bookings <strong>Planifie</strong> et <strong>Confirme</strong> sont deplacables. Les bookings marques <strong>Non deplacable</strong> (point rouge) sont verrouilles.
        </Warning>
      </SectionCard>

      {/* ─── 7. ANNULER / SUPPRIMER ─── */}
      <SectionCard id="annuler" title="7. Annuler / Supprimer un booking">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="font-bold text-sm mb-2" style={{ color: '#6b7280' }}>Annuler</div>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-primary)' }}>
              <div>• Le booking reste visible (grise)</div>
              <div>• Utile pour l'historique et les stats</div>
              <div>• Possible tant que pas Termine/Refuse/Parti du quai</div>
            </div>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="font-bold text-sm mb-2" style={{ color: '#ef4444' }}>Supprimer</div>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-primary)' }}>
              <div>• Le booking disparait completement</div>
              <div>• A utiliser pour les erreurs de saisie</div>
              <div>• Uniquement sur Planifie ou Confirme</div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ─── 8. STATUTS ─── */}
      <SectionCard id="statuts" title="8. Comprendre les statuts">
        <P>Parcours normal d'un booking :</P>
        <div className="flex flex-wrap items-center gap-1 mb-4">
          {['DRAFT', 'CONFIRMED', 'CHECKED_IN', 'AT_DOCK', 'UNLOADING', 'DOCK_LEFT', 'COMPLETED'].map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <Badge color={STATUS_COLORS[s]} label={STATUS_LABELS[s]} />
              {i < 6 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                {['Statut', 'Qui le declenche', 'Modifier', 'Annuler', 'Supprimer', 'Deplacer'].map(h => (
                  <th key={h} className="p-2 text-left border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { s: 'DRAFT', who: 'Approvisionneur', edit: true, cancel: true, del: true, move: true },
                { s: 'CONFIRMED', who: 'Approvisionneur', edit: true, cancel: true, del: true, move: true },
                { s: 'CHECKED_IN', who: 'Chauffeur (borne)', edit: true, cancel: true, del: false, move: false },
                { s: 'AT_DOCK', who: 'Reception', edit: true, cancel: false, del: false, move: false },
                { s: 'UNLOADING', who: 'Reception', edit: true, cancel: false, del: false, move: false },
                { s: 'DOCK_LEFT', who: 'Reception', edit: false, cancel: false, del: false, move: false },
                { s: 'COMPLETED', who: 'Poste de garde', edit: false, cancel: false, del: false, move: false },
                { s: 'REFUSED', who: 'Reception', edit: false, cancel: false, del: false, move: false },
                { s: 'CANCELLED', who: 'Approvisionneur', edit: false, cancel: false, del: false, move: false },
              ].map(r => (
                <tr key={r.s}>
                  <td className="p-2 border" style={{ borderColor: 'var(--border-color)' }}>
                    <Badge color={STATUS_COLORS[r.s]} label={STATUS_LABELS[r.s]} />
                  </td>
                  <td className="p-2 border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>{r.who}</td>
                  {[r.edit, r.cancel, r.del, r.move].map((v, i) => (
                    <td key={i} className="p-2 border text-center" style={{ borderColor: 'var(--border-color)', color: v ? '#22c55e' : '#ef4444' }}>
                      {v ? '✓' : '✗'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ─── 9. CONFIG ─── */}
      <SectionCard id="config" title="9. Onglet Config — Configurer les quais">
        <P>Definissez les quais de votre base : nombre, type, cadence et horaires.</P>
        <MockConfigPanel />
        <div className="mt-3">
          <Tip>
            <strong>Calcul automatique de la duree</strong> : Mise a quai + (Palettes / Palettes par heure × 60) + Depart, arrondi au quart d'heure superieur.
            Exemple : 20 pal., 30 pal/h, 10 min setup, 8 min depart = 58 min → <strong>60 min</strong>.
          </Tip>
        </div>
      </SectionCard>

      {/* ─── 10. IMPORT ─── */}
      <SectionCard id="import" title="10. Onglet Import — Carnet de commandes">
        <Step n={1}>Cliquez sur <strong>Parcourir</strong> et selectionnez votre fichier <code>.xls</code> ou <code>.xlsx</code></Step>
        <Step n={2}>Le fichier doit contenir une feuille nommee <strong>"Lst Rd Ouvert Detail"</strong></Step>
        <Step n={3}>L'import et le rapprochement se lancent automatiquement</Step>

        <div
          className="rounded-lg border p-3 mt-3 max-w-sm"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
        >
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Resultat de l'import :</div>
          <div className="text-xs space-y-1" style={{ color: 'var(--text-primary)' }}>
            <div>Commandes importees : <strong>150</strong></div>
            <div>Reconciliees : <strong style={{ color: '#22c55e' }}>120</strong></div>
            <div style={{ color: '#ef4444' }}>Erreurs : 2</div>
          </div>
        </div>

        <Tip>
          Apres un import, les bookings rapproches affichent un <Dot color="#22c55e" label="point vert" /> dans la grille.
          Importez le carnet <strong>apres</strong> avoir cree vos bookings.
        </Tip>
      </SectionCard>

      {/* ─── 11. CALENDRIER ─── */}
      <SectionCard id="calendrier" title="11. Onglet Calendrier — Vue mensuelle">
        <P>Vue d'ensemble du mois avec les jours d'ouverture, exceptions et nombre de bookings :</P>
        <MockCalendar />

        <div className="mt-3">
          <Step n={1}>Cliquez sur un <strong>numero de jour</strong> pour aller au planning de ce jour</Step>
          <Step n={2}>Cliquez sur <strong>+</strong> pour creer une exception (fermeture, horaires modifies)</Step>
        </div>

        <Tip>
          Cas d'usage : <strong>jour ferie</strong> → cochez "Ferme ce jour".
          <strong> Inventaire</strong> → reduisez le nombre de quais.
          <strong> Samedi exceptionnel</strong> → ajoutez des horaires elargis.
        </Tip>
      </SectionCard>

      {/* ─── 12. STATS ─── */}
      <SectionCard id="stats" title="12. Onglet Stats — Indicateurs de performance">
        <P>Selectionnez une periode (date debut / date fin) pour voir les KPI :</P>
        <MockStats />

        <div className="mt-3 text-xs space-y-1" style={{ color: 'var(--text-primary)' }}>
          <div>• <strong>Taux exploitation</strong> — palettes recues / capacite max (vert &gt;80%, orange &gt;50%, rouge &lt;50%)</div>
          <div>• <strong>Camions recus</strong> — nombre total sur la periode</div>
          <div>• <strong>Attente moyenne</strong> — temps entre arrivee sur site et mise a quai</div>
          <div>• <strong>Duree quai moyenne</strong> — temps passe au quai</div>
        </div>

        <P>Plus bas : tableaux des <strong>fournisseurs en retard</strong> et <strong>transporteurs en retard</strong>, et graphiques (barres + camembert).</P>
      </SectionCard>

      {/* ─── 13. TRANSPORT ─── */}
      <SectionCard id="transport" title="13. Enlevements Transport">
        <P>Gerez les enlevements chez les fournisseurs quand votre base organise le transport.</P>
        <P>Acces : <strong>Sidebar → Approvisionnement → Enlevements transport</strong></P>

        <MockPickupList />

        <div className="mt-4">
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Creer un enlevement</h3>
          <Step n={1}>Creez un booking normal (section 4)</Step>
          <Step n={2}>Cochez <strong>Enlevement transport</strong></Step>
          <Step n={3}>Remplissez la date d'enlevement et l'adresse du fournisseur</Step>
        </div>

        <div className="mt-3">
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Cycle de vie</h3>
          <div className="flex flex-wrap items-center gap-1">
            {[
              { s: 'En attente', c: '#737373' },
              { s: 'Assigne', c: '#f97316' },
              { s: 'Enleve', c: '#3b82f6' },
              { s: 'En transit', c: '#a855f7' },
              { s: 'Livre', c: '#22c55e' },
            ].map((x, i) => (
              <span key={x.s} className="flex items-center gap-1">
                <Badge color={x.c} label={x.s} />
                {i < 4 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ─── 14. FAQ ─── */}
      <SectionCard id="faq" title="14. FAQ et astuces">
        {[
          {
            q: 'Comment savoir si un quai est disponible ?',
            a: 'Cliquez sur + Booking, renseignez le type de quai et le nombre de palettes. Les creneaux recommandes apparaissent automatiquement.',
          },
          {
            q: 'Pourquoi je ne peux pas deplacer un booking ?',
            a: 'Soit il est verrouille (point rouge), soit son statut est trop avance (seuls Planifie et Confirme sont deplacables), soit la cellule de destination est occupee.',
          },
          {
            q: 'Comment gerer un jour ferie ?',
            a: 'Onglet Calendrier → cliquez + sur le jour → selectionnez le type de quai → cochez "Ferme ce jour" → indiquez le motif.',
          },
          {
            q: 'Le fournisseur peut-il reserver lui-meme ?',
            a: 'Oui, via le portail fournisseur en libre-service. Communiquez-lui le lien d\'acces.',
          },
          {
            q: 'Que se passe-t-il quand le chauffeur arrive ?',
            a: 'Il se pointe a la borne, saisit son n° de commande et sa plaque. Le booking passe en "Arrive sur site" et la reception recoit une notification sonore + visuelle.',
          },
          {
            q: 'Les temperatures sont-elles gerees automatiquement ?',
            a: 'Oui, a l\'import du carnet de commandes, le systeme auto-determine SEC/FRAIS/GEL via la table CNUF/Filiale.',
          },
          {
            q: 'Qu\'est-ce que la polyvalence Frais/Gel ?',
            a: 'Les quais FRAIS peuvent accepter des bookings GEL. Si aucun quai GEL n\'existe, le systeme bascule automatiquement sur un quai FRAIS.',
          },
        ].map((faq, i) => (
          <div key={i} className="mb-3">
            <div className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {faq.q}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {faq.a}
            </div>
          </div>
        ))}
      </SectionCard>

      {/* Footer impression */}
      <div className="mt-8 text-center text-xs print:block hidden" style={{ color: 'var(--text-muted)' }}>
        CMRO — Chaos Manager Route Optimizer — Guide Booking Approvisionneur
      </div>
    </div>
  )
}
