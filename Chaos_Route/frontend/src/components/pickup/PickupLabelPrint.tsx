/* Composant impression etiquettes reprises / Pickup label print component
   Impression sur Zebra ZD421 — format A6 105x148.5mm, 1 etiquette par label */

import { useEffect, useRef, useCallback } from 'react'
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
        width: 2,
        height: 60,
        displayValue: false,
        margin: 2,
        lineColor: '#000',
        background: '#fff',
      })
    }
  }, [label.label_code])

  return (
    <div className="pickup-label-card" style={{
      width: '105mm',
      height: '148.5mm',
      padding: '6mm',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3mm',
      boxSizing: 'border-box',
      pageBreakAfter: 'always',
      backgroundColor: '#fff',
      color: '#000',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '16px', textAlign: 'center', textTransform: 'uppercase' }}>
        {PICKUP_LABEL_HEADERS[pickupType || 'CONTAINER'] || 'REPRISE CONTENANTS'}
      </div>

      <svg ref={svgRef} style={{ maxWidth: '90mm' }} />

      <div style={{ fontSize: '12px', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '1px' }}>
        {label.label_code}
      </div>

      <div style={{ fontSize: '14px', textAlign: 'center', fontWeight: 'bold', marginTop: '2mm' }}>
        {pdvCode}
      </div>
      <div style={{ fontSize: '12px', textAlign: 'center' }}>
        {pdvName}
      </div>

      {supportTypeImageUrl && (
        <img
          src={supportTypeImageUrl}
          alt={supportTypeName}
          style={{ width: '20mm', height: '20mm', objectFit: 'contain' }}
        />
      )}

      <div style={{ fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>
        {supportTypeName}
      </div>
      <div style={{ fontSize: '11px', textAlign: 'center', color: '#555' }}>
        {label.sequence_number} / {total}
      </div>
    </div>
  )
}

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {
  const handlePrint = useCallback(() => {
    const styleId = 'pickup-label-print-style'
    document.getElementById(styleId)?.remove()

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @page {
        size: 105mm 148.5mm;
        margin: 0;
      }
      @media print {
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 105mm !important;
        }
        body > *:not(#pickup-label-print-root) { display: none !important; }
        #pickup-label-print-root > .pickup-label-no-print { display: none !important; }
        #pickup-label-print-root {
          position: fixed !important;
          left: 0; top: 0;
          width: 105mm !important;
        }
        .pickup-label-card {
          page-break-after: always;
          page-break-inside: avoid;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .pickup-label-card:last-child {
          page-break-after: auto;
        }
      }
    `
    document.head.appendChild(style)

    setTimeout(() => {
      window.print()
      setTimeout(() => { document.getElementById(styleId)?.remove() }, 1000)
    }, 100)
  }, [])

  return (
    <div id="pickup-label-print-root">
      {/* Boutons */}
      <div className="pickup-label-no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={handlePrint}
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

      {/* Preview : grille 2 colonnes a l'ecran, 1 par page a l'impression */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, 105mm)',
        gap: '8px',
      }}>
        {labels.map((label) => (
          <div key={label.id} style={{ border: '1px dashed #ccc', borderRadius: '4px' }}>
            <BarcodeLabel
              label={label}
              pdvCode={pdvCode}
              pdvName={pdvName}
              supportTypeName={supportTypeName}
              pickupType={pickupType}
              supportTypeImageUrl={supportTypeImageUrl}
              total={labels.length}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
