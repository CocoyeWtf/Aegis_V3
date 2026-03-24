/* Composant impression etiquettes reprises / Pickup label print component
   Format 150 x 90mm — layout 2 zones : gauche (100mm) + talon droit (50mm).
   Conforme au modele etiquette jaune physique existant.
   Impression via iframe isole : pas d'interference CSS, scaling proportionnel auto. */

import { useEffect, useRef, useCallback } from 'react'
import JsBarcode from 'jsbarcode'
import type { PickupLabel, PickupTypeEnum } from '../../types'

const PICKUP_LABEL_HEADERS: Record<string, string> = {
  CONTAINER: 'RETOUR CONTENANT',
  CARDBOARD: 'RETOUR CARTONS',
  MERCHANDISE: 'RETOUR MARCHANDISE',
  CONSIGNMENT: 'RETOUR CONSIGNES',
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

/** Formater le sequence_number en 5 chiffres / Format seq number to 5 digits */
function fmtSeq(n: number): string {
  return String(n).padStart(5, '0')
}

/* ── Apercu ecran / Screen preview ── */

function BarcodeLabel({
  label,
  pdvCode,
  pdvName,
  supportTypeName,
  pickupType,
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
  const header = PICKUP_LABEL_HEADERS[pickupType || 'CONTAINER'] || 'RETOUR CONTENANT'
  const bigNum = fmtSeq(label.sequence_number)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, label.label_code, {
        format: 'CODE128',
        width: 1.2,
        height: 30,
        displayValue: false,
        margin: 2,
      })
    }
  }, [label.label_code])

  return (
    <div style={{
      border: '1px solid #333',
      borderRadius: '4px',
      display: 'flex',
      overflow: 'hidden',
      width: '100%',
      aspectRatio: '150 / 90',
      fontSize: '10px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      color: '#000',
      backgroundColor: '#fff',
    }}>
      {/* Zone gauche / Left zone — 100mm */}
      <div style={{
        flex: '0 0 66.7%',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '2px',
        borderRight: '2px dashed #666',
      }}>
        <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1, textAlign: 'center' }}>
          {bigNum}
        </div>
        <div style={{ fontWeight: 700, fontSize: '11px', textAlign: 'center', textTransform: 'uppercase' }}>
          {header}
        </div>
        <div style={{ fontSize: '9px', textAlign: 'center' }}>
          SA Base de Villers-le-Bouillet
        </div>
        <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px' }}>
          <strong>{pdvCode}</strong> — {pdvName}
        </div>
        <div style={{ textAlign: 'center', margin: '2px 0' }}>
          <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
        <div style={{ fontSize: '7px', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '0.5px' }}>
          {label.label_code}
        </div>
        <div style={{ fontSize: '9px', textAlign: 'center' }}>
          {supportTypeName} &mdash; {label.sequence_number}/{total}
        </div>
      </div>

      {/* Talon droit / Right stub — 50mm, 3 bandes */}
      <div style={{
        flex: '0 0 33.3%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Bande haute 5cm — numero + type */}
        <div style={{
          flex: '0 0 55.5%',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '2px',
          borderBottom: '1px solid #999',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 900, lineHeight: 1 }}>{bigNum}</div>
          <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{header}</div>
          <div style={{ fontSize: '7px', textAlign: 'center' }}>{pdvCode}</div>
        </div>
        {/* Bande milieu 2cm — support / libelle */}
        <div style={{
          flex: '0 0 22.2%',
          padding: '2px 4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderBottom: '1px solid #999',
          fontSize: '7px',
        }}>
          <div>Libelle :</div>
          <div style={{ fontWeight: 600 }}>{supportTypeName}</div>
        </div>
        {/* Bande basse 2cm — code scannable */}
        <div style={{
          flex: '0 0 22.2%',
          padding: '2px 4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontSize: '6px',
          fontFamily: 'monospace',
        }}>
          <div>{label.label_code}</div>
          <div style={{ fontWeight: 700, fontSize: '8px' }}>{bigNum}</div>
        </div>
      </div>
    </div>
  )
}

/* ── HTML pour impression iframe / Print HTML via iframe ── */

function buildLabelHtml(
  labelCode: string,
  seqNum: number,
  total: number,
  pdvCode: string,
  pdvName: string,
  supportTypeName: string,
  pickupType: string,
): string {
  const header = PICKUP_LABEL_HEADERS[pickupType] || 'RETOUR CONTENANT'
  const bigNum = String(seqNum).padStart(5, '0')
  return `
    <div class="label">
      <div class="left">
        <div class="big-num">${bigNum}</div>
        <div class="header">${header}</div>
        <div class="base">SA Base de Villers-le-Bouillet</div>
        <div class="pdv"><strong>${pdvCode}</strong> &mdash; ${pdvName}</div>
        <svg id="bc-${seqNum}"></svg>
        <div class="code">${labelCode}</div>
        <div class="support">${supportTypeName} &mdash; ${seqNum}/${total}</div>
      </div>
      <div class="right">
        <div class="stub-top">
          <div class="stub-num">${bigNum}</div>
          <div class="stub-header">${header}</div>
          <div class="stub-pdv">${pdvCode}</div>
        </div>
        <div class="stub-mid">
          <div class="stub-label">Libelle :</div>
          <div class="stub-value">${supportTypeName}</div>
        </div>
        <div class="stub-bot">
          <div class="stub-code">${labelCode}</div>
          <div class="stub-num2">${bigNum}</div>
        </div>
      </div>
    </div>
  `
}

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, supportTypeImageUrl, onClose }: PickupLabelPrintProps) {

  const handlePrint = useCallback(() => {
    const labelsHtml = labels.map((l) =>
      buildLabelHtml(
        l.label_code, l.sequence_number, labels.length,
        pdvCode, pdvName, supportTypeName,
        pickupType || 'CONTAINER',
      )
    ).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiquettes</title>
<style>
  @page {
    size: 150mm 90mm;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 150mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
  }
  .label {
    width: 150mm;
    height: 90mm;
    display: flex;
    page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }

  /* Zone gauche 100mm */
  .left {
    width: 100mm;
    height: 90mm;
    padding: 3mm 4mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5mm;
    border-right: 0.5mm dashed #666;
  }
  .big-num {
    font-size: 36pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 2px;
  }
  .header {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .base { font-size: 9pt; }
  .pdv { font-size: 9pt; margin-top: 1mm; }
  .left svg { max-width: 85mm; height: auto; }
  .code {
    font-size: 7pt;
    font-family: monospace;
    letter-spacing: 0.5px;
  }
  .support { font-size: 9pt; font-weight: 600; }

  /* Talon droit 50mm */
  .right {
    width: 50mm;
    height: 90mm;
    display: flex;
    flex-direction: column;
  }
  .stub-top {
    height: 50mm;
    padding: 2mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1mm;
    border-bottom: 0.3mm solid #999;
  }
  .stub-num { font-size: 20pt; font-weight: 900; line-height: 1; }
  .stub-header { font-size: 7pt; font-weight: 700; text-transform: uppercase; text-align: center; }
  .stub-pdv { font-size: 8pt; }
  .stub-mid {
    height: 20mm;
    padding: 1.5mm 2mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-bottom: 0.3mm solid #999;
    font-size: 7pt;
  }
  .stub-label { color: #555; }
  .stub-value { font-weight: 600; }
  .stub-bot {
    height: 20mm;
    padding: 1.5mm 2mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-size: 6pt;
    font-family: monospace;
  }
  .stub-code { word-break: break-all; }
  .stub-num2 { font-size: 10pt; font-weight: 900; margin-top: 1mm; }
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
      width: 1.8,
      height: 35,
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
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:150mm;height:90mm;border:none;'
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
  }, [labels, pdvCode, pdvName, supportTypeName, pickupType])

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
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
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
