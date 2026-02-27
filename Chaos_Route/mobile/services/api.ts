/* Client API mobile / Mobile API client

Deux modes d'auth :
- Device auth (X-Device-ID) : pour les endpoints chauffeur (/driver/*)
- JWT Bearer : pour les endpoints admin (settings, auth)
*/

import axios from 'axios'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { useAuthStore } from '../stores/useAuthStore'
import { useDeviceStore } from '../stores/useDeviceStore'
import { API_BASE_URL } from '../constants/config'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

/* Intercepteur requete : ajouter X-Device-ID + Bearer si dispo / Request interceptor */
api.interceptors.request.use((config) => {
  // Toujours envoyer le device ID si disponible
  const deviceId = useDeviceStore.getState().deviceId
  if (deviceId) {
    config.headers['X-Device-ID'] = deviceId
  }

  // Ajouter le JWT Bearer si disponible (pour les endpoints admin)
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Tracabilite — version app + OS / Traceability — app version + OS
  config.headers['X-App-Version'] = Constants.expoConfig?.version || '1.0.0'
  config.headers['X-OS-Version'] = `${Platform.OS} ${Platform.Version}`

  return config
})

/* Intercepteur reponse : refresh token sur 401 pour les endpoints auth / Response interceptor */
let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => {
    if (token) p.resolve(token)
    else p.reject(error)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url || ''

    // Refresh token uniquement pour les endpoints auth (pas driver)
    if (error.response?.status === 401 && !originalRequest._retry && url.includes('/auth/')) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState()

      if (!refreshToken) {
        logout()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        setTokens(data.access_token, data.refresh_token)
        processQueue(null, data.access_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        logout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default api
