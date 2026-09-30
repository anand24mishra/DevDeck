import React, { useState, useMemo, useCallback } from 'react'
import { Proc, KillReport } from '../../shared/types'
import { useProcesses } from './hooks/useProcesses'
import { Header } from './components/Header'
import { ProjectGroup } from './components/ProjectGroup'
import { EmptyState } from './components/EmptyState'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Toast, ToastMessage } from './components/Toast'

interface GroupedProject {
  name: string
  path: string | null
  processes: Proc[]
}

interface DialogState {
  isOpen: boolean
  title: string
  description?: string
  targetList?: string[]
  action: () => Promise<void>
}

const App: React.FC = () => {
  const {
    procs,
    settings,
    loading,
    error,
    refresh,
    changeInterval,
    stopProcess,
    stopProject,
    stopAll
  } = useProcesses()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    action: async () => {}
  })
  const [isBusy, setIsBusy] = useState<boolean>(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  // Filter processes based on search query (name, port, project)
  const filteredProcesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return procs

    return procs.filter((proc) => {
      const matchName = proc.name.toLowerCase().includes(q)
      const matchProject = proc.project.toLowerCase().includes(q)
      const matchPorts = proc.ports.some((port) => port.toString().includes(q))
      return matchName || matchProject || matchPorts
    })
  }, [procs, searchQuery])

  // Group processes by project
  const groupedProjects = useMemo(() => {
    const map = new Map<string, GroupedProject>()

    for (const proc of filteredProcesses) {
      const key = proc.project || 'Other'
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          path: proc.projectPath,
          processes: []
        })
      }
      map.get(key)!.processes.push(proc)
    }

    return Array.from(map.values())
  }, [filteredProcesses])

  const totalProjects = useMemo(() => {
    const unique = new Set(procs.map((p) => p.project))
    return unique.size
  }, [procs])

  const showReportToast = (report: KillReport): void => {
    const parts: string[] = []
    if (report.stopped.length > 0) parts.push(`Stopped ${report.stopped.length}`)
    if (report.forced.length > 0) parts.push(`forced ${report.forced.length}`)
    if (report.refused.length > 0) parts.push(`refused ${report.refused.length}`)

    const text = parts.length > 0 ? parts.join(', ') : 'No processes stopped'
    const type = report.stopped.length > 0 || report.forced.length > 0 ? 'success' : 'warn'
    setToast({ id: Date.now().toString(), text, type })
  }

  const handleStopProcess = useCallback(
    (proc: Proc) => {
      setDialogState({
        isOpen: true,
        title: `Stop ${proc.name} (PID ${proc.pid})?`,
        description: `This will stop the process. If it doesn't respond within 3 seconds, it will be forcefully stopped.`,
        targetList: [`${proc.name} (PID ${proc.pid}, port ${proc.ports.join(', ') || 'none'})`],
        action: async () => {
          setIsBusy(true)
          try {
            const res = await stopProcess(proc.pid)
            if (res.ok) {
              showReportToast(res.data)
            } else {
              setToast({ id: Date.now().toString(), text: res.error.message, type: 'error' })
            }
          } finally {
            setIsBusy(false)
            setDialogState((prev) => ({ ...prev, isOpen: false }))
          }
        }
      })
    },
    [stopProcess]
  )

  const handleStopProject = useCallback(
    (project: string, projectProcs: Proc[]) => {
      setDialogState({
        isOpen: true,
        title: `Stop ${projectProcs.length} ${projectProcs.length === 1 ? 'process' : 'processes'} in ${project}?`,
        description: `This will stop all running processes for this project stack.`,
        targetList: projectProcs.map((p) => `${p.name} (PID ${p.pid})`),
        action: async () => {
          setIsBusy(true)
          try {
            const res = await stopProject(project)
            if (res.ok) {
              showReportToast(res.data)
            } else {
              setToast({ id: Date.now().toString(), text: res.error.message, type: 'error' })
            }
          } finally {
            setIsBusy(false)
            setDialogState((prev) => ({ ...prev, isOpen: false }))
          }
        }
      })
    },
    [stopProject]
  )

  const handleStopAll = useCallback(() => {
    setDialogState({
      isOpen: true,
      title: `Stop all ${procs.length} dev processes?`,
      description: `This will stop every dev process running on your machine.`,
      targetList: procs.map((p) => `${p.name} in ${p.project} (PID ${p.pid})`),
      action: async () => {
        setIsBusy(true)
        try {
          const res = await stopAll()
          if (res.ok) {
            showReportToast(res.data)
          } else {
            setToast({ id: Date.now().toString(), text: res.error.message, type: 'error' })
          }
        } finally {
          setIsBusy(false)
          setDialogState((prev) => ({ ...prev, isOpen: false }))
        }
      }
    })
  }, [procs, stopAll])

  return (
    <div className="app-container">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={procs.length}
        projectCount={totalProjects}
        settings={settings}
        onIntervalChange={changeInterval}
        onRefresh={refresh}
        onStopAll={handleStopAll}
        loading={loading}
      />

      <main className="app-content" tabIndex={-1}>
        {loading && procs.length === 0 ? (
          <LoadingState />
        ) : error && procs.length === 0 ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : procs.length === 0 ? (
          <EmptyState />
        ) : filteredProcesses.length === 0 ? (
          <EmptyState searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} />
        ) : (
          <div className="project-groups-list">
            {groupedProjects.map((group) => (
              <ProjectGroup
                key={group.name}
                projectName={group.name}
                projectPath={group.path}
                processes={group.processes}
                onStopProcess={handleStopProcess}
                onStopProject={handleStopProject}
              />
            ))}
          </div>
        )}
      </main>

      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        description={dialogState.description}
        targetList={dialogState.targetList}
        isBusy={isBusy}
        onConfirm={dialogState.action}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default App
