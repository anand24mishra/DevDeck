import { ProcessTreeView } from './components/ProcessTreeView'
import { sortProcesses, processTotals, type ProcessSort } from './utils/processes'
import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Proc, KillReport, Container, Settings, ProcessIdentity } from '../../shared/types'
import { useProcesses } from './hooks/useProcesses'
import { useDocker } from './hooks/useDocker'
import { useRecentlyStopped } from './hooks/useRecentlyStopped'
import { Onboarding } from './components/Onboarding'
import { PortLookup } from './components/PortLookup'
import { Header } from './components/Header'
import { ProjectGroup } from './components/ProjectGroup'
import { DockerProjectGroup } from './components/DockerProjectGroup'
import { DockerLogViewer } from './components/DockerLogViewer'
import { SettingsModal } from './components/SettingsModal'
import { RecentlyStoppedDrawer } from './components/RecentlyStoppedDrawer'
import { EmptyState } from './components/EmptyState'
import { LoadingState } from './components/LoadingState'
import { DockerErrorState } from './components/DockerErrorState'
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
  confirmLabel?: string
  description?: string
  targetList?: string[]
  action: () => Promise<void>
}

const identity = ({ pid, startTime, command }: Proc): ProcessIdentity => ({
  pid,
  startTime,
  command
})

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

  const [socketProtocol, setSocketProtocol] = useState<'all' | 'TCP' | 'UDP'>('all')
  const [socketState, setSocketState] = useState<'all' | 'LISTEN' | 'ESTABLISHED'>('all')
  const [leftoversOnly, setLeftoversOnly] = useState(false)
  const [treeView, setTreeView] = useState(false)
  const [sortBy, setSortBy] = useState<ProcessSort>('name')
  const [heavyOnly, setHeavyOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedLogContainer, setSelectedLogContainer] = useState<Container | null>(null)
  const [replayOnboarding, setReplayOnboarding] = useState(false)
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

  useEffect(
    () =>
      window.api.onFocusTarget((target) => {
        setActiveTab('processes')
        setSearchQuery(target.project || (target.port ? String(target.port) : ''))
        if (target.pid)
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLElement>(`[data-process-id="${target.pid}"] .process-row`)
              ?.focus()
          )
      }),
    []
  )

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
  const totals = processTotals(procs)
  const filteredProcesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sortProcesses(
      procs.filter(
        (proc) =>
          (!heavyOnly || proc.cpu >= 50 || proc.memMB >= 512) &&
          (!leftoversOnly || !!proc.leftoverReason) &&
          ((socketProtocol === 'all' && socketState === 'all') ||
            (proc.sockets || []).some(
              (socket) =>
                (socketProtocol === 'all' || socket.protocol === socketProtocol) &&
                (socketState === 'all' || socket.state === socketState)
            )) &&
          (!q ||
            proc.name.toLowerCase().includes(q) ||
            proc.project.toLowerCase().includes(q) ||
            proc.ports.some((port) => String(port).includes(q)))
      ),
      sortBy
    )
  }, [procs, searchQuery, sortBy, heavyOnly, socketProtocol, socketState, leftoversOnly])

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

  const showReportToast = useCallback(
    (report: KillReport): void => {
      const parts: string[] = []
      if (report.stopped.length > 0) parts.push(`Stopped ${report.stopped.length}`)
      if (report.forced.length > 0) parts.push(`forced ${report.forced.length}`)
      if (report.refused.length > 0) parts.push(`refused ${report.refused.length}`)

      const text = parts.length > 0 ? parts.join(', ') : 'No processes stopped'
      const type = report.stopped.length > 0 || report.forced.length > 0 ? 'success' : 'warn'
      setToast({
        id: Date.now().toString(),
        text,
        type,
        expiresAt: report.undoItems?.length ? Date.now() + 10_000 : undefined,
        action: report.undoItems?.length
          ? {
              label: 'Undo',
              run: async () => {
                let restored = 0
                for (const item of report.undoItems || []) {
                  const result = await restartItem(item.id)
                  if (result.ok) restored++
                }
                setToast({
                  id: Date.now().toString(),
                  text: `Restarted ${restored} of ${report.undoItems!.length} processes`,
                  type: restored ? 'success' : 'warn'
                })
                await refreshProcs()
              }
            }
          : undefined
      })
    },
    [restartItem, refreshProcs]
  )

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
            const res = await stopProcess(identity(proc))
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
    [stopProcess, showReportToast]
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
            const res = await stopProject(project, projectProcs.map(identity))
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
    [stopProject, showReportToast]
  )

  const handleStopAllProcesses = useCallback(() => {
    const targets = procs.filter((proc) => proc.manageable !== false)
    setDialogState({
      isOpen: true,
      title: `Stop all ${targets.length} dev processes?`,
      description: `This will stop every dev process running on your machine.`,
      targetList: targets.map((p) => `${p.name} in ${p.project} (PID ${p.pid})`),
      action: async () => {
        setIsBusy(true)
        try {
          const res = await stopAll(targets.map(identity))
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
  }, [procs, stopAll, showReportToast])

  const handleStopLeftovers = useCallback(() => {
    const targets = procs.filter((proc) => proc.leftoverReason && proc.manageable !== false)
    setDialogState({
      isOpen: true,
      title: `Stop ${targets.length} possibly leftover processes?`,
      targetList: targets.map((proc) => `${proc.name} in ${proc.project}`),
      action: async () => {
        setIsBusy(true)
        try {
          const result = await stopAll(targets.map(identity))
          if (result.ok) showReportToast(result.data)
          else setToast({ id: String(Date.now()), text: result.error.message, type: 'error' })
        } finally {
          setIsBusy(false)
          setDialogState((previous) => ({ ...previous, isOpen: false }))
        }
      }
    })
  }, [procs, stopAll, showReportToast])

  const handleStopTree = useCallback(
    (root: Proc, targets: Proc[]) => {
      setDialogState({
        isOpen: true,
        title: `Stop ${targets.length} processes in the ${root.name} tree?`,
        targetList: targets.map((proc) => `${proc.name} in ${proc.project}`),
        action: async () => {
          setIsBusy(true)
          try {
            const result = await window.api.stopProcessTree(identity(root), targets.map(identity))
            if (result.ok) showReportToast(result.data)
            else setToast({ id: String(Date.now()), text: result.error.message, type: 'error' })
            await refreshProcs()
          } finally {
            setIsBusy(false)
            setDialogState((previous) => ({ ...previous, isOpen: false }))
          }
        }
      })
    },
    [refreshProcs, showReportToast]
  )

  // Docker Actions
  const handleDockerAction = useCallback(
    (id: string, action: 'start' | 'stop' | 'restart') => {
      const container = containers.find((c) => c.id === id)
      const name = container?.name || id

      if (action !== 'start') {
        setDialogState({
          isOpen: true,
          title: `${action === 'restart' ? 'Restart' : 'Stop'} container ${name}?`,
          confirmLabel: action === 'restart' ? 'Restart' : 'Stop',
          description: `This will send a stop signal to the container with a 10s graceful shutdown timeout.`,
          targetList: [`${name} (${container?.image || 'unknown image'})`],
          action: async () => {
            setIsBusy(true)
            try {
              const ok = await containerAction(id, action)
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

  const handleDockerProject = useCallback(
    (project: string, members: Container[], action: 'start' | 'stop' | 'restart') => {
      const run = async (): Promise<void> => {
        setIsBusy(true)
        try {
          const result = await window.api.composeAction(
            project,
            action,
            members.map((item) => item.id)
          )
          setToast({
            id: String(Date.now()),
            text: result.ok
              ? result.data
                  .map((item) => `${item.name}: ${item.ok ? 'done' : item.message}`)
                  .join('; ')
              : result.error.message,
            type: result.ok && result.data.every((item) => item.ok) ? 'success' : 'warn'
          })
          await refreshDocker()
        } finally {
          setIsBusy(false)
          setDialogState((previous) => ({ ...previous, isOpen: false }))
        }
      }
      if (action === 'start') {
        void run()
        return
      }
      setDialogState({
        isOpen: true,
        title: `${action === 'stop' ? 'Stop' : 'Restart'} ${members.length} containers in ${project}?`,
        confirmLabel: action === 'stop' ? 'Stop' : 'Restart',
        targetList: members.map((item) => `${item.name} (${item.image})`),
        action: run
      })
    },
    [refreshDocker]
  )

  const handleDockerRemove = useCallback(
    (container: Container) => {
      setDialogState({
        isOpen: true,
        title: `Remove container ${container.name}?`,
        confirmLabel: 'Remove',
        description: `${container.state === 'running' ? 'The container will be stopped first. ' : ''}${container.hasVolumes ? 'Attached folders and volumes will be kept. ' : ''}This container cannot be restored with Undo.`,
        targetList: [container.name],
        action: async () => {
          setIsBusy(true)
          try {
            const result = await window.api.removeContainer(container.id)
            setToast({
              id: String(Date.now()),
              text: result.ok ? `Removed ${container.name}` : result.error.message,
              type: result.ok ? 'success' : 'error'
            })
            await refreshDocker()
          } finally {
            setIsBusy(false)
            setDialogState((previous) => ({ ...previous, isOpen: false }))
          }
        }
      })
    },
    [refreshDocker]
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
      if (!res.ok) throw new Error(res.error.message)
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

      {(!settings.onboardingComplete || replayOnboarding) && (
        <Onboarding
          onComplete={async () => {
            const result = await updateSettings({ onboardingComplete: true })
            if (result.ok) setReplayOnboarding(false)
            else setToast({ id: String(Date.now()), text: result.error.message, type: 'error' })
          }}
        />
      )}
      {activeTab === 'processes' && (
        <PortLookup
          interval={settings.refreshIntervalSec}
          onStop={handleStopProcess}
          projects={[...new Set(procs.map((proc) => proc.project))]}
          onStopContainer={(id) => handleDockerAction(id, 'stop')}
        />
      )}
      {activeTab === 'processes' && (
        <div className="process-tools">
          <label>
            <input
              type="checkbox"
              checked={treeView}
              onChange={(event) => setTreeView(event.target.checked)}
            />{' '}
            Process tree
          </label>
          <select
            className="settings-select"
            aria-label="Socket protocol"
            value={socketProtocol}
            onChange={(event) => setSocketProtocol(event.target.value as typeof socketProtocol)}
          >
            <option value="all">TCP and UDP</option>
            <option>TCP</option>
            <option>UDP</option>
          </select>
          <select
            className="settings-select"
            aria-label="Connection state"
            value={socketState}
            onChange={(event) => setSocketState(event.target.value as typeof socketState)}
          >
            <option value="all">All connections</option>
            <option value="LISTEN">Listening</option>
            <option value="ESTABLISHED">Established</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={leftoversOnly}
              onChange={(event) => setLeftoversOnly(event.target.checked)}
            />{' '}
            Possibly leftover
          </label>
          <button
            className="quiet-btn"
            disabled={!procs.some((proc) => proc.leftoverReason && proc.manageable !== false)}
            onClick={handleStopLeftovers}
          >
            Stop leftovers
          </button>
          <label htmlFor="process-sort">Sort by</label>
          <select
            id="process-sort"
            className="settings-select"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as ProcessSort)}
          >
            {(['name', 'memory', 'cpu', 'uptime', 'port'] as const).map((key) => (
              <option value={key} key={key}>
                {key === 'cpu' ? 'CPU' : key[0].toUpperCase() + key.slice(1)}
              </option>
            ))}
          </select>
          <label title="At least 50% CPU or 512 MB memory">
            <input
              type="checkbox"
              checked={heavyOnly}
              onChange={(event) => setHeavyOnly(event.target.checked)}
            />{' '}
            Heavy only
          </label>
          <span className="mono">
            {totals.memMB} MB total · {totals.cpu.toFixed(1)}% CPU
          </span>
          {totals.memMB > (settings.memoryThresholdMb || 4096) && (
            <span role="status">
              Development processes are using more than {settings.memoryThresholdMb || 4096} MB.
              <button
                className="quiet-btn"
                onClick={() => {
                  setSortBy('memory')
                  setHeavyOnly(false)
                  setSearchQuery('')
                }}
              >
                Review
              </button>
            </span>
          )}
        </div>
      )}
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
          ) : treeView ? (
            <ProcessTreeView
              processes={filteredProcesses}
              allProcesses={procs}
              onStop={handleStopProcess}
              onStopTree={handleStopTree}
            />
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
          <DockerErrorState message={dockerError} code={dockerErrorCode} onRetry={refreshDocker} />
        ) : containers.length === 0 ? (
          <EmptyState kind="docker" />
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
                onStopProject={(name, members) => handleDockerProject(name, members, 'stop')}
                onStartProject={(name, members) => handleDockerProject(name, members, 'start')}
                onRestartProject={(name, members) => handleDockerProject(name, members, 'restart')}
                onRemove={handleDockerRemove}
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
        onReplayOnboarding={() => {
          setIsSettingsOpen(false)
          setReplayOnboarding(true)
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        confirmLabel={dialogState.confirmLabel}
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
