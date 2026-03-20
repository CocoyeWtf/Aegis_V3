/* Composant impression etiquettes reprises / Pickup label print component
   Deux modes : A4 grille 2 colonnes (photocopieur) ou etiquette unitaire (Zebra via iframe isole) */

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

/* Genere le HTML d'une etiquette pour l'iframe Zebra / Generate label HTML for Zebra iframe */
function buildZebraLabelHtml(
  labelCode: string,
  seqNum: number,
  total: number,
  pdvCode: string,
  pdvName: string,
  supportTypeName: string,
  pickupType: string,
  imageUrl?: string | null,
): string {
  const header = PICKUP_LABEL_HEADERS[pickupType] || 'REPRISE CONTENANTS'
  const imgTag = imageUrl
    ? `<img src="${imageUrl}" style="width:18mm;height:18mm;object-fit:contain;" />`
    : ''
  return `
    <div class="label">
      <div style="font-weight:bold;font-size:14pt;text-transform:uppercase;">${header}</div>
      <svg id="bc-${seqNum}"></svg>
      <div style="font-size:10pt;font-family:monospace;letter-spacing:1px;">${labelCode}</div>
      <div style="font-size:12pt;font-weight:bold;margin-top:2mm;">${pdvCode}</div>
      <div style="font-size:10pt;">${pdvName}</div>
      ${imgTag}
      <div style="font-size:11pt;font-weight:bold;">${supportTypeName}</div>
      <div style="font-size:9pt;color:#555;">${seqNum} / ${total}</div>
    </div>
  `
}

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {

  /* Impression A4 classique / Standard A4 print */
  const handlePrintA4 = useCallback(() => {
    window.print()
  }, [])

  /* Impression Zebra via iframe isole / Zebra print via isolated iframe */
  const handlePrintZebra = useCallback(() => {
    const labelsHtml = labels.map((l) =>
      buildZebraLabelHtml(
        l.label_code, l.sequence_number, labels.length,
        pdvCode, pdvName, supportTypeName,
        pickupType || 'CONTAINER', supportTypeImageUrl,
      )
    ).join('')

    // Construire le document complet / Build the full document
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiquettes Zebra</title>
<style>
  @page {
    size: 105mm 148.5mm;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 105mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
  }
  .label {
    width: 105mm;
    height: 148.5mm;
    padding: 6mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2.5mm;
    text-align: center;
    page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }
  svg { max-width: 90mm; height: auto; }
</style>
</head>
<body>
${labelsHtml}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"><\/script>
<script>
  document.querySelectorAll('svg[id^="bc-"]').forEach(function(svg) {
    var code = svg.closest('.label').querySelector('[style*="monospace"]').textContent.trim();
    JsBarcode(svg, code, { format:'CODE128', width:2, height:60, displayValue:false, margin:2, lineColor:'#000', background:'#fff' });
  });
  setTimeout(function() { window.print(); }, 300);
<\/script>
</body>
</html>`

    // Creer un iframe cache, injecter le HTML, imprimer / Create hidden iframe, inject HTML, print
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:105mm;height:148.5mm;border:none;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    }

    // Nettoyer apres impression / Cleanup after print
    const cleanup = () => {
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 2000)
    }
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        cleanup()
      }, 500)
    }
  }, [labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl])

  return (
    <div>
      {/* Boutons hors impression / Buttons hidden on print */}
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          onClick={handlePrintA4}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          Imprimer A4
        </button>
        <button
          onClick={handlePrintZebra}
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

      {/* Grille d'etiquettes (apercu + impression A4) / Label grid (preview + A4 print) */}
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

      {/* CSS impression A4 / A4 print CSS */}
      <style>{`
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
      `}</style>
    </div>
  )
}
