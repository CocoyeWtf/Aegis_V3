/* Page de réinitialisation de mot de passe / Password reset page */

import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  // Mode "demande email" si pas de token, "nouveau mdp" si token présent
  const [mode] = useState<'request' | 'reset'>(token ? 'reset' : 'request')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSuccess('Si cette adresse existe, un email de réinitialisation a été envoyé.')
    } catch {
      setError('Erreur lors de la demande. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 4) {
      setError('Le mot de passe doit contenir au moins 4 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword })
      setSuccess('Mot de passe réinitialisé avec succès !')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl border shadow-2xl p-8"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="text-center mb-8">
          <span className="text-4xl">🔥</span>
          <h1 className="text-xl font-bold mt-2" style={{ color: 'var(--color-primary)' }}>
            Chaos Route
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {mode === 'request' ? 'Mot de passe oublié' : 'Nouveau mot de passe'}
          </p>
        </div>

        {success ? (
          <div>
            <div
              className="text-sm text-center py-3 px-3 rounded-lg mb-4"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}
            >
              {success}
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : mode === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Saisissez l'adresse email associée à votre compte. Vous recevrez un lien de réinitialisation.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {error && (
              <div
                className="text-sm text-center py-2 px-3 rounded-lg"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              Retour à la connexion
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {error && (
              <div
                className="text-sm text-center py-2 px-3 rounded-lg"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? 'Enregistrement...' : 'Réinitialiser'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
