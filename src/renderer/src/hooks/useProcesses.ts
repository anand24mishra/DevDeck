import { useState, useEffect, useRef, useCallback } from 'react'
import { Proc, Settings, Result, KillReport } from '../../../shared/types'

export interface UseProcessesResult {
  procs: Proc[]
  settings: Settings
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
  changeInterval: (interval: 2 | 3 | 5 | 10) => Promise<void>
  updateSettings: (partial: Partial<Settings>) => Promise<Result<Settings>>
  stopProcess: (pid: number) => Promise<Result<KillReport>>
  stopProject: (project: string) => Promise<Result<KillReport>>
  stopAll: () => Promise<Result<KillReport>>
}

const DEFAULT_SETTINGS: Settings = {
  refreshIntervalSec: 3,
  ignoreList: [],
  customAllowlist: [],
  theme: 'system',
  openAtLogin: false
}

export function useProcesses(): UseProcessesResult {
  const [procs, setProcs] = useState<Proc[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const inFlightRef = useRef<boolean>(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch settings on mount
  useEffect(() => {
    window.api
      ?.getSettings?.()
      .then((res) => {
        if (res.ok) {
          setSettings(res.data)
        }
      })
      .catch(() => {
        // Fallback to default
      })
  }, [])

  const fetchProcesses = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true

    try {
      const res = await window.api.getProcesses()
      if (res.ok) {
        setProcs(res.data)
        setError(null)
        setLastUpdated(new Date())
      } else {
        setError(res.error.message || 'Failed to list processes')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown IPC error')
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [])

  // Manage auto-refresh timer with window visibility awareness
  useEffect(() => {
    // Run initial fetch asynchronously after render
    const timer = setTimeout(() => {
      void fetchProcesses()
    }, 0)

    const setupTimer = (): void => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchProcesses()
        }
      }, settings.refreshIntervalSec * 1000)
    }

    setupTimer()

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        fetchProcesses()
        setupTimer()
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(timer)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchProcesses, settings.refreshIntervalSec])

  const changeInterval = useCallback(async (interval: 2 | 3 | 5 | 10) => {
    try {
      const res = await window.api.updateSettings({ refreshIntervalSec: interval })
      if (res.ok) {
        setSettings(res.data)
      }
    } catch {
      // Handle error silently
    }
  }, [])

  const updateSettings = useCallback(
    async (partial: Partial<Settings>): Promise<Result<Settings>> => {
      try {
        const res = await window.api.updateSettings(partial)
        if (res.ok) {
          setSettings(res.data)
          await fetchProcesses()
        }
        return res
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update settings'
        return { ok: false, error: { code: 'INTERNAL', message } }
      }
    },
    [fetchProcesses]
  )

  const stopProcess = useCallback(
    async (pid: number): Promise<Result<KillReport>> => {
      const res = await window.api.stopProcess(pid)
      await fetchProcesses()
      return res
    },
    [fetchProcesses]
  )

  const stopProject = useCallback(
    async (project: string): Promise<Result<KillReport>> => {
      const res = await window.api.stopProject(project)
      await fetchProcesses()
      return res
    },
    [fetchProcesses]
  )

  const stopAll = useCallback(async (): Promise<Result<KillReport>> => {
    const res = await window.api.stopAll()
    await fetchProcesses()
    return res
  }, [fetchProcesses])

  return {
    procs,
    settings,
    loading,
    error,
    lastUpdated,
    refresh: fetchProcesses,
    changeInterval,
    updateSettings,
    stopProcess,
    stopProject,
    stopAll
  }
}
