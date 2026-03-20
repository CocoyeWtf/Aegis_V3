/* Composant impression etiquettes reprises / Pickup label print component
   Deux modes : A4 grille 2 colonnes (photocopieur) ou etiquette unitaire (Zebra) */

import { useEffect, useRef, useCallback, useState } from 'react'
import JsBarcode from 'jsbarcode'
import type { PickupLabel, PickupTypeEnum } from '../../types'

const PICKUP_LABEL_HEADERS: Record<string, string> = {
  CONTAINER: 'REPRISE CONTENANTS',
  CARDBOARD: 'REPRISE CARTONS',
  MERCHANDISE: 'RETOUR MARCHANDISE',
  CONSIGNMENT: 'REPRISE CONSIGNES',
}

interface PickupLabelPrintProps {
  labels: PickupLabel[]
  pdvCode: string
  pdvName: string
  supportTypeName: string
  pickupType?: PickupTypeEnum
  supportTypeImageUrl?: string | null
  onClose: () => void
}

function BarcodeLabel({
  label,
  pdvCode,
  pdvName,
  supportTypeName,
  pickupType,
  supportTypeImageUrl,
  total,
}: {
  label: PickupLabel
  pdvCode: string
  pdvName: string
  supportTypeName: string
  pickupType?: PickupTypeEnum
  supportTypeImageUrl?: string | null
  total: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, label.label_code, {
        format: 'CODE128',
        width: 1.5,
        height: 50,
        displayValue: false,
        margin: 4,
      })
    }
  }, [label.label_code])

  return (
    <div className="label-card" style={{
      border: '1px solid #333',
      borderRadius: '6px',
      padding: '10px',
      pageBreakInside: 'avoid',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      overflow: 'hidden',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '11px', textAlign: 'center' }}>
        {PICKUP_LABEL_HEADERS[pickupType || 'CONTAINER'] || 'REPRISE CONTENANTS'}
      </div>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }} />
      <div style={{ fontSize: '10px', fontFamily: 'monospace', textAlign: 'center' }}>
        {label.label_code}
      </div>
      <div style={{ fontSize: '10px', textAlign: 'center' }}>
        <strong>{pdvCode}</strong> - {pdvName}
      </div>
      {supportTypeImageUrl && (
        <img
          src={supportTypeImageUrl}
          alt={supportTypeName}
          className="label-img"
          style={{ width: 60, height: 60, objectFit: 'contain' }}
        />
      )}
      <div style={{ fontSize: '10px', textAlign: 'center' }}>
        {supportTypeName} &mdash; {label.sequence_number}/{total}
      </div>
    </div>
  )
}

/* CSS impression A4 : grille 2 colonnes / A4 print: 2-column grid */
const PRINT_CSS_A4 = `
  @media print {
    .no-print { display: none !important; }
    body * { visibility: hidden; }
    .label-grid, .label-grid * { visibility: visible; }
    .label-grid {
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 10px !important;
      padding: 10mm !important;
    }
    .label-card {
      page-break-inside: avoid;
    }
    .label-card svg { max-width: 100% !important; height: auto !important; }
    .label-img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

/* CSS impression Zebra : 1 etiquette par page, taille label x2 / Zebra print: 1 label per page, doubled */
const PRINT_CSS_ZEBRA = `
  @page {
    size: 210mm 297mm;
    margin: 0;
  }
  @media print {
    .no-print { display: none !important; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      background: #fff !important;
    }
    body * { visibility: hidden; }
    .label-grid, .label-grid * { visibility: visible; }
    .label-grid {
      position: fixed;
      left: 0;
      top: 0;
      width: 210mm !important;
      display: block !important;
      padding: 0 !important;
    }
    .label-card {
      visibility: visible;
      width: 210mm !important;
      height: 297mm !important;
      padding: 12mm !important;
      margin: 0 !important;
      border: none !important;
      border-radius: 0 !important;
      box-sizing: border-box;
      display: flex !important;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6mm;
      page-break-after: always;
      page-break-inside: avoid;
      background: #fff !important;
      color: #000 !important;
    }
    .label-card:last-child { page-break-after: auto; }
    .label-card svg { max-width: 180mm !important; height: auto !important; }
    .label-card div { font-size: 28px !important; }
    .label-img {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {
  const [printMode, setPrintMode] = useState<'a4' | 'zebra'>('a4')

  const handlePrint = useCallback((mode: 'a4' | 'zebra') => {
    setPrintMode(mode)
    // Laisser le temps au CSS de s'appliquer / Let CSS apply before printing
    setTimeout(() => window.print(), 50)
  }, [])

  return (
    <div>
      {/* Boutons hors impression / Buttons hidden on print */}
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handlePrint('a4')}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Imprimer A4
        </button>
        <button
          onClick={() => handlePrint('zebra')}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#2563eb' }}
        >
          Imprimer Zebra
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
        >
          Fermer
        </button>
      </div>

      {/* Grille d'etiquettes / Label grid */}
      <div className="label-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}>
        {labels.map((label) => (
          <BarcodeLabel
            key={label.id}
            label={label}
            pdvCode={pdvCode}
            pdvName={pdvName}
            supportTypeName={supportTypeName}
            pickupType={pickupType}
            supportTypeImageUrl={supportTypeImageUrl}
            total={labels.length}
          />
        ))}
      </div>

      {/* CSS impression dynamique / Dynamic print CSS */}
      <style>{printMode === 'zebra' ? PRINT_CSS_ZEBRA : PRINT_CSS_A4}</style>
    </div>
  )
}
