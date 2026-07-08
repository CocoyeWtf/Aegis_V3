/* Gestion du second facteur TOTP / TOTP second-factor management (STIME B7).
   Enrôlement : le secret n'est affiché qu'une fois — saisie manuelle ou URI
   otpauth dans Google Authenticator / Aegis / FreeOTP, puis activation par code. */

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../services/api'
import { useAuthStore } from '../../stores/useAuthStore'

interface Props {
  onClose: () => void
}

export function MfaDialog({ onClose }: Props) {
  const { user, setUser } = useAuthStore()
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const mfaEnabled = user?.mfa_enabled ?? false

  const refreshMe = async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch { /* non bloquant */ }
  }

  const handleEnroll = async () => {
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/auth/mfa/enroll')
      setSecret(data.secret)
      setOtpauthUri(data.otpauth_uri)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || "Erreur lors de l'enrôlement")
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/mfa/activate', { code })
      setSuccess('MFA activé : un code sera demandé à chaque connexion')
      setSecret(null)
      setOtpauthUri(null)
      setCode('')
      await refreshMe()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Code incorrect')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async () => {
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/mfa/disable', { password, code })
      setSuccess('MFA désactivé')
      setCode('')
      setPassword('')
      await refreshMe()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Échec de la désactivation')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-tertiary)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Double authentification (MFA)
        </h2>

        {success && (
          <div className="text-sm py-2 px-3 rounded-lg"
               style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success, #22c55e)' }}>
            {success}
          </div>
        )}

        {!mfaEnabled && !secret && !success && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Protégez votre compte avec un code à usage unique généré par une
              application d'authentification (Google Authenticator, Aegis, FreeOTP…).
            </p>
            <button onClick={handleEnroll} disabled={loading}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
              {loading ? 'Génération…' : 'Commencer l’enrôlement'}
            </button>
          </>
        )}

        {secret && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <strong>Scannez ce QR code</strong> avec votre application
              d'authentification (Google Authenticator, Aegis, FreeOTP…) —
              bouton « + » → « Scanner un QR code » :
            </p>
            {otpauthUri && (
              <div className="flex justify-center py-2">
                <div className="p-3 rounded-lg bg-white">
                  <QRCodeSVG value={otpauthUri} size={168} />
                </div>
              </div>
            )}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ou par <strong>saisie manuelle</strong> (« Saisir une clé de
              configuration », type « basée sur l'heure ») avec cette clé,
              affichée une seule fois :
            </p>
            <div className="text-sm font-mono break-all py-2 px-3 rounded-lg border" style={inputStyle}>
              {secret}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Puis saisissez ci-dessous le code à 6 chiffres affiché par l'application :
            </p>
            <input
              type="text" inputMode="numeric" placeholder="Code à 6 chiffres"
              value={code} onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle}
            />
            <button onClick={handleActivate} disabled={loading || code.length < 6}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
              {loading ? 'Vérification…' : 'Activer le MFA'}
            </button>
          </>
        )}

        {mfaEnabled && !success && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Le MFA est <strong>actif</strong> sur votre compte. Pour le désactiver,
              confirmez votre mot de passe et un code valide.
            </p>
            <input
              type="password" placeholder="Mot de passe"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle}
            />
            <input
              type="text" inputMode="numeric" placeholder="Code à 6 chiffres"
              value={code} onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inputStyle}
            />
            <button onClick={handleDisable} disabled={loading || !password || code.length < 6}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-danger, #ef4444)' }}>
              {loading ? '…' : 'Désactiver le MFA'}
            </button>
          </>
        )}

        {error && (
          <div className="text-sm py-2 px-3 rounded-lg"
               style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <button onClick={onClose} className="w-full py-2 rounded-lg text-sm border"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          Fermer
        </button>
      </div>
    </div>
  )
}
