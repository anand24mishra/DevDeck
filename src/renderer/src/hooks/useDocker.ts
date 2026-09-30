import { useState, useEffect, useCallback, useRef } from 'react'
import { Container } from '../../../shared/types'

export interface UseDockerResult {
  containers: Container[]
  loading: boolean
  error: string | null
  errorCode: string | null
  actionLoadingId: string | null
  refresh: () => Promise<void>
  containerAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<boolean>
  stopAllContainers: () => Promise<boolean>
}

export function useDocker(pollIntervalSec: number = 3): UseDockerResult {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  const fetchContainers = useCallback(async (isInitial = false) => {
    if (!window.api?.listContainers) return

    if (isInitial) {
      setLoading(true)
    }

    try {
      const res = await window.api.listContainers()
      if (!isMountedRef.current) return

      if (res.ok) {
        setContainers(res.data)
        setError(null)
        setErrorCode(null)
      } else {
        setError(res.error.message)
        setErrorCode(res.error.code)
        if (res.error.code === 'DOCKER_UNAVAILABLE' || res.error.code === 'DENIED') {
          setContainers([])
        }
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const msg = err instanceof Error ? err.message : 'Failed to query Docker'
      setError(msg)
      setErrorCode('INTERNAL')
    } finally {
      if (isMountedRef.current && isInitial) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    // Schedule initial fetch asynchronously to avoid cascading renders
    const initialTimer = setTimeout(() => {
      void fetchContainers(true)
    }, 0)

    const intervalMs = Math.max(1000, pollIntervalSec * 1000)
    const timer = setInterval(() => {
      void fetchContainers(false)
    }, intervalMs)

    const unsubscribe = window.api?.onDockerChanged?.(() => {
      void fetchContainers(false)
    })

    return () => {
      isMountedRef.current = false
      clearTimeout(initialTimer)
      clearInterval(timer)
      unsubscribe?.()
    }
  }, [fetchContainers, pollIntervalSec])

  const containerAction = useCallback(
    async (id: string, action: 'start' | 'stop' | 'restart'): Promise<boolean> => {
      if (!window.api?.containerAction) return false
      setActionLoadingId(id)
      try {
        const res = await window.api.containerAction(id, action)
        if (res.ok) {
          await fetchContainers(false)
          return true
        } else {
          setError(res.error.message)
          return false
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Failed to ${action} container`
        setError(msg)
        return false
      } finally {
        setActionLoadingId(null)
      }
    },
    [fetchContainers]
  )

  const stopAllContainers = useCallback(async (): Promise<boolean> => {
    if (!window.api?.stopAllContainers) return false
    setLoading(true)
    try {
      const res = await window.api.stopAllContainers()
      if (res.ok) {
        await fetchContainers(false)
        return true
      } else {
        setError(res.error.message)
        return false
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stop all containers'
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [fetchContainers])

  return {
    containers,
    loading,
    error,
    errorCode,
    actionLoadingId,
    refresh: () => fetchContainers(false),
    containerAction,
    stopAllContainers
  }
}
