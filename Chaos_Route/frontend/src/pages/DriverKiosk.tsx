/* Borne chauffeur / Driver kiosk.
   Page publique plein ecran pour PC verrouille a l'accueil.
   Le chauffeur saisit son n° commande, plaque, telephone → check-in. */

import { useState } from 'react'
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export default function DriverKiosk() {
  const [orderNum, setOrderNum] = useState('')
  const [plate, setPlate] = useState('')
  const [phone, setPhone] = useState('')
  const [driverName, setDriverName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleCheckin = async () => {
    if (!orderNum || !plate || !phone) return
    setStatus('loading')
    try {
      await api.post('/reception-booking/checkin/', {
        order_number: orderNum,
        license_plate: plate.toUpperCase(),
        phone_number: phone,
        driver_name: driverName || null,
      })
      setStatus('success')
      setMessage(`Check-in confirme. Veuillez patienter en zone d'attente. Vous recevrez un SMS avec votre numero de quai.`)
      // Reset apres 10s
      setTimeout(() => {
        setOrderNum(''); setPlate(''); setPhone(''); setDriverName('')
        setStatus('idle'); setMessage('')
      }, 10000)
    } catch (err: unknown) {
      setStatus('error')
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Erreur inconnue'
      setMessage(detail)
      setTimeout(() => { setStatus('idle'); setMessage('') }, 8000)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#0f172a', padding: '24px',
    }}>
      {/* Ecran de succes */}
      {status === 'success' && (
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <div style={{
            width: '120px', height: '120px', borderRadius: '50%',
            backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px', fontSize: '64px', color: 'white',
          }}>OK</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>
            Bienvenue
          </div>
          <div style={{ fontSize: '18px', color: '#94a3b8', lineHeight: '1.6' }}>
            {message}
          </div>
          <div style={{ fontSize: '14px', color: '#475569', marginTop: '32px' }}>
            Retour automatique dans 10 secondes...
          </div>
        </div>
      )}

      {/* Ecran d'erreur */}
      {status === 'error' && (
        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
          <div style={{
            width: '120px', height: '120px', borderRadius: '50%',
            backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px', fontSize: '48px', color: 'white',
          }}>!</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>
            Erreur
          </div>
          <div style={{ fontSize: '18px', color: '#f87171', lineHeight: '1.6' }}>
            {message}
          </div>
          <div style={{ fontSize: '14px', color: '#475569', marginTop: '32px' }}>
            Veuillez vous adresser a l'accueil.
          </div>
        </div>
      )}

      {/* Formulaire check-in */}
      {(status === 'idle' || status === 'loading') && (
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#f97316', marginBottom: '8px' }}>
              BORNE CHAUFFEUR
            </div>
            <div style={{ fontSize: '16px', color: '#64748b' }}>
              Enregistrez votre arrivee
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                N° de commande *
              </label>
              <input type="text" value={orderNum} onChange={(e) => setOrderNum(e.target.value)}
                placeholder="Saisir ou scanner le numero"
                autoFocus
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #334155',
                  backgroundColor: '#1e293b', color: 'white', fontSize: '20px', textAlign: 'center',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                Plaque d'immatriculation *
              </label>
              <input type="text" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="1-ABC-123"
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #334155',
                  backgroundColor: '#1e293b', color: 'white', fontSize: '20px', textAlign: 'center',
                  fontFamily: 'monospace', letterSpacing: '2px', outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                Telephone portable * (pour recevoir le n° de quai)
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+32 xxx xx xx xx"
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #334155',
                  backgroundColor: '#1e293b', color: 'white', fontSize: '20px', textAlign: 'center',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                Votre nom (optionnel)
              </label>
              <input type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)}
                style={{
                  width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #334155',
                  backgroundColor: '#1e293b', color: 'white', fontSize: '20px', textAlign: 'center',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>

            <button onClick={handleCheckin}
              disabled={!orderNum || !plate || !phone || status === 'loading'}
              style={{
                width: '100%', padding: '20px', borderRadius: '12px', border: 'none',
                backgroundColor: (!orderNum || !plate || !phone) ? '#334155' : '#f97316',
                color: 'white', fontSize: '20px', fontWeight: 700,
                cursor: (!orderNum || !plate || !phone) ? 'default' : 'pointer',
                marginTop: '8px',
              }}>
              {status === 'loading' ? 'Enregistrement...' : 'ENREGISTRER MON ARRIVEE'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '12px', color: '#475569' }}>
            Chaos Route Manager
          </div>
        </div>
      )}
    </div>
  )
}
