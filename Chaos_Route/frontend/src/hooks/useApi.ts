/* Hook générique pour les appels API / Generic API hook */

import { useCallback, useEffect, useState } from 'react'
import { fetchAll } from '../services/api'

interface UseApiResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useApi<T>(endpoint: string, params?: Record<string, unknown>): UseApiResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAll<T>(endpoint, params)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [endpoint, JSON.stringify(params)])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, refetch: load }
}
