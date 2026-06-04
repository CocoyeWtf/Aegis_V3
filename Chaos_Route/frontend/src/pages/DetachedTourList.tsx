/* Page popup liste des tours détachée / Detached tour list popup page */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/useAppStore'
import { TourScheduler } from '../components/tour/TourScheduler'

export default function DetachedTourList() {
  const [searchParams] = useSearchParams()
  const initialDate = searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const themeParam = searchParams.get('theme') || 'dark'
  const { setSelectedRegion } = useAppStore()

  const [date, setDate] = useState(initialDate)

  useEffect(() => {
    document.documentElement.classList.toggle('light', themeParam === 'light')
    document.title = `Chaos Route — Liste tours ${date}`
  }, [themeParam, date])

  useEffect(() => {
    const regionId = searchParams.get('regionId')
    if (regionId) setSelectedRegion(Number(regionId))
  }, [searchParams, setSelectedRegion])

  return (
    <div style={{ width: '100vw', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <div className="p-3">
        <TourScheduler
          selectedDate={date}
          onDateChange={setDate}
          embeddedMode="list-only"
        />
      </div>
    </div>
  )
}
