/* Lettre de voiture CMR / CMR Waybill document (printable overlay) */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import type { WaybillData } from '../../types'

interface TourWaybillProps {
  tourId: number
  onClose: () => void
}

export function TourWaybill({ tourId, onClose }: TourWaybillProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<WaybillData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/tours/${tourId}/waybill`)
      .then((r) => setData(r.data))
      .catch((e) => console.error('Failed to load waybill', e))
      .finally(() => setLoading(false))
  }, [tourId])

  const deliveryDateStr = data?.delivery_date ?? data?.date ?? ''
  const formattedDate = deliveryDateStr
    ? new Date(deliveryDateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''
  const formattedDispatch = data?.dispatch_date
    ? new Date(data.dispatch_date + 'T00:00:00').toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }) + (data.dispatch_time ? ` ${data.dispatch_time}` : '')
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Toolbar (masquée impression / hidden on print) */}
      <div
        className="print-hide flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('waybill.title')}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          >
            {t('waybill.print')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            {t('waybill.close')}
          </button>
        </div>
      </div>

      {/* Contenu imprimable / Printable content */}
      <div className="flex-1 overflow-y-auto p-6 print-content">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            {t('common.loading')}
          </p>
        ) : !data ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            {t('common.noData')}
          </p>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto', fontSize: '12px', color: 'var(--text-primary)' }}>
            {/* 1. En-tête / Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, letterSpacing: '2px' }}>
                {t('waybill.documentTitle')}
              </h1>
              <p style={{ fontSize: '14px', marginTop: '4px', color: 'var(--text-muted)' }}>
                {data.tour_code} — {formattedDate}
              </p>
            </div>

            {/* 2. Expéditeur / Sender */}
            <table style={{ ...tblStyle, marginBottom: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold', backgroundColor: 'var(--bg-tertiary)' }}>
                    {t('waybill.sender')}
                  </td>
                  <td style={cellStyle}>
                    {data.base ? (
                      <>
                        <strong>{data.base.code} — {data.base.name}</strong><br />
                        {data.base.address && <>{data.base.address}<br /></>}
                        {data.base.postal_code} {data.base.city}
                      </>
                    ) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 3. Transporteur / Transporter */}
            <table style={{ ...tblStyle, marginBottom: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold', backgroundColor: 'var(--bg-tertiary)' }}>
                    {t('waybill.transporter')}
                  </td>
                  <td style={cellStyle}>
                    {data.contract ? (
                      <>
                        <strong>{data.contract.transporter_name}</strong>
                        {' — '}{t('waybill.contractCode')}: {data.contract.code}
                        <br />
                        {t('waybill.vehicle')}: {data.contract.vehicle_name ?? data.contract.vehicle_code ?? '—'}
                        {data.contract.temperature_type && ` (${data.contract.temperature_type})`}
                      </>
                    ) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4. Chauffeur / Driver */}
            <table style={{ ...tblStyle, marginBottom: '16px' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold', backgroundColor: 'var(--bg-tertiary)' }}>
                    {t('waybill.driver')}
                  </td>
                  <td style={cellStyle}>
                    {data.driver_name || '—'}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 5. Marchandise — Tableau des stops / Goods — Stop table */}
            <table style={{ ...tblStyle, marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t('waybill.pdvCode')}</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t('waybill.pdvName')}</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t('waybill.address')}</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>{t('waybill.city')}</th>
                  <th style={thStyle}>EQC</th>
                  <th style={thStyle}>{t('waybill.temperature')}</th>
                  <th style={thStyle}>{t('waybill.pickups')}</th>
                </tr>
              </thead>
              <tbody>
                {data.stops.map((stop, idx) => (
                  <tr key={idx} style={idx % 2 === 1 ? { backgroundColor: 'var(--bg-tertiary)' } : undefined}>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{stop.sequence}</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{stop.pdv_code}</td>
                    <td style={tdStyle}>{stop.pdv_name}</td>
                    <td style={{ ...tdStyle, fontSize: '10px' }}>{stop.address}</td>
                    <td style={tdStyle}>{stop.city}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 'bold' }}>{stop.eqp_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: '10px' }}>
                      {stop.temperature_classes.join(', ')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: '10px' }}>
                      {[
                        stop.pickup_cardboard && t('tourPlanning.pickupCardboard'),
                        stop.pickup_containers && t('tourPlanning.pickupContainers'),
                        stop.pickup_returns && t('tourPlanning.pickupReturns'),
                      ].filter(Boolean).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 6. Totaux / Totals */}
            <table style={{ ...tblStyle, marginBottom: '16px' }}>
              <tbody>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold' }}>
                    {t('waybill.totalEqp')}
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>
                    {data.total_eqp} EQC
                  </td>
                  <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold' }}>
                    {t('waybill.totalWeight')}
                  </td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>
                    {data.total_weight_kg} kg
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 7. Départ / Departure */}
            <table style={{ ...tblStyle, marginBottom: '24px' }}>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold', backgroundColor: 'var(--bg-tertiary)' }}>
                    {t('waybill.departureDate')}
                  </td>
                  <td style={cellStyle}>
                    {formattedDate} — {data.departure_time ?? '—'}
                  </td>
                </tr>
                {formattedDispatch && (
                  <tr>
                    <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold', backgroundColor: 'var(--bg-tertiary)' }}>
                      Répart.
                    </td>
                    <td style={cellStyle}>
                      {formattedDispatch}
                    </td>
                  </tr>
                )}
                {data.remarks && (
                  <tr>
                    <td style={{ ...cellStyle, width: '140px', fontWeight: 'bold', backgroundColor: 'var(--bg-tertiary)' }}>
                      {t('waybill.remarks')}
                    </td>
                    <td style={cellStyle}>{data.remarks}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* 8. Signatures */}
            <table style={{ ...tblStyle }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <th style={{ ...thStyle, width: '33%' }}>{t('waybill.signatureSender')}</th>
                  <th style={{ ...thStyle, width: '33%' }}>{t('waybill.signatureTransporter')}</th>
                  <th style={{ ...thStyle, width: '34%' }}>{t('waybill.signatureReceiver')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, height: '80px', verticalAlign: 'bottom' }}>
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '60px', paddingTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {t('waybill.signatureLine')}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, height: '80px', verticalAlign: 'bottom' }}>
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '60px', paddingTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {t('waybill.signatureLine')}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, height: '80px', verticalAlign: 'bottom' }}>
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '60px', paddingTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {t('waybill.signatureLine')}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* Styles inline réutilisables / Reusable inline styles */
const tblStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  border: '1px solid var(--border-color)',
}

const cellStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--border-color)',
  fontSize: '12px',
}

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: '11px',
  fontWeight: 600,
  textAlign: 'center',
  borderBottom: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '11px',
  borderTop: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
}
