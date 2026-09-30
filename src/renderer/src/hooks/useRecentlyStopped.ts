import { useState, useEffect, useCallback } from 'react'
import { RecentlyStoppedItem, Result } from '../../../shared/types'

export interface UseRecentlyStoppedReturn {
  items: RecentlyStoppedItem[]
  loading: boolean
  error: string | null
  restartingId: string | null
  refresh: () => Promise<void>
  restartItem: (id: string) => Promise<Result<{ pid?: number }>>
  clearAll: () => Promise<boolean>
}

export function useRecentlyStopped(): UseRecentlyStoppedReturn {
  const [items, setItems] = useState<RecentlyStoppedItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [restartingId, setRestartingId] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await window.api.getRecentlyStopped()
      if (res.ok) {
        setItems(res.data)
        setError(null)
      } else {
        setError(res.error.message)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recently stopped processes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      refresh()
    }, 0)
    const unsubscribe = window.api.onRecentlyStoppedChanged(() => {
      refresh()
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [refresh])

  const restartItem = useCallback(
    async (id: string): Promise<Result<{ pid?: number }>> => {
      setRestartingId(id)
      try {
        const res = await window.api.restartStopped(id)
        if (res.ok) {
          await refresh()
        }
        return res
      } finally {
        setRestartingId(null)
      }
    },
    [refresh]
  )

  const clearAll = useCallback(async (): Promise<boolean> => {
    try {
      const res = await window.api.clearRecentlyStopped()
      if (res.ok) {
        setItems([])
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  return {
    items,
    loading,
    error,
    restartingId,
    refresh,
    restartItem,
    clearAll
  }
}
