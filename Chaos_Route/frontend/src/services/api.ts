/* Client API / API client for Chaos RouteManager backend */

import axios from 'axios'
import { useAuthStore } from '../stores/useAuthStore'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

/* Intercepteur requête : ajouter le token Bearer / Request interceptor: add Bearer token */
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* Intercepteur réponse : refresh token sur 401 / Response interceptor: refresh token on 401 */
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState()

      // Pas de refresh token ou c'est déjà la route auth → logout
      if (!refreshToken || originalRequest.url?.includes('/auth/')) {
        logout()
        window.location.href = '/login'
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
        const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
        setTokens(data.access_token, data.refresh_token)
        processQueue(null, data.access_token)
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

/* Ajouter trailing slash pour correspondre aux routes FastAPI list/create /
/* Add trailing slash to match FastAPI list/create routes */
function withSlash(url: string): string {
  return url.endsWith('/') ? url : url + '/'
}

/* Fonctions CRUD génériques / Generic CRUD functions */
export async function fetchAll<T>(endpoint: string, params?: Record<string, unknown>): Promise<T[]> {
  const { data } = await api.get<T[]>(withSlash(endpoint), { params })
  return data
}

export async function fetchOne<T>(endpoint: string, id: number): Promise<T> {
  const { data } = await api.get<T>(`${endpoint}/${id}`)
  return data
}

export async function create<T>(endpoint: string, payload: Partial<T>): Promise<T> {
  const { data } = await api.post<T>(withSlash(endpoint), payload)
  return data
}

export async function update<T>(endpoint: string, id: number, payload: Partial<T>): Promise<T> {
  const { data } = await api.put<T>(`${endpoint}/${id}`, payload)
  return data
}

export async function remove(endpoint: string, id: number): Promise<void> {
  await api.delete(`${endpoint}/${id}`)
}

/* Télécharger un export CSV ou XLSX / Download a CSV or XLSX export */
export async function downloadExport(entity: string, format: 'csv' | 'xlsx' = 'xlsx'): Promise<void> {
  const response = await api.get(`/exports/${entity}`, {
    params: { format },
    responseType: 'blob',
  })
  const blob = new Blob([response.data])
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${entity}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default api
