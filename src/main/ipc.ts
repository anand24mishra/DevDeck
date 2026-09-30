import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { Result, Proc, Settings, KillReport, Container } from '../shared/types'
import { DarwinProcessProvider } from './providers/process.darwin'
import { settingsService } from './services/settings'
import { dockerService } from './services/docker'

const processProvider = new DarwinProcessProvider()

function isSenderAuthorized(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  if (!url) return false
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) {
    return url.startsWith(devUrl)
  }
  return url.startsWith('file://')
}

export function registerIpcHandlers(): void {
  // procs:list
  ipcMain.handle('procs:list', async (event): Promise<Result<Proc[]>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    try {
      const settings = settingsService.getSettings()
      const procs = await processProvider.listProcesses({
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      })
      return { ok: true, data: procs }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list processes'
      return {
        ok: false,
        error: { code: 'INTERNAL', message }
      }
    }
  })

  // settings:get
  ipcMain.handle('settings:get', async (event): Promise<Result<Settings>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    try {
      return { ok: true, data: settingsService.getSettings() }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve settings'
      return {
        ok: false,
        error: { code: 'INTERNAL', message }
      }
    }
  })

  // settings:set
  ipcMain.handle(
    'settings:set',
    async (event, partial: Partial<Settings>): Promise<Result<Settings>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      try {
        if (!partial || typeof partial !== 'object') {
          return {
            ok: false,
            error: { code: 'INVALID_INPUT', message: 'Settings must be an object' }
          }
        }
        const updated = settingsService.updateSettings(partial)
        return { ok: true, data: updated }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update settings'
        return {
          ok: false,
          error: { code: 'INTERNAL', message }
        }
      }
    }
  )

  // procs:stop
  ipcMain.handle(
    'procs:stop',
    async (event, { pids }: { pids: number[] }): Promise<Result<KillReport>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      if (
        !Array.isArray(pids) ||
        pids.some((p) => !Number.isInteger(p) || p <= 1) ||
        pids.length > 500
      ) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid PIDs array' } }
      }
      try {
        const { terminate, defaultKillDeps } = await import('./services/kill')
        const report = await terminate(pids, defaultKillDeps)
        return { ok: true, data: report }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Termination failed'
        return { ok: false, error: { code: 'INTERNAL', message } }
      }
    }
  )

  // procs:stopProject
  ipcMain.handle(
    'procs:stopProject',
    async (event, { project }: { project: string }): Promise<Result<KillReport>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      if (typeof project !== 'string' || !project.trim()) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid project name' } }
      }
      try {
        const settings = settingsService.getSettings()
        const procs = await processProvider.listProcesses({
          userIgnoreList: settings.ignoreList,
          customAllowlist: settings.customAllowlist
        })
        const matching = procs.filter(
          (p) => p.project.toLowerCase() === project.trim().toLowerCase()
        )
        const pids = matching.map((p) => p.pid)

        const { terminate, defaultKillDeps } = await import('./services/kill')
        const report = await terminate(pids, defaultKillDeps)
        return { ok: true, data: report }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Project stop failed'
        return { ok: false, error: { code: 'INTERNAL', message } }
      }
    }
  )

  // procs:stopAll
  ipcMain.handle('procs:stopAll', async (event): Promise<Result<KillReport>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    try {
      const settings = settingsService.getSettings()
      const procs = await processProvider.listProcesses({
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      })
      const pids = procs.map((p) => p.pid)

      const { terminate, defaultKillDeps } = await import('./services/kill')
      const report = await terminate(pids, defaultKillDeps)
      return { ok: true, data: report }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Stop all failed'
      return { ok: false, error: { code: 'INTERNAL', message } }
    }
  })

  // docker:list
  ipcMain.handle('docker:list', async (event): Promise<Result<Container[]>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    const settings = settingsService.getSettings()
    return await dockerService.listContainers(settings.dockerSocketPath)
  })

  // docker:action
  ipcMain.handle(
    'docker:action',
    async (
      event,
      { id, action }: { id: string; action: 'start' | 'stop' | 'restart' }
    ): Promise<Result<null>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      if (!['start', 'stop', 'restart'].includes(action)) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid container action' } }
      }
      const settings = settingsService.getSettings()
      return await dockerService.containerAction(id, action, settings.dockerSocketPath)
    }
  )

  // docker:stopAll
  ipcMain.handle('docker:stopAll', async (event): Promise<Result<null>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    const settings = settingsService.getSettings()
    return await dockerService.stopAllContainers(settings.dockerSocketPath)
  })

  // docker:logs:start
  ipcMain.handle(
    'docker:logs:start',
    async (event, { id }: { id: string }): Promise<Result<null>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      const settings = settingsService.getSettings()
      const sender = event.sender

      // Clean up if sender is destroyed
      sender.once('destroyed', () => {
        dockerService.stopContainerLogs(id)
      })

      return await dockerService.startContainerLogs(
        id,
        (text) => {
          if (!sender.isDestroyed()) {
            sender.send('docker:log', { id, text })
          }
        },
        settings.dockerSocketPath
      )
    }
  )

  // docker:logs:stop
  ipcMain.handle(
    'docker:logs:stop',
    async (event, { id }: { id: string }): Promise<Result<null>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      return dockerService.stopContainerLogs(id)
    }
  )

  // Forward docker changes to all open windows
  dockerService.onDockerChanged(() => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('docker:changed')
      }
    })
  })
}
