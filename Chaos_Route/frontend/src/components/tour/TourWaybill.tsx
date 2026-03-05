/* Lettre de voiture CMR / CMR Waybill document — Format 24 cases Convention de Genève 1956
   Conforme au format FEBETRA — impression A4 optimisée */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'
import type { WaybillData, WaybillArchive } from '../../types'

interface TourWaybillProps {
  tourId: number
  onClose: () => void
}

/* Formulaire d'émission CMR / CMR issuance form */
function CMRIssueForm({
  onIssue,
  loading,
  defaultPlace,
}: {
  onIssue: (data: {
    establishment_place?: string
    sender_instructions?: string
    attached_documents?: string
    special_agreements?: string
    payment_instructions?: string
  }) => void
  loading: boolean
  defaultPlace: string
}) {
  const [place, setPlace] = useState(defaultPlace)
  const [instructions, setInstructions] = useState('')
  const [docs, setDocs] = useState('')
  const [agreements, setAgreements] = useState('')
  const [payment, setPayment] = useState('Port payé')

  return (
    <div
      className="p-4 rounded-lg border mb-4 print-hide"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
    >
      <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Émettre le CMR — Informations complémentaires
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Case 21 — Établi à
          </label>
          <input
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Case 14 — Affranchissement
          </label>
          <input
            type="text"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Case 13 — Instructions de l'expéditeur
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 rounded text-sm border resize-y"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            placeholder="Température, conditions de livraison, consignes particulières..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Case 5 — Documents annexés
          </label>
          <input
            type="text"
            value={docs}
            onChange={(e) => setDocs(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            placeholder="Bons de livraison, bordereaux..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Case 19 — Conventions particulières
          </label>
          <input
            type="text"
            value={agreements}
            onChange={(e) => setAgreements(e.target.value)}
            className="w-full px-2 py-1.5 rounded text-sm border"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={() =>
            onIssue({
              establishment_place: place || undefined,
              sender_instructions: instructions || undefined,
              attached_documents: docs || undefined,
              special_agreements: agreements || undefined,
              payment_instructions: payment || undefined,
            })
          }
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#dc2626' }}
        >
          {loading ? 'Émission en cours...' : 'Émettre le CMR (figer)'}
        </button>
      </div>
    </div>
  )
}

export function TourWaybill({ tourId, onClose }: TourWaybillProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<WaybillData | null>(null)
  const [archive, setArchive] = useState<WaybillArchive | null>(null)
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [showIssueForm, setShowIssueForm] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/tours/${tourId}/waybill`)
      .then((r) => {
        setData(r.data)
        // Si un CMR archivé existe, charger les détails complets
        if (r.data.cmr_archive) {
          return api.get(`/tours/${tourId}/cmr`).then((cr) => setArchive(cr.data))
        }
      })
      .catch((e) => console.error('Failed to load waybill', e))
      .finally(() => setLoading(false))
  }, [tourId])

  const handleIssue = async (formData: Record<string, string | undefined>) => {
    setIssuing(true)
    try {
      const res = await api.post(`/tours/${tourId}/cmr/`, { tour_id: tourId, ...formData })
      setArchive(res.data)
      // Recharger waybill pour avoir cmr_archive
      const wb = await api.get(`/tours/${tourId}/waybill`)
      setData(wb.data)
      setShowIssueForm(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      alert(msg)
    } finally {
      setIssuing(false)
    }
  }

  const deliveryDateStr = data?.delivery_date ?? data?.date ?? ''
  const formattedDate = deliveryDateStr
    ? new Date(deliveryDateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : ''
  const longDate = deliveryDateStr
    ? new Date(deliveryDateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : ''

  // Données CMR : si archivé, utiliser le snapshot ; sinon données live
  const cmrData = archive?.snapshot_json ? JSON.parse(archive.snapshot_json) as WaybillData : data
  const isIssued = !!archive && archive.status !== 'DRAFT'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Toolbar (masquée impression) */}
      <div
        className="print-hide flex items-center justify-between px-6 py-3 border-b"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            LETTRE DE VOITURE — CMR
          </h2>
          {archive && (
            <span
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{
                backgroundColor:
                  archive.status === 'ISSUED' ? 'rgba(34,197,94,0.15)' :
                  archive.status === 'DELIVERED' ? 'rgba(59,130,246,0.15)' :
                  archive.status === 'CANCELLED' ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)',
                color:
                  archive.status === 'ISSUED' ? '#22c55e' :
                  archive.status === 'DELIVERED' ? '#3b82f6' :
                  archive.status === 'CANCELLED' ? '#ef4444' : '#f97316',
              }}
            >
              {archive.cmr_number} — {archive.status}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          {!isIssued && !showIssueForm && (
            <button
              onClick={() => setShowIssueForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#dc2626' }}
            >
              Émettre le CMR
            </button>
          )}
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

      {/* Contenu imprimable */}
      <div className="flex-1 overflow-y-auto p-4 print-content">
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            {t('common.loading')}
          </p>
        ) : !data || !cmrData ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            {t('common.noData')}
          </p>
        ) : (
          <>
            {/* Formulaire d'émission (avant impression) */}
            {showIssueForm && !isIssued && (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <CMRIssueForm
                  onIssue={handleIssue}
                  loading={issuing}
                  defaultPlace={data.base?.city || ''}
                />
              </div>
            )}

            {/* ═══ DOCUMENT CMR — 24 CASES ═══ */}
            <div style={{ maxWidth: '800px', margin: '0 auto' }} className="cmr-document">
              {/* En-tête CMR / CMR Header */}
              <div style={{ border: '3px solid #cc0000', marginBottom: '0' }}>

                {/* ═══ ROW 1 : Case 1 (Expéditeur) | Header + Case 16 (Transporteur) ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
                  {/* Case 1 — Expéditeur / Sender */}
                  <div style={{ ...caseStyle, borderRight: B }}>
                    <CaseHeader n={1} label="Expéditeur (nom, adresse, pays)" />
                    <div style={caseContent}>
                      {cmrData.base ? (
                        <>
                          <strong>{cmrData.base.name}</strong><br />
                          {cmrData.base.address}<br />
                          {cmrData.base.postal_code} {cmrData.base.city}
                        </>
                      ) : '—'}
                    </div>
                  </div>

                  {/* Header CMR + Case 16 */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Titre CMR / CMR title */}
                    <div style={{ textAlign: 'center', padding: '4px 8px', borderBottom: B, backgroundColor: '#fef2f2' }}>
                      <div style={{ fontSize: '7px', color: '#cc0000', lineHeight: 1.2, marginBottom: '2px' }}>
                        Convention relative au contrat de transport international
                        de marchandises par route (CMR)
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#cc0000', letterSpacing: '3px' }}>
                        LETTRE DE VOITURE
                      </div>
                      {(archive?.cmr_number || data.cmr_archive?.cmr_number) && (
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#cc0000', marginTop: '2px' }}>
                          N° {archive?.cmr_number || data.cmr_archive?.cmr_number}
                        </div>
                      )}
                      {!archive && !data.cmr_archive && (
                        <div style={{ fontSize: '9px', color: '#999', marginTop: '2px' }}>
                          APERÇU — non émis
                        </div>
                      )}
                    </div>
                    {/* Case 16 — Transporteur / Carrier */}
                    <div style={caseStyle}>
                      <CaseHeader n={16} label="Transporteur (nom, adresse, pays)" />
                      <div style={caseContent}>
                        {cmrData.contract ? (
                          <>
                            <strong>{cmrData.contract.transporter_name}</strong>
                            {cmrData.contract.carrier_address && (
                              <>
                                <br />
                                {cmrData.contract.carrier_address}
                                {cmrData.contract.carrier_postal_code && `, ${cmrData.contract.carrier_postal_code}`}
                                {cmrData.contract.carrier_city && ` ${cmrData.contract.carrier_city}`}
                                {cmrData.contract.carrier_country && ` (${cmrData.contract.carrier_country})`}
                              </>
                            )}
                            {cmrData.contract.carrier_transport_license && (
                              <><br />Licence : {cmrData.contract.carrier_transport_license}</>
                            )}
                            {cmrData.contract.carrier_siren && (
                              <><br />SIREN : {cmrData.contract.carrier_siren}</>
                            )}
                          </>
                        ) : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══ ROW 2 : Case 2 (Destinataire) | Case 17 (Transporteurs successifs) ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
                  <div style={{ ...caseStyle, borderRight: B }}>
                    <CaseHeader n={2} label="Destinataire (nom, adresse, pays)" />
                    <div style={caseContent}>
                      {cmrData.stops.length === 1 ? (
                        <>
                          <strong>{cmrData.stops[0].pdv_name}</strong><br />
                          {cmrData.stops[0].address}<br />
                          {cmrData.stops[0].postal_code} {cmrData.stops[0].city}
                        </>
                      ) : cmrData.stops.length > 1 ? (
                        <>
                          <strong>Tournée multi-points — {cmrData.stops.length} arrêts</strong><br />
                          <span style={{ fontSize: '8px' }}>
                            {cmrData.stops.map(s => s.pdv_code).join(', ')}
                          </span>
                        </>
                      ) : '—'}
                    </div>
                  </div>
                  <div style={caseStyle}>
                    <CaseHeader n={17} label="Transporteurs successifs (nom, adresse, pays)" />
                    <div style={caseContent}>—</div>
                  </div>
                </div>

                {/* ═══ ROW 3 : Case 3 (Lieu livraison) | Case 18 (Réserves) ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
                  <div style={{ ...caseStyle, borderRight: B }}>
                    <CaseHeader n={3} label="Lieu prévu pour la livraison (lieu, pays)" />
                    <div style={caseContent}>
                      {cmrData.stops.length === 1 ? (
                        <>{cmrData.stops[0].postal_code} {cmrData.stops[0].city}</>
                      ) : cmrData.stops.length > 1 ? (
                        <>
                          {cmrData.stops[0].city} → {cmrData.stops[cmrData.stops.length - 1].city}
                          <br />
                          <span style={{ fontSize: '8px' }}>Voir détail des arrêts ci-dessous</span>
                        </>
                      ) : '—'}
                    </div>
                  </div>
                  <div style={caseStyle}>
                    <CaseHeader n={18} label="Réserves et observations du transporteur" />
                    <div style={caseContent}>
                      {archive?.reservations || <span style={{ color: '#999', fontSize: '8px' }}>À compléter par le transporteur</span>}
                    </div>
                  </div>
                </div>

                {/* ═══ ROW 4 : Case 4 (Lieu/date prise en charge) | Case 19 (Conventions) ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
                  <div style={{ ...caseStyle, borderRight: B }}>
                    <CaseHeader n={4} label="Lieu et date de la prise en charge" />
                    <div style={caseContent}>
                      {cmrData.base ? (
                        <>
                          {cmrData.base.city}<br />
                          {longDate}
                          {cmrData.departure_time && ` — Départ : ${cmrData.departure_time}`}
                        </>
                      ) : '—'}
                    </div>
                  </div>
                  <div style={caseStyle}>
                    <CaseHeader n={19} label="Conventions particulières" />
                    <div style={caseContent}>
                      {archive?.special_agreements || '—'}
                    </div>
                  </div>
                </div>

                {/* ═══ ROW 5 : Case 5 (Documents annexés) | Case 20 (À payer par) — partial ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
                  <div style={{ ...caseStyle, borderRight: B }}>
                    <CaseHeader n={5} label="Documents annexés" />
                    <div style={caseContent}>
                      {archive?.attached_documents || 'Bons de livraison'}
                    </div>
                  </div>
                  <div style={caseStyle}>
                    <CaseHeader n={20} label="À payer par" />
                    <div style={caseContent}>
                      <span style={{ fontSize: '8px' }}>
                        Expéditeur : selon contrat {cmrData.contract?.code || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ═══ GOODS TABLE : Cases 6-12 ═══ */}
                <div style={{ borderBottom: B }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 50px 70px 1fr 60px 70px 60px', borderBottom: B }}>
                    <div style={{ ...thStyle, borderRight: B }}>
                      <CaseHeaderInline n={6} label="Marques et n°" />
                    </div>
                    <div style={{ ...thStyle, borderRight: B }}>
                      <CaseHeaderInline n={7} label="Nb colis" />
                    </div>
                    <div style={{ ...thStyle, borderRight: B }}>
                      <CaseHeaderInline n={8} label="Emballage" />
                    </div>
                    <div style={{ ...thStyle, borderRight: B }}>
                      <CaseHeaderInline n={9} label="Nature de la marchandise" />
                    </div>
                    <div style={{ ...thStyle, borderRight: B }}>
                      <CaseHeaderInline n={10} label="N° stat." />
                    </div>
                    <div style={{ ...thStyle, borderRight: B }}>
                      <CaseHeaderInline n={11} label="Poids brut kg" />
                    </div>
                    <div style={thStyle}>
                      <CaseHeaderInline n={12} label="Volume m³" />
                    </div>
                  </div>
                  {/* Lignes de marchandises / Goods rows */}
                  {cmrData.stops.map((stop, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '80px 50px 70px 1fr 60px 70px 60px',
                        borderBottom: idx < cmrData.stops.length - 1 ? '1px solid #e5e5e5' : undefined,
                        fontSize: '9px',
                      }}
                    >
                      <div style={{ ...tdStyle, borderRight: B, fontWeight: 'bold' }}>{stop.pdv_code}</div>
                      <div style={{ ...tdStyle, borderRight: B, textAlign: 'center' }}>{stop.eqp_count}</div>
                      <div style={{ ...tdStyle, borderRight: B, fontSize: '8px' }}>Roll / Palette</div>
                      <div style={{ ...tdStyle, borderRight: B }}>
                        Denrées alim.
                        {stop.temperature_classes?.length > 0 && (
                          <span style={{ color: '#cc0000', marginLeft: '4px' }}>
                            ({stop.temperature_classes.join('/')})
                          </span>
                        )}
                        <span style={{ color: '#666', marginLeft: '4px', fontSize: '8px' }}>
                          — {stop.pdv_name}
                        </span>
                      </div>
                      <div style={{ ...tdStyle, borderRight: B, textAlign: 'center', color: '#999' }}>—</div>
                      <div style={{ ...tdStyle, borderRight: B, textAlign: 'right' }}>
                        {stop.weight_kg ? `${stop.weight_kg}` : '—'}
                      </div>
                      <div style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>—</div>
                    </div>
                  ))}
                  {/* Total row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 50px 70px 1fr 60px 70px 60px',
                      borderTop: '2px solid #cc0000',
                      fontSize: '10px',
                      fontWeight: 'bold',
                    }}
                  >
                    <div style={{ ...tdStyle, borderRight: B }}>TOTAL</div>
                    <div style={{ ...tdStyle, borderRight: B, textAlign: 'center' }}>{cmrData.total_eqp}</div>
                    <div style={{ ...tdStyle, borderRight: B }}></div>
                    <div style={{ ...tdStyle, borderRight: B }}>
                      {cmrData.stops.length} arrêt{cmrData.stops.length > 1 ? 's' : ''}
                    </div>
                    <div style={{ ...tdStyle, borderRight: B }}></div>
                    <div style={{ ...tdStyle, borderRight: B, textAlign: 'right' }}>{cmrData.total_weight_kg} kg</div>
                    <div style={tdStyle}></div>
                  </div>
                </div>

                {/* ═══ ROW : Case 13 (Instructions expéditeur) — full width ═══ */}
                <div style={{ borderBottom: B }}>
                  <div style={caseStyle}>
                    <CaseHeader n={13} label="Instructions de l'expéditeur" />
                    <div style={caseContent}>
                      {archive?.sender_instructions || (
                        <>
                          {cmrData.contract?.temperature_type && (
                            <>Température : {cmrData.contract.temperature_type}<br /></>
                          )}
                          {cmrData.remarks && <>Remarques : {cmrData.remarks}</>}
                          {!cmrData.contract?.temperature_type && !cmrData.remarks && '—'}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ ROW : Case 14 (Affranchissement) | Case 15 (Remboursement) ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
                  <div style={{ ...caseStyle, borderRight: B }}>
                    <CaseHeader n={14} label="Prescriptions d'affranchissement" />
                    <div style={caseContent}>
                      {archive?.payment_instructions || 'Port payé'}
                    </div>
                  </div>
                  <div style={caseStyle}>
                    <CaseHeader n={15} label="Remboursement" />
                    <div style={caseContent}>
                      {archive?.cash_on_delivery || '—'}
                    </div>
                  </div>
                </div>

                {/* ═══ ROW : Véhicule (info supplémentaire) ═══ */}
                <div style={{ borderBottom: B, padding: '4px 8px', fontSize: '9px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <span>
                    <strong>Véhicule :</strong>{' '}
                    {cmrData.contract?.vehicle_name || cmrData.contract?.vehicle_code || '—'}
                    {cmrData.vehicle_license_plate && ` — ${cmrData.vehicle_license_plate}`}
                    {cmrData.contract?.temperature_type && ` (${cmrData.contract.temperature_type})`}
                  </span>
                  {cmrData.tractor_license_plate && (
                    <span><strong>Tracteur :</strong> {cmrData.tractor_license_plate}</span>
                  )}
                  {cmrData.trailer_number && (
                    <span><strong>Remorque :</strong> {cmrData.trailer_number}</span>
                  )}
                  <span>
                    <strong>Chauffeur :</strong> {cmrData.driver_name || '—'}
                  </span>
                  <span>
                    <strong>Contrat :</strong> {cmrData.contract?.code || '—'}
                  </span>
                  {cmrData.contract?.carrier_vat_number && (
                    <span><strong>TVA :</strong> {cmrData.contract.carrier_vat_number}</span>
                  )}
                </div>

                {/* ═══ ROW : Case 21 + Signatures (22, 23, 24) ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {/* Case 21 + 22 — Établi à + Signature expéditeur */}
                  <div style={{ borderRight: B }}>
                    <div style={{ ...caseStyle, borderBottom: B }}>
                      <CaseHeader n={21} label="Établi à" />
                      <div style={caseContent}>
                        {archive?.establishment_place || cmrData.base?.city || '—'}
                        {', le '}
                        {archive?.establishment_date
                          ? new Date(archive.establishment_date + 'T00:00:00').toLocaleDateString('fr-FR')
                          : formattedDate}
                      </div>
                    </div>
                    <div style={caseStyle}>
                      <CaseHeader n={22} label="Signature de l'expéditeur" />
                      <div style={{ height: '60px', padding: '4px 8px' }}>
                        {archive?.sender_signed_at && (
                          <span style={{ fontSize: '8px', color: '#22c55e' }}>
                            Signé le {new Date(archive.sender_signed_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Case 23 — Signature transporteur */}
                  <div style={{ borderRight: B }}>
                    <div style={caseStyle}>
                      <CaseHeader n={23} label="Signature du transporteur" />
                      <div style={{ height: '88px', padding: '4px 8px' }}>
                        {archive?.carrier_signed_at && (
                          <span style={{ fontSize: '8px', color: '#22c55e' }}>
                            Signé le {new Date(archive.carrier_signed_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Case 24 — Marchandise reçue */}
                  <div>
                    <div style={caseStyle}>
                      <CaseHeader n={24} label="Marchandise reçue le" />
                      <div style={{ height: '88px', padding: '4px 8px' }}>
                        {archive?.recipient_signed_at && (
                          <>
                            <span style={{ fontSize: '8px', color: '#22c55e' }}>
                              Reçue le {new Date(archive.recipient_signed_at).toLocaleDateString('fr-FR')}
                            </span>
                            {archive?.recipient_name && (
                              <><br /><span style={{ fontSize: '8px' }}>Par : {archive.recipient_name}</span></>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
              {/* Pied de page / Footer */}
              <div style={{ fontSize: '7px', color: '#999', textAlign: 'center', marginTop: '4px' }}>
                Convention relative au contrat de transport international de marchandises par route (CMR) — Genève, 19 mai 1956
                {archive && (
                  <> — CMR N° {archive.cmr_number} — Émis le {archive.issued_at ? new Date(archive.issued_at).toLocaleDateString('fr-FR') : '—'}</>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Sous-composants / Sub-components ─── */

function CaseHeader({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: '2px 8px 0', lineHeight: 1 }}>
      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#cc0000', minWidth: '16px' }}>{n}</span>
      <span style={{ fontSize: '7px', color: '#cc0000', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

function CaseHeaderInline({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
      <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#cc0000' }}>{n}</span>
      <br />
      <span style={{ fontSize: '7px', color: '#cc0000' }}>{label}</span>
    </div>
  )
}

/* ─── Styles ─── */

const B = '1px solid #cc0000'

const caseStyle: React.CSSProperties = {
  minHeight: '40px',
}

const caseContent: React.CSSProperties = {
  padding: '2px 8px 4px',
  fontSize: '10px',
  color: '#000',
  lineHeight: 1.4,
}

const thStyle: React.CSSProperties = {
  padding: '3px 4px',
  backgroundColor: '#fef2f2',
}

const tdStyle: React.CSSProperties = {
  padding: '2px 4px',
  lineHeight: 1.3,
}
