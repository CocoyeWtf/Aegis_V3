/* Page de connexion / Login page */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { useAuthStore } from '../stores/useAuthStore'
import { useAppStore } from '../stores/useAppStore'
import { getDefaultRoute } from '../utils/getDefaultRoute'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Rotation forcée du mot de passe (compte seedé) / Forced password rotation (seeded account)
  const [mustChange, setMustChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const finishLogin = async () => {
    // Charger le profil / Load profile
    const { data: me } = await api.get('/auth/me')
    setUser(me)

    // Auto-selectionner la region si une seule / Auto-select region if user has exactly one
    if (me.regions?.length === 1) {
      useAppStore.getState().setSelectedRegion(me.regions[0].id)
    }

    // Rediriger vers la première page accessible / Redirect to first accessible page
    navigate(getDefaultRoute(me))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Login — les jetons arrivent en cookies HttpOnly (STIME A4), le corps
      // ne sert qu'aux indicateurs (must_change_password)
      const { data: tokens } = await api.post('/auth/login', { username, password })

      // Mot de passe initial à remplacer avant tout usage / Initial password must be replaced
      if (tokens.must_change_password) {
        setMustChange(true)
        return
      }

      await finishLogin()
    } catch {
      setError(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await api.put('/auth/change-password', {
        current_password: password,
        new_password: newPassword,
      })
      await finishLogin()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : detail?.[0]?.msg?.replace(/^Value error, /, '') || t('auth.loginError')
      )
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
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-4xl">🔥</span>
          <h1 className="text-xl font-bold mt-2" style={{ color: 'var(--color-primary)' }}>
            Chaos Route
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {mustChange ? 'Nouveau mot de passe requis' : t('auth.login')}
          </p>
        </div>

        {/* Rotation forcée du mot de passe / Forced password rotation */}
        {mustChange ? (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Votre mot de passe initial doit être remplacé avant de continuer
              (12 caractères minimum, 14 pour un administrateur, avec majuscules,
              minuscules, chiffres ou symboles).
            </p>
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
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? t('common.loading') : 'Changer le mot de passe'}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              {t('auth.username')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {loading ? t('common.loading') : t('auth.loginButton')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/reset-password')}
              className="text-xs font-medium transition-colors hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Mot de passe oublié ?
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
