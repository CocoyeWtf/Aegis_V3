/* Etiquette QR vehicule pour impression / Vehicle QR label for printing */

import { QRCodeSVG } from 'qrcode.react'

interface VehicleQRLabelProps {
  qrCode: string
  vehicleCode: string
  licensePlate?: string
  vehicleType: string
  onClose: () => void
  onRegenerate?: () => void
}

const TYPE_LABELS: Record<string, string> = {
  TRACTEUR: 'Tracteur',
  SEMI_REMORQUE: 'Semi-remorque',
  PORTEUR: 'Porteur',
  REMORQUE: 'Remorque',
  VL: 'VL',
}

export function VehicleQRLabel({ qrCode, vehicleCode, licensePlate, vehicleType, onClose, onRegenerate }: VehicleQRLabelProps) {
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
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            Regenerer QR
          </button>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          Fermer
        </button>
      </div>

      {/* Etiquette QR / QR label */}
      <div className="qr-label" style={{
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '16px',
        width: '340px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        background: '#fff',
        color: '#000',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Vehicule — Scan Inspection
        </div>
        <QRCodeSVG value={`VEH:${qrCode}`} size={160} level="H" />
        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#666' }}>
          VEH:{qrCode}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
          {vehicleCode}
        </div>
        {licensePlate && (
          <div style={{ fontSize: '13px', fontWeight: '500' }}>
            {licensePlate}
          </div>
        )}
        <div style={{ fontSize: '11px', color: '#555' }}>
          {TYPE_LABELS[vehicleType] || vehicleType}
        </div>
      </div>

      {/* CSS impression / Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .qr-label, .qr-label * { visibility: visible; }
          .qr-label {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 340px !important;
          }
        }
      `}</style>
    </div>
  )
}
