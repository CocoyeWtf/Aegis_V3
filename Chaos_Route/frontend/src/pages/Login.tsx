/* Page de connexion / Login page */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../services/api'
import { useAuthStore, type UserInfo } from '../stores/useAuthStore'
import { getDefaultRoute } from '../utils/getDefaultRoute'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Login
      const { data: tokens } = await api.post('/auth/login', { username, password })
      setTokens(tokens.access_token, tokens.refresh_token)

      // Charger le profil / Load profile
      const { data: me } = await api.get('/auth/me')
      setUser(me)

      // Rediriger vers la première page accessible / Redirect to first accessible page
      navigate(getDefaultRoute(me))
    } catch {
      setError(t('auth.loginError'))
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
            {t('auth.login')}
          </p>
        </div>

        {/* Formulaire / Form */}
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
        </form>
      </div>
    </div>
  )
}
