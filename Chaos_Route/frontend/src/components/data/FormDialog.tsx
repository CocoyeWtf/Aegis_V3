/* Dialogue de formulaire réutilisable / Reusable form dialog component */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'time'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

interface FormDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Record<string, unknown>) => void
  title: string
  fields: FieldDef[]
  initialData?: Record<string, unknown>
  loading?: boolean
}

export function FormDialog({ open, onClose, onSubmit, title, fields, initialData, loading }: FormDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (open) {
      const defaults: Record<string, unknown> = {}
      fields.forEach((f) => {
        defaults[f.key] = initialData?.[f.key] ?? (f.type === 'checkbox' ? false : f.type === 'number' ? '' : '')
      })
      setForm(defaults)
    }
  }, [open, initialData, fields])

  if (!open) return null

  const handleChange = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Convertir les champs numériques / Convert number fields
    const processed: Record<string, unknown> = {}
    fields.forEach((f) => {
      let val = form[f.key]
      if (f.type === 'number' && val !== '' && val != null) {
        val = Number(val)
      }
      if (val === '') val = null
      processed[f.key] = val
    })
    onSubmit(processed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Dialog */}
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--text-muted)' }}>
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                {field.label}
                {field.required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
              </label>

              {field.type === 'select' ? (
                <select
                  value={String(form[field.key] ?? '')}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required={field.required}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">—</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={!!form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-500"
                />
              ) : field.type === 'textarea' ? (
                <textarea
                  value={String(form[field.key] ?? '')}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1 resize-y"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              ) : (
                <input
                  type={field.type === 'time' ? 'time' : field.type}
                  value={String(form[field.key] ?? '')}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  required={field.required}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-1"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
