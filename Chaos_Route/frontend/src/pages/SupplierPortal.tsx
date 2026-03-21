/* Portail fournisseur self-service / Supplier self-service portal.
   Page publique — pas d'auth. Le fournisseur choisit un créneau et réserve. */

import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

interface Base { id: number; code: string; name: string }
interface Slot { start_time: string; end_time: string; duration_minutes: number }

const DOCK_TYPE_LABELS: Record<string, string> = { SEC: 'Sec', FRAIS: 'Frais', GEL: 'Gel', FFL: 'FFL' }
const DOCK_TYPE_COLORS: Record<string, string> = { SEC: '#a3a3a3', FRAIS: '#3b82f6', GEL: '#8b5cf6', FFL: '#22c55e' }

export default function SupplierPortal() {
  const [step, setStep] = useState<'form' | 'slots' | 'confirm'>('form')

  // Form
  const [supplierName, setSupplierName] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [palletCount, setPalletCount] = useState('')
  const [dockType, setDockType] = useState('SEC')
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [bases, setBases] = useState<Base[]>([])
  const [selectedBaseId, setSelectedBaseId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')

  // Slots
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Confirmation
  const [bookingResult, setBookingResult] = useState<{ message: string; booking_id: number } | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Charger les bases / Load bases (public endpoint needed — fallback to hardcoded)
  useEffect(() => {
    api.get('/reception-booking/supplier-portal/bases/').then((res) => setBases(res.data))
      .catch(() => {
        // Fallback: try the auth-protected endpoint (won't work without token, but try)
        api.get('/bases/').then((res) => setBases(res.data)).catch(() => {})
      })
  }, [])

  const fetchSlots = useCallback(async () => {
    if (!selectedBaseId || !palletCount || Number(palletCount) <= 0) return
    setLoadingSlots(true)
    setError('')
    try {
      const res = await api.get('/reception-booking/supplier-portal/slots/', {
        params: { base_id: selectedBaseId, date: selectedDate, dock_type: dockType, pallet_count: Number(palletCount) },
      })
      setSlots(res.data)
      setSelectedSlot(null)
      setStep('slots')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      setError(detail)
    } finally { setLoadingSlots(false) }
  }, [selectedBaseId, selectedDate, dockType, palletCount])

  const handleBook = async () => {
    if (!selectedSlot || !selectedBaseId || !supplierName) return
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post('/reception-booking/supplier-portal/book/', {
        base_id: Number(selectedBaseId),
        dock_type: dockType,
        booking_date: selectedDate,
        start_time: selectedSlot.start_time,
        pallet_count: Number(palletCount),
        supplier_name: supplierName,
        order_number: orderNumber || null,
        notes: notes || null,
      })
      setBookingResult(res.data)
      setStep('confirm')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur'
      setError(detail)
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            Portail Fournisseur
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Reservez votre creneau de reception
          </p>
        </div>

        {/* ── STEP 1: Formulaire ── */}
        {step === 'form' && (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '20px' }}>
              Informations livraison
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                  Nom fournisseur *
                </label>
                <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                  N° commande (Rd)
                </label>
                <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                    Base de reception *
                  </label>
                  <select value={selectedBaseId} onChange={(e) => setSelectedBaseId(Number(e.target.value) || '')}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
                    <option value="">-- Choisir --</option>
                    {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                    Type de produit *
                  </label>
                  <select value={dockType} onChange={(e) => setDockType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
                    {Object.entries(DOCK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                    Date de livraison *
                  </label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                    Nombre de palettes *
                  </label>
                  <input type="number" min={1} max={33} value={palletCount} onChange={(e) => setPalletCount(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>Notes</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }} />
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}

              <button onClick={fetchSlots}
                disabled={!supplierName || !selectedBaseId || !palletCount || Number(palletCount) <= 0 || loadingSlots}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#f97316', color: 'white', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', opacity: (!supplierName || !selectedBaseId || !palletCount) ? 0.5 : 1,
                }}>
                {loadingSlots ? 'Recherche...' : 'Voir les creneaux disponibles'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Selection créneau ── */}
        {step === 'slots' && (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                Creneaux disponibles
              </h2>
              <button onClick={() => setStep('form')} style={{ fontSize: '12px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Modifier
              </button>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span>{supplierName}</span>
              <span>{palletCount} palettes</span>
              <span style={{ color: DOCK_TYPE_COLORS[dockType] }}>{DOCK_TYPE_LABELS[dockType]}</span>
              <span>{selectedDate}</span>
            </div>

            {slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                Aucun creneau disponible pour cette date.
                <br /><button onClick={() => setStep('form')} style={{ color: '#f97316', border: 'none', background: 'none', cursor: 'pointer', marginTop: '8px' }}>
                  Essayer une autre date
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '20px' }}>
                  {slots.map((s) => (
                    <button key={s.start_time} onClick={() => setSelectedSlot(s)}
                      style={{
                        padding: '12px 8px', borderRadius: '8px', border: '2px solid',
                        borderColor: selectedSlot?.start_time === s.start_time ? '#f97316' : '#e2e8f0',
                        backgroundColor: selectedSlot?.start_time === s.start_time ? '#fff7ed' : 'white',
                        cursor: 'pointer', textAlign: 'center',
                      }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{s.start_time}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{s.start_time}-{s.end_time}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>{s.duration_minutes} min</div>
                    </button>
                  ))}
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

                <button onClick={handleBook}
                  disabled={!selectedSlot || submitting}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#f97316', color: 'white', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer', opacity: !selectedSlot ? 0.5 : 1,
                  }}>
                  {submitting ? 'Reservation en cours...' : `Reserver ${selectedSlot ? selectedSlot.start_time + '-' + selectedSlot.end_time : ''}`}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Confirmation ── */}
        {step === 'confirm' && bookingResult && (
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: '32px', color: '#22c55e' }}>OK</span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Reservation confirmee
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              {bookingResult.message}
            </p>
            <div style={{ backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}><strong>Fournisseur:</strong> {supplierName}</div>
              <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}><strong>Date:</strong> {selectedDate}</div>
              <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}><strong>Palettes:</strong> {palletCount}</div>
              {orderNumber && <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '4px' }}><strong>Commande:</strong> {orderNumber}</div>}
              <div style={{ fontSize: '13px', color: '#0f172a' }}><strong>Ref booking:</strong> #{bookingResult.booking_id}</div>
            </div>
            <button onClick={() => { setStep('form'); setBookingResult(null); setPalletCount(''); setOrderNumber(''); setNotes('') }}
              style={{
                padding: '12px 24px', borderRadius: '8px', border: 'none',
                backgroundColor: '#f97316', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}>
              Nouvelle reservation
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: '#94a3b8' }}>
          Chaos Route Manager
        </div>
      </div>
    </div>
  )
}
