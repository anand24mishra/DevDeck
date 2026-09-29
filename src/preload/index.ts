import { contextBridge, ipcRenderer } from 'electron'
import { DevDeckApi, Result, Proc, Settings } from '../shared/types'

const api: DevDeckApi = {
  getProcesses: (): Promise<Result<Proc[]>> => ipcRenderer.invoke('procs:list'),
  getSettings: (): Promise<Result<Settings>> => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial: Partial<Settings>): Promise<Result<Settings>> =>
    ipcRenderer.invoke('settings:set', partial)
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
