/* Impression code-barres PDV / PDV barcode print component.
   Genere un code-barres CODE128 du code PDV pour affichage en magasin.
   Le chauffeur scannera ce code avant de reprendre des combis. */

import { useEffect, useRef, useCallback } from 'react'
import JsBarcode from 'jsbarcode'

interface PdvBarcodePrintProps {
  pdvCode: string
  pdvName: string
  pdvCity?: string | null
  onClose: () => void
}

function PdvBarcodeCard({ pdvCode, pdvName, pdvCity }: { pdvCode: string; pdvName: string; pdvCity?: string | null }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, pdvCode, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: false,
        margin: 4,
      })
    }
  }, [pdvCode])

  return (
    <div style={{
      border: '2px solid #333',
      borderRadius: '8px',
      padding: '16px',
      width: '300px',
      backgroundColor: '#fff',
      color: '#000',
      fontFamily: 'Arial, Helvetica, sans-serif',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
        CHAOS ROUTEMANAGER
      </div>
      <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '2px', lineHeight: 1.1 }}>
        {pdvCode}
      </div>
      <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto', margin: '8px 0' }} />
      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#555', marginBottom: '6px' }}>
        {pdvCode}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700 }}>
        {pdvName}
      </div>
      {pdvCity && (
        <div style={{ fontSize: '11px', color: '#666' }}>
          {pdvCity}
        </div>
      )}
    </div>
  )
}

export function PdvBarcodePrint({ pdvCode, pdvName, pdvCity, onClose }: PdvBarcodePrintProps) {

  const handlePrint = useCallback(() => {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Code-barres PDV ${pdvCode}</title>
<style>
  @page { size: 100mm 70mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 100mm;
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    background: #fff;
  }
  .label {
    width: 100mm;
    height: 70mm;
    padding: 4mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    text-align: center;
  }
  .app-name { font-size: 7pt; font-weight: 600; color: #888; }
  .big-code { font-size: 32pt; font-weight: 900; letter-spacing: 2px; line-height: 1; }
  svg { max-width: 85mm; height: auto; }
  .code-text { font-size: 9pt; font-family: monospace; color: #555; }
  .pdv-name { font-size: 12pt; font-weight: 700; margin-top: 1mm; }
  .pdv-city { font-size: 9pt; color: #666; }
</style>
</head>
<body>
<div class="label">
  <div class="app-name">CHAOS ROUTEMANAGER</div>
  <div class="big-code">${pdvCode}</div>
  <svg id="bc"></svg>
  <div class="code-text">${pdvCode}</div>
  <div class="pdv-name">${pdvName}</div>
  ${pdvCity ? `<div class="pdv-city">${pdvCity}</div>` : ''}
</div>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3/dist/JsBarcode.all.min.js"><\/script>
<script>
  JsBarcode('#bc', '${pdvCode}', {
    format: 'CODE128',
    width: 2.5,
    height: 50,
    displayValue: false,
    margin: 2,
    lineColor: '#000',
    background: '#fff'
  });
<\/script>
</body>
</html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:100mm;height:70mm;border:none;'
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
  }, [pdvCode, pdvName, pdvCity])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Code-barres PDV — {pdvCode}
        </h3>

        <div className="flex justify-center mb-4">
          <PdvBarcodeCard pdvCode={pdvCode} pdvName={pdvName} pdvCity={pdvCity} />
        </div>

        <div className="flex gap-3 justify-center">
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
      </div>
    </div>
  )
}
