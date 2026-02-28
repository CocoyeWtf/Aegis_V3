/* Page historique des actions / Audit log page */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../services/api'

interface AuditEntry {
  id: number
  entity_type: string
  entity_id: number
  action: string
  changes: string | null
  user: string | null
  timestamp: string
}

interface AuditResponse {
  total: number
  items: AuditEntry[]
}

const PAGE_SIZE = 50

export default function AuditLog() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [loading, setLoading] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }
      if (filterType) params.entity_type = filterType
      const { data } = await api.get<AuditResponse>('/audit/', { params })
      setLogs(data.items)
      setTotal(data.total)
    } catch {
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, filterType])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const formatChanges = (changes: string | null): string => {
    if (!changes) return '—'
    try {
      const obj = JSON.parse(changes)
      return Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    } catch {
      return changes
    }
  }

  const actionColor = (action: string): string => {
    if (action === 'CREATE' || action === 'LOGIN') return 'var(--color-success)'
    if (action === 'DELETE') return 'var(--color-danger)'
    if (action.startsWith('UPDATE') || action === 'SCHEDULE') return 'var(--color-primary)'
    if (action === 'RECALCULATE') return 'var(--color-warning)'
    if (action === 'UNSCHEDULE') return 'var(--text-muted)'
    if (action === 'LOGIN_FAILED' || action === 'LOGIN_DISABLED') return 'var(--color-danger)'
    return 'var(--text-primary)'
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('audit.title')}
        </h2>
        <div className="flex items-center gap-3">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('audit.filterByType')}
          </label>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
            className="rounded-lg border px-3 py-1.5 text-sm"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">{t('audit.allTypes')}</option>
            <option value="auth">{t('audit.loginHistory')}</option>
            <option value="tour">Tour</option>
          </select>
        </div>
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        {loading ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('audit.noLogs')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {t('audit.timestamp')}
                </th>
                <th className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {t('audit.user')}
                </th>
                <th className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {t('audit.action')}
                </th>
                <th className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {t('audit.entityType')}
                </th>
                <th className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {t('audit.entityId')}
                </th>
                <th className="text-left px-4 py-2 font-medium text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {t('audit.changes')}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {(() => {
                      const [d, rest] = log.timestamp.split('T')
                      const [y, m, day] = d.split('-')
                      return `${day}/${m}/${y} ${rest?.slice(0, 8) ?? ''}`
                    })()}
                  </td>
                  <td className="px-4 py-2 text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                    {log.user ?? '—'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${actionColor(log.action)}20`, color: actionColor(log.action) }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-2 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                    {log.entity_id}
                  </td>
                  <td className="px-4 py-2 text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {formatChanges(log.changes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded-lg border text-xs disabled:opacity-40"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            &laquo;
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded-lg border text-xs disabled:opacity-40"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  )
}
