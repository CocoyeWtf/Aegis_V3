/* Service GPS background + foreground fallback / Background GPS tracking service with foreground fallback */

import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import api from './api'
import { GPS_DISTANCE_MIN_M, GPS_INTERVAL_MS } from '../constants/config'

const GPS_TASK_NAME = 'cmro-gps-tracking'

// File d'attente locale pour sync offline / Local queue for offline sync
let pendingPositions: { latitude: number; longitude: number; accuracy: number | null; speed: number | null; timestamp: string }[] = []
let currentTourId: number | null = null
let foregroundInterval: ReturnType<typeof setInterval> | null = null

// Definir la tache background / Define background task
TaskManager.defineTask(GPS_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('GPS task error:', error)
    return
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }
    for (const loc of locations) {
      pendingPositions.push({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        timestamp: new Date(loc.timestamp).toISOString(),
      })
    }
    await flushPositions()
  }
})

async function flushPositions() {
  if (!currentTourId || pendingPositions.length === 0) return
  const batch = [...pendingPositions]
  pendingPositions = []
  try {
    await api.post('/driver/gps', {
      tour_id: currentTourId,
      positions: batch,
    })
  } catch {
    // Remettre en queue si echec / Re-queue on failure
    pendingPositions = [...batch, ...pendingPositions]
  }
}

/* Fallback foreground : polling position toutes les 30s / Foreground fallback: poll position every 30s */
function startForegroundPolling() {
  if (foregroundInterval) return
  foregroundInterval = setInterval(async () => {
    if (!currentTourId) return
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      pendingPositions.push({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        speed: loc.coords.speed,
        timestamp: new Date(loc.timestamp).toISOString(),
      })
      await flushPositions()
    } catch (e) {
      console.warn('Foreground GPS poll failed:', e)
    }
  }, 30_000) // 30 secondes pour le test, suffisant en foreground
}

function stopForegroundPolling() {
  if (foregroundInterval) {
    clearInterval(foregroundInterval)
    foregroundInterval = null
  }
}

export async function startGPSTracking(tourId: number): Promise<boolean> {
  currentTourId = tourId
  pendingPositions = []

  const { status: fg } = await Location.requestForegroundPermissionsAsync()
  if (fg !== 'granted') return false

  // Envoyer la position initiale immediatement / Send initial position immediately
  try {
    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    pendingPositions.push({
      latitude: initial.coords.latitude,
      longitude: initial.coords.longitude,
      accuracy: initial.coords.accuracy,
      speed: initial.coords.speed,
      timestamp: new Date(initial.timestamp).toISOString(),
    })
    await flushPositions()
  } catch (e) {
    console.warn('Initial GPS position failed:', e)
  }

  // Tenter le background tracking / Try background tracking
  try {
    const { status: bg } = await Location.requestBackgroundPermissionsAsync()
    if (bg === 'granted') {
      await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: GPS_INTERVAL_MS,
        distanceInterval: GPS_DISTANCE_MIN_M,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Suivi de tournee en cours',
          notificationBody: 'CMRO suit votre position GPS',
          notificationColor: '#f97316',
        },
      })
      return true
    }
  } catch (e) {
    console.warn('Background GPS not available, using foreground fallback:', e)
  }

  // Fallback foreground polling / Foreground fallback polling
  startForegroundPolling()
  return true
}

export async function stopGPSTracking() {
  stopForegroundPolling()

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GPS_TASK_NAME)
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(GPS_TASK_NAME)
    }
  } catch (e) {
    console.warn('Stop background GPS failed:', e)
  }

  // Flush restant / Flush remaining
  await flushPositions()
  currentTourId = null
}
