/* Dialogue d'import CSV/Excel / Import dialog for CSV/Excel files */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../services/api'

interface DuplicateInfo {
  existing: { date: string; base: string; count: number }[]
  total_existing: number
  new_row_count: number
}

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
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateInfo | null>(null)

  if (!open) return null

  const doImport = async (mode: string) => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const resp = await api.post(`/imports/${entityType}?mode=${mode}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (resp.data.status === 'duplicate_warning') {
        setDuplicateWarning(resp.data)
        return
      }

      setDuplicateWarning(null)
      setResult(resp.data.message || 'Import réussi')
      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'import"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => doImport('check')
  const handleReplace = () => { setDuplicateWarning(null); doImport('replace') }
  const handleAppend = () => { setDuplicateWarning(null); doImport('append') }

  const handleFileChange = (f: File | null) => {
    setFile(f)
    setDuplicateWarning(null)
    setError(null)
    setResult(null)
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
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {file ? file.name : t('import.dropOrClick')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>CSV, XLSX</p>
          </div>

          {/* Alerte doublons / Duplicate warning */}
          {duplicateWarning && (
            <div className="rounded-lg border p-4 space-y-2" style={{ backgroundColor: 'rgba(249,115,22,0.08)', borderColor: 'var(--color-warning)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                {t('import.duplicateWarning')}
              </p>
              <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-primary)' }}>
                {duplicateWarning.existing.map((e, i) => (
                  <li key={i}>{t('import.duplicateDetail', { date: e.date, base: e.base, count: e.count })}</li>
                ))}
              </ul>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('import.totalExisting', { count: duplicateWarning.total_existing })}
                {' — '}
                {t('import.newRows', { count: duplicateWarning.new_row_count })}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleReplace}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-danger)' }}
                >
                  {loading ? '...' : t('import.replaceExisting')}
                </button>
                <button
                  onClick={handleAppend}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
                  style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                >
                  {loading ? '...' : t('import.appendAnyway')}
                </button>
              </div>
            </div>
          )}

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
            {!duplicateWarning && (
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loading ? t('common.loading') : t('common.import')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
