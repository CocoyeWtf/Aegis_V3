/* Badge chauffeur pour impression / Driver badge card for printing */

import { QRCodeSVG } from 'qrcode.react'

interface DriverBadgeCardProps {
  badgeCode: string
  username: string
  roleName?: string
  onClose: () => void
}

export function DriverBadgeCard({ badgeCode, username, roleName, onClose }: DriverBadgeCardProps) {
  return (
    <div>
      {/* Boutons hors impression / Buttons hidden on print */}
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Imprimer
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          Fermer
        </button>
      </div>

      {/* Badge format carte credit 85.6mm x 54mm / Credit card format badge */}
      <div className="badge-card" style={{
        border: '2px solid #333',
        borderRadius: '10px',
        width: '324px',   /* ~85.6mm at 96dpi */
        height: '204px',  /* ~54mm at 96dpi */
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '12px 16px',
        gap: '16px',
        background: '#fff',
        color: '#000',
      }}>
        {/* Colonne gauche : logo + infos / Left column: logo + info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <img src="/LogoCMRO.png" alt="CMRO" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          <div style={{ fontSize: '14px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.2' }}>
            {username}
          </div>
          {roleName && (
            <div style={{ fontSize: '10px', color: '#555', textAlign: 'center' }}>
              {roleName}
            </div>
          )}
          <div style={{ fontSize: '8px', color: '#999', marginTop: '2px' }}>
            CMRO — Chaos RouteManager
          </div>
        </div>

        {/* Colonne droite : QR / Right column: QR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <QRCodeSVG value={`DRIVER:${badgeCode}`} size={120} level="H" />
          <div style={{ fontSize: '9px', fontFamily: 'monospace', color: '#666' }}>
            {badgeCode}
          </div>
        </div>
      </div>

      {/* CSS impression / Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .badge-card, .badge-card * { visibility: visible; }
          .badge-card {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 85.6mm !important;
            height: 54mm !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}
