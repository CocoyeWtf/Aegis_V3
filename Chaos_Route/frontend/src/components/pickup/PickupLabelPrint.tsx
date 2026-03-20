/* Composant impression etiquettes reprises / Pickup label print component
   Ouvre une fenetre dediee pour forcer portrait / Opens dedicated window to force portrait */

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
    <div className="label-card" style={{
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

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  const handlePrint = useCallback(() => {
    if (!gridRef.current) return

    // Ouvrir une fenetre dediee pour controler @page / Open dedicated window
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Le navigateur a bloque la fenetre popup. Autorisez les popups pour ce site.')
      return
    }

    // Copier le contenu HTML des etiquettes
    const content = gridRef.current.innerHTML

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Etiquettes reprises</title>
<style>
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; }
  .label-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    padding: 0;
  }
  .label-card {
    border: 1px solid #333;
    border-radius: 6px;
    padding: 10px;
    page-break-inside: avoid;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .label-img {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }
</style>
</head>
<body>
<div class="label-grid">
${content}
</div>
</body>
</html>`)
    printWindow.document.close()

    // Attendre le chargement des images puis imprimer
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 300)
    }
    // Fallback si onload ne se declenche pas
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.print()
        printWindow.close()
      }
    }, 1500)
  }, [])

  return (
    <div>
      {/* Boutons / Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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

      {/* Grille d'etiquettes (preview + source pour impression) / Label grid */}
      <div ref={gridRef} className="label-grid" style={{
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
