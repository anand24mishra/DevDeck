import { contextBridge, ipcRenderer } from 'electron'
import {
  DevDeckApi,
  Result,
  Proc,
  Settings,
  RecentlyStoppedItem,
  FocusTarget
} from '../shared/types'

let pendingFocus: FocusTarget | undefined
const focusCallbacks = new Set<(target: FocusTarget) => void>()
ipcRenderer.on('app:focus', (_event, target: FocusTarget) => {
  if (focusCallbacks.size) for (const callback of focusCallbacks) callback(target)
  else pendingFocus = target
})
const api: DevDeckApi = {
  exportPreview: (kind, format) => ipcRenderer.invoke('export:preview', { kind, format }),
  projectHistory: (project) => ipcRenderer.invoke('project:history', { project }),
  startLaunch: (member) => ipcRenderer.invoke('launch:start', { member }),
  listLaunches: () => ipcRenderer.invoke('launch:list'),
  launchLogs: (id) => ipcRenderer.invoke('launch:logs', { id }),
  clearLaunchLogs: (id) => ipcRenderer.invoke('launch:clear', { id }),
  reservePort: (port, project) => ipcRenderer.invoke('ports:reserve', { port, project }),
  unreservePort: (port) => ipcRenderer.invoke('ports:unreserve', { port }),
  reservedPortStatus: () => ipcRenderer.invoke('ports:reserved'),
  readRepoConfig: (path) => ipcRenderer.invoke('repoConfig:read', { path }),
  importRepoConfig: (path) => ipcRenderer.invoke('repoConfig:import', { path }),
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  saveProfile: (profile) => ipcRenderer.invoke('profiles:save', { profile }),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', { id }),
  profileFromProject: (path) => ipcRenderer.invoke('profiles:fromProject', { path }),
  profileAction: (id, action) => ipcRenderer.invoke('profiles:action', { id, action }),
  inspectContainer: (id) => ipcRenderer.invoke('docker:inspect', { id }),
  openContainerShell: (id) => ipcRenderer.invoke('docker:exec', { id }),
  startContainerStats: (ids) => ipcRenderer.invoke('docker:stats:start', { ids }),
  stopContainerStats: (ids) => ipcRenderer.invoke('docker:stats:stop', { ids }),
  onContainerStats: (callback) => {
    const handler = (_event, value): void => callback(value)
    ipcRenderer.on('docker:stats', handler)
    return () => {
      ipcRenderer.removeListener('docker:stats', handler)
    }
  },
  getProjectContext: (path) => ipcRenderer.invoke('project:context', { path }),
  signalProcess: (action, target) => ipcRenderer.invoke('proc:signal', { action, target }),
  getProcessEnvironment: (pid, startTime) =>
    ipcRenderer.invoke('proc:environment', { pid, startTime }),
  getProcessDetails: (pid, startTime) => ipcRenderer.invoke('proc:details', { pid, startTime }),
  getProcessTree: () => ipcRenderer.invoke('proc:tree'),
  stopProcessTree: (root, targets) => ipcRenderer.invoke('proc:treeStop', { root, targets }),
  getDockerApps: () => ipcRenderer.invoke('docker:apps'),
  launchDockerApp: (app) => ipcRenderer.invoke('docker:launch', { app }),
  removeContainer: (id) => ipcRenderer.invoke('docker:remove', { id }),
  composeAction: (project, action, ids) =>
    ipcRenderer.invoke('docker:composeAction', { project, action, ids }),
  onFocusTarget: (callback) => {
    focusCallbacks.add(callback)
    if (pendingFocus) {
      const target = pendingFocus
      pendingFocus = undefined
      queueMicrotask(() => {
        if (focusCallbacks.has(callback)) callback(target)
      })
    }
    return () => {
      focusCallbacks.delete(callback)
    }
  },
  getInstalledApps: () => ipcRenderer.invoke('project:apps'),
  openProjectInEditor: (path) => ipcRenderer.invoke('project:openEditor', { path }),
  showProjectInFinder: (path) => ipcRenderer.invoke('project:openFinder', { path }),
  openProjectInTerminal: (path) => ipcRenderer.invoke('project:openTerminal', { path }),
  openLocalUrl: (url) => ipcRenderer.invoke('url:open', { url }),
  lookupPort: (port, project) =>
    ipcRenderer.invoke('ports:lookup', { port, ...(project ? { project } : {}) }),
  getProcesses: (): Promise<Result<Proc[]>> => ipcRenderer.invoke('procs:list'),
  getSettings: (): Promise<Result<Settings>> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<Settings>): Promise<Result<Settings>> =>
    ipcRenderer.invoke('settings:set', partial),
  stopProcess: (target) => ipcRenderer.invoke('procs:stop', { targets: [target] }),
  stopProject: (project, targets) => ipcRenderer.invoke('procs:stopProject', { project, targets }),
  stopAll: (targets) => ipcRenderer.invoke('procs:stopAll', { targets }),
  getRecentlyStopped: (): Promise<Result<RecentlyStoppedItem[]>> =>
    ipcRenderer.invoke('recent:list'),
  restartStopped: (id: string): Promise<Result<{ pid?: number }>> =>
    ipcRenderer.invoke('recent:restart', { id }),
  clearRecentlyStopped: (): Promise<Result<null>> => ipcRenderer.invoke('recent:clear'),
  onRecentlyStoppedChanged: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('recent:changed', handler)
    return () => {
      ipcRenderer.removeListener('recent:changed', handler)
    }
  },
  listContainers: () => ipcRenderer.invoke('docker:list'),
  containerAction: (id: string, action: 'start' | 'stop' | 'restart') =>
    ipcRenderer.invoke('docker:action', { id, action }),
  stopAllContainers: () => ipcRenderer.invoke('docker:stopAll'),
  startContainerLogs: (id: string) => ipcRenderer.invoke('docker:logs:start', { id }),
  stopContainerLogs: (id: string) => ipcRenderer.invoke('docker:logs:stop', { id }),
  onDockerLog: (callback) => {
    const handler = (_event, msg): void => callback(msg)
    ipcRenderer.on('docker:log', handler)
    return () => {
      ipcRenderer.removeListener('docker:log', handler)
    }
  },
  onDockerChanged: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('docker:changed', handler)
    return () => {
      ipcRenderer.removeListener('docker:changed', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (fallback)
  window.api = api
}
