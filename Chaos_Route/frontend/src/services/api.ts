/* Client API / API client for Chaos RouteManager backend */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

/* Fonctions CRUD génériques / Generic CRUD functions */
export async function fetchAll<T>(endpoint: string, params?: Record<string, unknown>): Promise<T[]> {
  const { data } = await api.get<T[]>(endpoint, { params })
  return data
}

export async function fetchOne<T>(endpoint: string, id: number): Promise<T> {
  const { data } = await api.get<T>(`${endpoint}/${id}`)
  return data
}

export async function create<T>(endpoint: string, payload: Partial<T>): Promise<T> {
  const { data } = await api.post<T>(endpoint, payload)
  return data
}

export async function update<T>(endpoint: string, id: number, payload: Partial<T>): Promise<T> {
  const { data } = await api.put<T>(`${endpoint}/${id}`, payload)
  return data
}

export async function remove(endpoint: string, id: number): Promise<void> {
  await api.delete(`${endpoint}/${id}`)
}

export default api
