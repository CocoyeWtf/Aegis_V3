/* Dialogue de confirmation / Confirmation dialog (for delete, etc.) */

import { useTranslation } from 'react-i18next'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  loading?: boolean
  danger?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, loading, danger = true }: ConfirmDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-sm"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{message}</p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
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
