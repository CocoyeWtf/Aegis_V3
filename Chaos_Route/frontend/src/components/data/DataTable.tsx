/* Composant table de données réutilisable / Reusable data table component */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface Column<T> {
  key: keyof T | string
  label: string
  sortable?: boolean
  render?: (row: T) => React.ReactNode
  width?: string
}

interface DataTableProps<T extends { id: number }> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  onCreate?: () => void
  onImport?: () => void
  title?: string
  searchable?: boolean
  searchKeys?: (keyof T)[]
}

export function DataTable<T extends { id: number }>({
  columns,
  data,
  loading,
  onEdit,
  onDelete,
  onCreate,
  onImport,
  title,
  searchable = true,
  searchKeys = [],
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 20

  /* Filtrage / Filtering */
  const filtered = useMemo(() => {
    if (!search || searchKeys.length === 0) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key]
        return val != null && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, search, searchKeys])

  /* Tri / Sorting */
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortKey]
      const vb = (b as Record<string, unknown>)[sortKey]
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  /* Pagination */
  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const getCellValue = (row: T, key: string): React.ReactNode => {
    const val = (row as Record<string, unknown>)[key]
    if (val === true) return '✓'
    if (val === false) return '—'
    if (val == null) return '—'
    return String(val)
  }

  return (
    <div>
      {/* Barre d'outils / Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {title && (
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
          )}
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            ({sorted.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {searchable && (
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg text-sm border outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          )}
          {onImport && (
            <button
              onClick={onImport}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >
              {t('common.import')}
            </button>
          )}
          {onCreate && (
            <button
              onClick={onCreate}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              + {t('common.create')}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`px-4 py-3 text-left font-medium ${col.sortable !== false ? 'cursor-pointer select-none hover:opacity-80' : ''}`}
                    style={{ color: 'var(--text-muted)', width: col.width }}
                    onClick={() => col.sortable !== false && handleSort(String(col.key))}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === String(col.key) && (
                        <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </span>
                  </th>
                ))}
                {(onEdit || onDelete) && (
                  <th className="px-4 py-3 text-right font-medium" style={{ color: 'var(--text-muted)', width: '100px' }}>
                    {t('common.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('common.loading')}
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t transition-colors"
                    style={{ borderColor: 'var(--border-color)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {columns.map((col) => (
                      <td key={String(col.key)} className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>
                        {col.render ? col.render(row) : getCellValue(row, String(col.key))}
                      </td>
                    ))}
                    {(onEdit || onDelete) && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(row)}
                              className="px-2 py-1 rounded text-xs transition-colors"
                              style={{ color: 'var(--color-primary)' }}
                            >
                              {t('common.edit')}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(row)}
                              className="px-2 py-1 rounded text-xs transition-colors"
                              style={{ color: 'var(--color-danger)' }}
                            >
                              {t('common.delete')}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} / {sorted.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
              >
                ←
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ color: 'var(--text-secondary)' }}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
