/* Composant impression etiquettes reprises / Pickup label print component */

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
        width: 1.5,
        height: 50,
        displayValue: false,
        margin: 4,
      })
    }
  }, [label.label_code])

  return (
    <div className="pickup-label-card" style={{
      border: '1px solid #333',
      borderRadius: '6px',
      padding: '10px',
      pageBreakInside: 'avoid',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '11px', textAlign: 'center' }}>
        {PICKUP_LABEL_HEADERS[pickupType || 'CONTAINER'] || 'REPRISE CONTENANTS'}
      </div>
      <svg ref={svgRef} />
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
          style={{ width: 60, height: 60, objectFit: 'contain' }}
        />
      )}
      <div style={{ fontSize: '10px', textAlign: 'center' }}>
        {supportTypeName} &mdash; {label.sequence_number}/{total}
      </div>
    </div>
  )
}

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {
  const handlePrint = useCallback(() => {
    // Injecter @page portrait dans le <head> avant impression
    const styleId = 'pickup-label-print-style'
    // Supprimer si deja present
    document.getElementById(styleId)?.remove()

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @page { size: A4 portrait !important; margin: 10mm; }
      @media print {
        /* Masquer tout sauf les etiquettes */
        body > *:not(#pickup-label-print-root) { display: none !important; }
        #pickup-label-print-root > .pickup-label-no-print { display: none !important; }
        #pickup-label-print-root {
          position: fixed !important;
          left: 0; top: 0;
          width: 100%; height: auto;
          z-index: 99999;
          background: white !important;
        }
        .pickup-label-grid {
          display: grid !important;
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 10px !important;
        }
        .pickup-label-card {
          page-break-inside: avoid;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `
    document.head.appendChild(style)

    // Imprimer
    setTimeout(() => {
      window.print()
      // Nettoyer apres impression
      setTimeout(() => { document.getElementById(styleId)?.remove() }, 500)
    }, 100)
  }, [])

  return (
    <div id="pickup-label-print-root">
      {/* Boutons (masques a l'impression) */}
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

      {/* Grille d'etiquettes */}
      <div className="pickup-label-grid" style={{
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
    </div>
  )
}
