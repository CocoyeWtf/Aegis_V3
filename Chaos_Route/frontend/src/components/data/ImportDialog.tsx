/* Dialogue d'import CSV/Excel / Import dialog for CSV/Excel files */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  entityType: string
  onSuccess: () => void
}

export function ImportDialog({ open, onClose, entityType, onSuccess }: ImportDialogProps) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  if (!open) return null

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const resp = await api.post(`/imports/${entityType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(resp.data.message || 'Import réussi')
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'import'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-md"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t('common.import')} — {entityType}
          </h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        <div className="p-6 space-y-4">
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
            style={{ borderColor: 'var(--border-color)' }}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {file ? file.name : t('import.dropOrClick')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>CSV, XLSX</p>
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          {result && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)' }}>
              {result}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? t('common.loading') : t('common.import')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
