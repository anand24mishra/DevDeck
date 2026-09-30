import { contextBridge, ipcRenderer } from 'electron'
import { DevDeckApi, Result, Proc, Settings, RecentlyStoppedItem } from '../shared/types'

const api: DevDeckApi = {
  getProcesses: (): Promise<Result<Proc[]>> => ipcRenderer.invoke('procs:list'),
  getSettings: (): Promise<Result<Settings>> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<Settings>): Promise<Result<Settings>> =>
    ipcRenderer.invoke('settings:set', partial),
  stopProcess: (pid: number) => ipcRenderer.invoke('procs:stop', { pids: [pid] }),
  stopProject: (project: string) => ipcRenderer.invoke('procs:stopProject', { project }),
  stopAll: () => ipcRenderer.invoke('procs:stopAll'),
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
