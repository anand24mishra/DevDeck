import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { is } from '@electron-toolkit/utils'
import { Result, Proc, Settings } from '../shared/types'
import { DarwinProcessProvider } from './providers/process.darwin'
import { settingsService } from './services/settings'

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
}
