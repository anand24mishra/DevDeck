import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Proc, KillReport, Container, Settings } from '../../shared/types'
import { useProcesses } from './hooks/useProcesses'
import { useDocker } from './hooks/useDocker'
import { useRecentlyStopped } from './hooks/useRecentlyStopped'
import { Header } from './components/Header'
import { ProjectGroup } from './components/ProjectGroup'
import { DockerProjectGroup } from './components/DockerProjectGroup'
import { DockerLogViewer } from './components/DockerLogViewer'
import { SettingsModal } from './components/SettingsModal'
import { RecentlyStoppedDrawer } from './components/RecentlyStoppedDrawer'
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

interface GroupedDockerProject {
  name: string
  containers: Container[]
}

interface DialogState {
  isOpen: boolean
  title: string
  description?: string
  targetList?: string[]
  action: () => Promise<void>
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'processes' | 'docker'>('processes')

  const {
    procs,
    settings,
    loading: procsLoading,
    error: procsError,
    refresh: refreshProcs,
    changeInterval,
    updateSettings,
    stopProcess,
    stopProject,
    stopAll
  } = useProcesses()

  const {
    containers,
    loading: dockerLoading,
    error: dockerError,
    errorCode: dockerErrorCode,
    actionLoadingId,
    refresh: refreshDocker,
    containerAction,
    stopAllContainers
  } = useDocker(settings.refreshIntervalSec)

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedLogContainer, setSelectedLogContainer] = useState<Container | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [isRecentOpen, setIsRecentOpen] = useState<boolean>(false)
  const {
    items: recentItems,
    loading: recentLoading,
    restartingId,
    restartItem,
    clearAll: clearRecent
  } = useRecentlyStopped()

  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    action: async () => {}
  })
  const [isBusy, setIsBusy] = useState<boolean>(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const handleRestartStopped = useCallback(
    async (id: string): Promise<void> => {
      const res = await restartItem(id)
      if (res.ok) {
        setToast({
          id: Date.now().toString(),
          text: `Process restarted${res.data?.pid ? ` (PID ${res.data.pid})` : ''}`,
          type: 'success'
        })
        refreshProcs()
      } else {
        setToast({
          id: Date.now().toString(),
          text: `Restart failed: ${res.error.message}`,
          type: 'error'
        })
      }
    },
    [restartItem, refreshProcs]
  )

  const handleClearRecent = useCallback(async (): Promise<void> => {
    const ok = await clearRecent()
    if (ok) {
      setToast({
        id: Date.now().toString(),
        text: 'Cleared recently stopped processes',
        type: 'success'
      })
    }
  }, [clearRecent])

  // Synchronize interface theme
  useEffect(() => {
    const theme = settings.theme || 'system'
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [settings.theme])

  // 1. Process filtering & grouping
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

  // 2. Docker filtering & grouping
  const filteredContainers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return containers

    return containers.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q)
      const matchImage = c.image.toLowerCase().includes(q)
      const matchProject = c.project?.toLowerCase().includes(q)
      const matchPorts = c.ports.some((port) => port.toString().includes(q))
      return matchName || matchImage || matchProject || matchPorts
    })
  }, [containers, searchQuery])

  const groupedDockerProjects = useMemo(() => {
    const map = new Map<string, GroupedDockerProject>()

    for (const c of filteredContainers) {
      const key = c.project || 'Standalone Containers'
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          containers: []
        })
      }
      map.get(key)!.containers.push(c)
    }

    return Array.from(map.values())
  }, [filteredContainers])

  const dockerRunningCount = useMemo(() => {
    return containers.filter((c) => c.state === 'running').length
  }, [containers])

  const showReportToast = (report: KillReport): void => {
    const parts: string[] = []
    if (report.stopped.length > 0) parts.push(`Stopped ${report.stopped.length}`)
    if (report.forced.length > 0) parts.push(`forced ${report.forced.length}`)
    if (report.refused.length > 0) parts.push(`refused ${report.refused.length}`)

    const text = parts.length > 0 ? parts.join(', ') : 'No processes stopped'
    const type = report.stopped.length > 0 || report.forced.length > 0 ? 'success' : 'warn'
    setToast({ id: Date.now().toString(), text, type })
  }

  // Process Actions
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

  const handleStopAllProcesses = useCallback(() => {
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

  // Docker Actions
  const handleDockerAction = useCallback(
    (id: string, action: 'start' | 'stop' | 'restart') => {
      const container = containers.find((c) => c.id === id)
      const name = container?.name || id

      if (action === 'stop') {
        setDialogState({
          isOpen: true,
          title: `Stop container ${name}?`,
          description: `This will send a stop signal to the container with a 10s graceful shutdown timeout.`,
          targetList: [`${name} (${container?.image || 'unknown image'})`],
          action: async () => {
            setIsBusy(true)
            try {
              const ok = await containerAction(id, 'stop')
              if (ok) {
                setToast({
                  id: Date.now().toString(),
                  text: `Stopped container ${name}`,
                  type: 'success'
                })
              }
            } finally {
              setIsBusy(false)
              setDialogState((prev) => ({ ...prev, isOpen: false }))
            }
          }
        })
      } else {
        containerAction(id, action).then((ok) => {
          if (ok) {
            const verb = action === 'start' ? 'Started' : 'Restarted'
            setToast({
              id: Date.now().toString(),
              text: `${verb} container ${name}`,
              type: 'success'
            })
          }
        })
      }
    },
    [containers, containerAction]
  )

  const handleStopDockerProject = useCallback(
    (projectName: string, projectContainers: Container[]) => {
      const running = projectContainers.filter((c) => c.state === 'running')
      setDialogState({
        isOpen: true,
        title: `Stop ${running.length} container${running.length === 1 ? '' : 's'} in ${projectName}?`,
        description: `This will stop all running containers in this Compose stack.`,
        targetList: running.map((c) => `${c.name} (${c.image})`),
        action: async () => {
          setIsBusy(true)
          try {
            for (const c of running) {
              await containerAction(c.id, 'stop')
            }
            setToast({
              id: Date.now().toString(),
              text: `Stopped stack ${projectName}`,
              type: 'success'
            })
          } finally {
            setIsBusy(false)
            setDialogState((prev) => ({ ...prev, isOpen: false }))
          }
        }
      })
    },
    [containerAction]
  )

  const handleStopAllContainers = useCallback(() => {
    const running = containers.filter((c) => c.state === 'running')
    setDialogState({
      isOpen: true,
      title: `Stop all ${running.length} running containers?`,
      description: `This will stop every running Docker container.`,
      targetList: running.map((c) => `${c.name} (${c.image})`),
      action: async () => {
        setIsBusy(true)
        try {
          const ok = await stopAllContainers()
          if (ok) {
            setToast({
              id: Date.now().toString(),
              text: `Stopped all running containers`,
              type: 'success'
            })
          }
        } finally {
          setIsBusy(false)
          setDialogState((prev) => ({ ...prev, isOpen: false }))
        }
      }
    })
  }, [containers, stopAllContainers])

  const handleUpdateSettings = useCallback(
    async (partial: Partial<Settings>): Promise<void> => {
      const res = await updateSettings(partial)
      if (res.ok) {
        if (partial.dockerSocketPath !== undefined) {
          await refreshDocker()
        }
      }
    },
    [updateSettings, refreshDocker]
  )

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={procs.length}
        projectCount={totalProjects}
        dockerRunningCount={dockerRunningCount}
        dockerTotalCount={containers.length}
        recentlyStoppedCount={recentItems.length}
        onOpenRecentlyStopped={() => setIsRecentOpen(true)}
        settings={settings}
        onIntervalChange={changeInterval}
        onRefresh={activeTab === 'processes' ? refreshProcs : refreshDocker}
        onStopAll={
          activeTab === 'processes'
            ? procs.length > 0
              ? handleStopAllProcesses
              : undefined
            : dockerRunningCount > 0
              ? handleStopAllContainers
              : undefined
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
        loading={activeTab === 'processes' ? procsLoading : dockerLoading}
      />

      <main className="app-content" tabIndex={-1}>
        {activeTab === 'processes' ? (
          /* Processes View */
          procsLoading && procs.length === 0 ? (
            <LoadingState />
          ) : procsError && procs.length === 0 ? (
            <ErrorState message={procsError} onRetry={refreshProcs} />
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
          )
        ) : /* Docker View */
        dockerLoading && containers.length === 0 ? (
          <LoadingState />
        ) : dockerError && containers.length === 0 ? (
          <ErrorState
            message={
              dockerErrorCode === 'DOCKER_UNAVAILABLE'
                ? 'Docker daemon is not running. Start Docker Desktop, OrbStack, or Colima to view containers.'
                : dockerErrorCode === 'DENIED'
                  ? 'Permission denied accessing Docker socket.'
                  : dockerError
            }
            onRetry={refreshDocker}
          />
        ) : containers.length === 0 ? (
          <EmptyState />
        ) : filteredContainers.length === 0 ? (
          <EmptyState searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} />
        ) : (
          <div className="project-groups-list">
            {groupedDockerProjects.map((group) => (
              <DockerProjectGroup
                key={group.name}
                projectName={group.name}
                containers={group.containers}
                onAction={handleDockerAction}
                onStopProject={handleStopDockerProject}
                onViewLogs={setSelectedLogContainer}
                actionLoadingId={actionLoadingId}
              />
            ))}
          </div>
        )}
      </main>

      {/* Log Viewer Modal */}
      {selectedLogContainer && (
        <DockerLogViewer
          container={selectedLogContainer}
          onClose={() => setSelectedLogContainer(null)}
        />
      )}

      {/* Recently Stopped Drawer */}
      <RecentlyStoppedDrawer
        isOpen={isRecentOpen}
        items={recentItems}
        loading={recentLoading}
        restartingId={restartingId}
        onClose={() => setIsRecentOpen(false)}
        onRestart={handleRestartStopped}
        onClear={handleClearRecent}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onUpdate={handleUpdateSettings}
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        description={dialogState.description}
        targetList={dialogState.targetList}
        isBusy={isBusy}
        onConfirm={dialogState.action}
        onCancel={() => setDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Status Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default App
