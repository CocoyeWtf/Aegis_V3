/* Dialogue de confirmation avec mot de passe / Password confirmation dialog */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PasswordConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (password: string) => void
  title: string
  message: string
  loading?: boolean
  danger?: boolean
  error?: string | null
}

export function PasswordConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  danger = false,
  error,
}: PasswordConfirmDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  if (!open) return null

  const handleConfirm = () => {
    if (!password.trim()) return
    onConfirm(password)
  }

  const handleClose = () => {
    setPassword('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-sm"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{message}</p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="Mot de passe"
            autoFocus
            className="w-full px-3 py-2 rounded-lg border text-sm mb-2"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: error ? 'var(--color-danger)' : 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />

          {error && (
            <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !password.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: danger ? 'var(--color-danger)' : 'var(--color-primary)' }}
            >
              {loading ? t('common.loading') : t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
