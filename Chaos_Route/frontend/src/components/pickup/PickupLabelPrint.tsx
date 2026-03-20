/* Composant impression etiquettes reprises / Pickup label print component
   Format unique paysage 148.5 x 105mm — barcode sur la longueur.
   Impression via iframe isole : pas d'interference CSS, scaling proportionnel auto. */

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
    <div style={{
      border: '1px solid #333',
      borderRadius: '6px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      overflow: 'hidden',
      aspectRatio: '148.5 / 105',
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
          style={{ width: 50, height: 50, objectFit: 'contain' }}
        />
      )}
      <div style={{ fontSize: '10px', textAlign: 'center' }}>
        {supportTypeName} &mdash; {label.sequence_number}/{total}
      </div>
    </div>
  )
}

/* HTML d'une etiquette pour l'iframe / Label HTML for print iframe */
function buildLabelHtml(
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
    ? `<img src="${imageUrl}" style="height:12mm;object-fit:contain;" />`
    : ''
  return `
    <div class="label">
      <div class="header">${header}</div>
      <svg id="bc-${seqNum}"></svg>
      <div class="code">${labelCode}</div>
      <div class="pdv-code">${pdvCode}</div>
      <div class="pdv-name">${pdvName}</div>
      ${imgTag}
      <div class="support">${supportTypeName}</div>
      <div class="seq">${seqNum} / ${total}</div>
    </div>
  `
}

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {

  const handlePrint = useCallback(() => {
    const labelsHtml = labels.map((l) =>
      buildLabelHtml(
        l.label_code, l.sequence_number, labels.length,
        pdvCode, pdvName, supportTypeName,
        pickupType || 'CONTAINER', supportTypeImageUrl,
      )
    ).join('')

    // Document HTML autonome, format paysage 148.5 x 105mm
    // Le navigateur envoie cette taille a l'imprimante.
    // - Zebra 105x148.5 : match exact (le driver tourne si besoin)
    // - Photocopieur A4 : imprime tel quel (petit) ou l'user coche "adapter a la page"
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiquettes</title>
<style>
  @page {
    size: 148.5mm 105mm;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 148.5mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
  }
  .label {
    width: 148.5mm;
    height: 105mm;
    padding: 4mm 6mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    text-align: center;
    page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }
  .header { font-weight: bold; font-size: 12pt; text-transform: uppercase; }
  svg { max-width: 130mm; height: auto; }
  .code { font-size: 9pt; font-family: monospace; letter-spacing: 1px; }
  .pdv-code { font-size: 11pt; font-weight: bold; margin-top: 1mm; }
  .pdv-name { font-size: 9pt; }
  .support { font-size: 10pt; font-weight: bold; }
  .seq { font-size: 8pt; color: #555; }
</style>
</head>
<body>
${labelsHtml}
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"><\/script>
<script>
  document.querySelectorAll('svg[id^="bc-"]').forEach(function(svg) {
    var code = svg.closest('.label').querySelector('.code').textContent.trim();
    JsBarcode(svg, code, {
      format: 'CODE128',
      width: 2,
      height: 45,
      displayValue: false,
      margin: 2,
      lineColor: '#000',
      background: '#fff'
    });
  });
<\/script>
</body>
</html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:148.5mm;height:105mm;border:none;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
    }

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 3000)
      }, 400)
    }
  }, [labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl])

  return (
    <div>
      {/* Boutons / Buttons */}
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
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

      {/* Apercu / Preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
