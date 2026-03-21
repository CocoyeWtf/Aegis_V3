/* Onglet calendrier / Calendar tab */

import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import {
  DockConfig, DockScheduleOverride, DayAvailability,
  DOCK_TYPE_LABELS, DOCK_TYPE_COLORS, DAY_LABELS, MONTH_NAMES, formatDateFr,
} from './types'

interface Props {
  selectedBaseId: number | ''
  baseConfigs: DockConfig[]
  overrides: DockScheduleOverride[]
  isReception: boolean
  setSelectedDate: (d: string) => void
  setTab: (t: 'planning' | 'config' | 'import' | 'calendar' | 'stats') => void
  openOverrideDialog: (dateStr: string, dockConfigId?: number) => void
  fetchData: () => void
}

export function CalendarTab({
  selectedBaseId, baseConfigs, isReception,
  setSelectedDate, setTab, openOverrideDialog,
}: Props) {
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7))
  const [calendarData, setCalendarData] = useState<DayAvailability[]>([])

  const fetchCalendar = useCallback(async () => {
    if (!selectedBaseId) return
    try {
      const res = await api.get('/reception-booking/calendar-availability/', {
        params: { base_id: selectedBaseId, year_month: calendarMonth },
      })
      setCalendarData(res.data)
    } catch { /* silent */ }
  }, [selectedBaseId, calendarMonth])

  useEffect(() => { fetchCalendar() }, [fetchCalendar])

  if (!selectedBaseId) {
    return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>Selectionnez une base pour voir le calendrier.</div>
  }

  const [year, month] = calendarMonth.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDay + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()

  const prevMonth = () => {
    const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
    setCalendarMonth(prev)
  }
  const nextMonth = () => {
    const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
    setCalendarMonth(next)
  }

  const cells = []
  for (let i = 0; i < startOffset; i++) {
    cells.push(<div key={`e-${i}`} style={{ borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', minHeight: '80px' }} />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayData = calendarData.filter((d) => d.date === dateStr)
    const isToday = dateStr === new Date().toISOString().slice(0, 10)
    const isWeekend = ((startOffset + day - 1) % 7) >= 5

    cells.push(
      <div key={day} className="p-1.5 cursor-pointer hover:opacity-80"
        style={{
          borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)',
          minHeight: '80px',
          backgroundColor: isToday ? 'var(--color-primary)08' : (isWeekend ? 'var(--bg-tertiary)' : 'var(--bg-primary)'),
        }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold cursor-pointer hover:underline" style={{
            color: isToday ? 'var(--color-primary)' : 'var(--text-primary)',
          }} onClick={() => { setSelectedDate(dateStr); setTab('planning') }}>{day}</span>
          {isReception && baseConfigs.length > 0 && (
            <button className="text-[8px] px-1 rounded hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
              onClick={(e) => { e.stopPropagation(); openOverrideDialog(dateStr) }}
              title="Ajouter/modifier exception">+</button>
          )}
        </div>
        {dayData.length === 0 && <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>-</div>}
        {dayData.map((dd) => {
          const cfgForType = baseConfigs.find((c) => c.dock_type === dd.dock_type)
          return (
            <div key={dd.dock_type} className="text-[9px] flex items-center gap-1 mb-0.5 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); if (cfgForType) openOverrideDialog(dateStr, cfgForType.id) }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: DOCK_TYPE_COLORS[dd.dock_type] || '#737373' }} />
              {dd.is_closed ? (
                <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>Ferme</span>
              ) : (
                <span style={{ color: 'var(--text-primary)' }}>
                  {dd.open_time?.slice(0, 5)}-{dd.close_time?.slice(0, 5)} · {dd.dock_count}q
                  {dd.booking_count > 0 && <span style={{ color: 'var(--color-primary)' }}> · {dd.booking_count}bk</span>}
                </span>
              )}
              {dd.has_override && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} title="Exception" />}
            </div>
          )
        })}
      </div>
    )
  }
  const total = startOffset + daysInMonth
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7)
  for (let i = 0; i < remaining; i++) {
    cells.push(<div key={`f-${i}`} style={{ borderBottom: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)', minHeight: '80px' }} />)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>&lt;</button>
        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{MONTH_NAMES[month - 1]} {year}</span>
        <button onClick={nextMonth} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>&gt;</button>
      </div>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-xs font-semibold text-center py-2" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>{cells}</div>
      </div>
      <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        {baseConfigs.map((cfg) => (
          <div key={cfg.dock_type} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DOCK_TYPE_COLORS[cfg.dock_type] }} />
            <span>{DOCK_TYPE_LABELS[cfg.dock_type]} ({cfg.dock_count} quais)</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
          <span>Exception</span>
        </div>
      </div>
    </div>
  )
}
