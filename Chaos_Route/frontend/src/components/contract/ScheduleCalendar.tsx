/* Calendrier planning annuel date-par-date / Annual date-based schedule calendar */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface ScheduleCalendarProps {
  /** Dates indisponibles chargées depuis le backend / Unavailable dates from backend */
  unavailableDates: Set<string>
  /** Callback au save / Save callback */
  onSave: (changes: Array<{ date: string; is_available: boolean }>) => void
  saving?: boolean
  onClose: () => void
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Mon, 6=Sun (ISO)
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function ScheduleCalendar({ unavailableDates, onSave, saving, onClose }: ScheduleCalendarProps) {
  const { t, i18n } = useTranslation()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  // Local toggle state: tracks changes on top of initial unavailableDates
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map())

  const isUnavailable = useCallback((dateStr: string): boolean => {
    if (toggled.has(dateStr)) {
      return !toggled.get(dateStr)! // toggled stores is_available
    }
    return unavailableDates.has(dateStr)
  }, [toggled, unavailableDates])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; dateStr: string } | null> = []
    // Padding before
    for (let i = 0; i < firstDay; i++) cells.push(null)
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: formatDate(year, month, d) })
    }
    return cells
  }, [year, month, daysInMonth, firstDay])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const toggleDate = (dateStr: string) => {
    setToggled(prev => {
      const next = new Map(prev)
      const currentlyUnavailable = isUnavailable(dateStr)
      // Toggle: if currently unavailable → make available, vice versa
      next.set(dateStr, currentlyUnavailable) // store is_available
      return next
    })
  }

  const handleSave = () => {
    const changes: Array<{ date: string; is_available: boolean }> = []
    for (const [dateStr, isAvail] of toggled.entries()) {
      const wasUnavailable = unavailableDates.has(dateStr)
      const nowAvailable = isAvail
      // Only send if actually changed
      if (wasUnavailable && nowAvailable) {
        changes.push({ date: dateStr, is_available: true })
      } else if (!wasUnavailable && !nowAvailable) {
        changes.push({ date: dateStr, is_available: false })
      }
    }
    onSave(changes)
  }

  const isFr = i18n.language?.startsWith('fr')
  const dayLabels = isFr ? DAYS_FR : DAYS_EN
  const monthNames = isFr ? MONTH_NAMES_FR : MONTH_NAMES_EN

  const hasChanges = useMemo(() => {
    for (const [dateStr, isAvail] of toggled.entries()) {
      const wasUnavailable = unavailableDates.has(dateStr)
      if (wasUnavailable && isAvail) return true
      if (!wasUnavailable && !isAvail) return true
    }
    return false
  }, [toggled, unavailableDates])

  return (
    <div className="space-y-4">
      {/* Navigation mois / Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          ←
        </button>
        <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {monthNames[month]} {year}
        </h4>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          →
        </button>
      </div>

      {/* Grille calendrier / Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* En-têtes jours / Day headers */}
        {dayLabels.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}

        {/* Cases / Cells */}
        {calendarCells.map((cell, i) => {
          if (!cell) {
            return <div key={`pad-${i}`} className="h-9" />
          }
          const unavail = isUnavailable(cell.dateStr)
          return (
            <button
              key={cell.dateStr}
              onClick={() => toggleDate(cell.dateStr)}
              className="h-9 rounded-lg text-xs font-semibold transition-all hover:scale-105"
              style={{
                backgroundColor: unavail ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
                color: unavail ? 'var(--color-danger)' : 'var(--color-success)',
                border: `1px solid ${unavail ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.25)'}`,
              }}
            >
              {cell.day}
            </button>
          )
        })}
      </div>

      {/* Légende / Legend */}
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.3)' }} />
          {t('contracts.available')}
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.3)' }} />
          {t('contracts.unavailable')}
        </div>
      </div>

      {/* Boutons / Buttons */}
      <div className="flex gap-2 pt-2">
        <button
          className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? '...' : t('common.save')}
        </button>
        <button
          className="px-4 py-2 rounded-lg text-sm border transition-all hover:opacity-80"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          onClick={onClose}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
