import { useState, useEffect, useCallback, useRef } from 'react'
import { Container } from '../../../shared/types'

export interface UseDockerResult {
  containers: Container[]
  loading: boolean
  error: string | null
  errorCode: string | null
  actionLoadingId: string | null
  refresh: () => Promise<void>
  containerAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<ActionOutcome>
  stopAllContainers: () => Promise<ActionOutcome>
}

export type ActionOutcome = { ok: true } | { ok: false; message: string }

export function useDocker(pollIntervalSec: number = 3, active: boolean = true): UseDockerResult {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const inFlight = useRef(false)
  const isMountedRef = useRef(true)

  const fetchContainers = useCallback(async (isInitial = false) => {
    if (!window.api?.listContainers || inFlight.current || document.hidden) return
    inFlight.current = true

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
      const msg = 'Could not connect to Docker. Check your provider and try again.'
      void err
      setError(msg)
      setErrorCode('INTERNAL')
    } finally {
      inFlight.current = false
      if (isMountedRef.current) {
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

    // Poll only while the Docker tab is showing; Docker's own change events still arrive.
    const intervalMs = Math.max(1000, pollIntervalSec * 1000)
    const timer = active
      ? setInterval(() => {
          void fetchContainers(false)
        }, intervalMs)
      : null

    const visible = (): void => {
      if (active && !document.hidden) void fetchContainers(false)
    }
    document.addEventListener('visibilitychange', visible)
    const unsubscribe = window.api?.onDockerChanged?.(() => {
      void fetchContainers(false)
    })

    return () => {
      isMountedRef.current = false
      clearTimeout(initialTimer)
      if (timer) clearInterval(timer)
      unsubscribe?.()
      document.removeEventListener('visibilitychange', visible)
    }
  }, [fetchContainers, pollIntervalSec, active])

  const containerAction = useCallback(
    async (id: string, action: 'start' | 'stop' | 'restart'): Promise<ActionOutcome> => {
      if (!window.api?.containerAction) return { ok: false, message: 'Docker is not available.' }
      setActionLoadingId(id)
      try {
        const res = await window.api.containerAction(id, action)
        if (res.ok) {
          await fetchContainers(false)
          return { ok: true }
        } else {
          setError(res.error.message)
          return { ok: false, message: res.error.message }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `Could not ${action} the container.`
        setError(msg)
        return { ok: false, message: msg }
      } finally {
        setActionLoadingId(null)
      }
    },
    [fetchContainers]
  )

  const stopAllContainers = useCallback(async (): Promise<ActionOutcome> => {
    if (!window.api?.stopAllContainers) return { ok: false, message: 'Docker is not available.' }
    setLoading(true)
    try {
      const res = await window.api.stopAllContainers()
      if (res.ok) {
        await fetchContainers(false)
        return { ok: true }
      } else {
        setError(res.error.message)
        return { ok: false, message: res.error.message }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not stop all containers.'
      setError(msg)
      return { ok: false, message: msg }
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
