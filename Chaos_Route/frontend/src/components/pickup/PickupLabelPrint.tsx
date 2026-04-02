/* Composant impression etiquettes reprises / Pickup label print component
   Format 150 x 90mm — layout 2 zones : gauche (100mm) + talon droit (50mm).
   Conforme au modele etiquette jaune physique existant.
   Impression via iframe isole : pas d'interference CSS, scaling proportionnel auto.
   QR codes generes cote client (pas de CDN) pour centrage fiable et pas de race condition. */

import { useCallback, useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { QRCodeSVG } from 'qrcode.react'
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
  onPrinted?: () => void
}

/** Formater le code PDV en 5 chiffres si numerique, sinon tel quel / Format PDV code */
function fmtPdvCode(code: string): string {
  const num = parseInt(code, 10)
  if (!isNaN(num)) return String(num).padStart(5, '0')
  return code
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
  total: number
}) {
  const header = PICKUP_LABEL_HEADERS[pickupType || 'CONTAINER'] || 'RETOUR CONTENANT'
  const bigNum = fmtPdvCode(pdvCode)

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
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        borderRight: '2px dashed #666',
      }}>
        <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>
          {bigNum}
        </div>
        <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>
          {header}
        </div>
        <div style={{ fontSize: '9px' }}>&nbsp;</div>
        <div style={{ fontSize: '9px', marginTop: '2px' }}>
          <strong>{pdvCode}</strong> — {pdvName}
        </div>
        <QRCodeSVG value={label.label_code} size={64} level="M" />
        <div style={{ fontSize: '7px', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
          {label.label_code}
        </div>
        <div style={{ fontSize: '9px' }}>
          {supportTypeName} &mdash; {label.sequence_number}/{total}
        </div>
      </div>

      {/* Talon droit / Right stub — 50mm, 3 bandes avec QR codes */}
      <div style={{
        flex: '0 0 33.3%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {[
          { flex: '0 0 55.5%', qrSize: 44 },
          { flex: '0 0 22.2%', qrSize: 24 },
          { flex: '0 0 22.2%', qrSize: 24 },
        ].map((band, i) => (
          <div key={i} style={{
            flex: band.flex,
            padding: '2px 3px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1px',
            borderBottom: i < 2 ? '1px solid #999' : undefined,
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: i === 0 ? '16px' : '10px', fontWeight: 900, lineHeight: 1 }}>{bigNum}</div>
            <div style={{ fontSize: i === 0 ? '6px' : '5px', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>{header}</div>
            <div style={{ fontSize: i === 0 ? '5px' : '4px', textAlign: 'center' }}>&nbsp;</div>
            <div style={{ fontSize: i === 0 ? '5px' : '4px', textAlign: 'center' }}>{supportTypeName} — {label.sequence_number}/{total}</div>
            <QRCodeSVG value={label.label_code} size={band.qrSize} level="L" />
          </div>
        ))}
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
  qrDataUrl: string,
): string {
  const header = PICKUP_LABEL_HEADERS[pickupType] || 'RETOUR CONTENANT'
  const numPdv = parseInt(pdvCode, 10)
  const bigNum = !isNaN(numPdv) ? String(numPdv).padStart(5, '0') : pdvCode
  return `
    <div class="label">
      <div class="left">
        <div class="big-num">${bigNum}</div>
        <div class="header">${header}</div>
        <div class="base">&nbsp;</div>
        <div class="pdv"><strong>${pdvCode}</strong> &mdash; ${pdvName}</div>
        <img src="${qrDataUrl}" style="width:18mm;height:18mm" />
        <div class="code">${labelCode}</div>
        <div class="support">${supportTypeName} &mdash; ${seqNum}/${total}</div>
      </div>
      <div class="right">
        <div class="stub stub-top">
          <div class="stub-num">${bigNum}</div>
          <div class="stub-header">${header}</div>
          <div class="stub-base">&nbsp;</div>
          <div class="stub-info">${supportTypeName} — ${seqNum}/${total}</div>
          <img src="${qrDataUrl}" style="width:14mm;height:14mm" />
        </div>
        <div class="stub stub-mid">
          <div class="stub-num-sm">${bigNum}</div>
          <div class="stub-header-sm">${header}</div>
          <div class="stub-info-sm">&nbsp;</div>
          <div class="stub-info-sm">${supportTypeName} — ${seqNum}/${total}</div>
          <img src="${qrDataUrl}" style="width:8mm;height:8mm" />
        </div>
        <div class="stub stub-bot">
          <div class="stub-num-sm">${bigNum}</div>
          <div class="stub-header-sm">${header}</div>
          <div class="stub-info-sm">&nbsp;</div>
          <div class="stub-info-sm">${supportTypeName} — ${seqNum}/${total}</div>
          <img src="${qrDataUrl}" style="width:8mm;height:8mm" />
        </div>
      </div>
    </div>
  `
}

export function PickupLabelPrint({ labels, pdvCode, pdvName, supportTypeName, pickupType, onClose, onPrinted }: PickupLabelPrintProps) {

  /* Pre-generer tous les QR codes en data URL / Pre-generate all QR codes as data URLs */
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const codes = [...new Set(labels.map((l) => l.label_code))]
    Promise.all(
      codes.map((code) =>
        QRCode.toDataURL(code, { width: 200, margin: 0, errorCorrectionLevel: 'M' })
          .then((url) => [code, url] as const)
      )
    ).then((pairs) => setQrUrls(Object.fromEntries(pairs)))
  }, [labels])

  const allQrReady = labels.every((l) => qrUrls[l.label_code])

  const handlePrint = useCallback(() => {
    if (!allQrReady) return

    const labelsHtml = labels.map((l) =>
      buildLabelHtml(
        l.label_code, l.sequence_number, labels.length,
        pdvCode, pdvName, supportTypeName,
        pickupType || 'CONTAINER',
        qrUrls[l.label_code],
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

  /* Zone gauche 100mm — pas de flex, centrage via text-align */
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
    text-align: center;
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
  .stub {
    padding: 1.5mm 2mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5mm;
    overflow: hidden;
    text-align: center;
  }
  .stub-top { height: 50mm; border-bottom: 0.3mm solid #999; }
  .stub-mid { height: 20mm; border-bottom: 0.3mm solid #999; }
  .stub-bot { height: 20mm; }
  .stub-num { font-size: 18pt; font-weight: 900; line-height: 1; }
  .stub-header { font-size: 6pt; font-weight: 700; text-transform: uppercase; }
  .stub-base { font-size: 5pt; }
  .stub-info { font-size: 5pt; }
  .stub-num-sm { font-size: 10pt; font-weight: 900; line-height: 1; }
  .stub-header-sm { font-size: 4.5pt; font-weight: 700; text-transform: uppercase; }
  .stub-info-sm { font-size: 4pt; }
</style>
</head>
<body>
${labelsHtml}
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
        onPrinted?.()
        setTimeout(() => document.body.removeChild(iframe), 3000)
      }, 200)
    }
  }, [labels, pdvCode, pdvName, supportTypeName, pickupType, onPrinted, qrUrls, allQrReady])

  return (
    <div>
      {/* Boutons / Buttons */}
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={handlePrint}
          disabled={!allQrReady}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
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
            total={labels.length}
          />
        ))}
      </div>
    </div>
  )
}
