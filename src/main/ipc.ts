import { detectApplications, verifyProjectPath, openWithApplication } from './services/applications'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { isExpectedPage, validIpcInput } from './security/validate'
import { ipcMain, IpcMainInvokeEvent, BrowserWindow, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { Result, Proc, Settings, KillReport, Container, RecentlyStoppedItem } from '../shared/types'
import { DarwinProcessProvider } from './providers/process.darwin'
import { settingsService } from './services/settings'
import { dockerService } from './services/docker'
import { terminate, defaultKillDeps, validIdentities } from './services/kill'
import { recentlyStoppedService } from './services/recentlyStopped'

const processProvider = new DarwinProcessProvider()

function isSenderAuthorized(event: IpcMainInvokeEvent): boolean {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || event.senderFrame !== event.sender.mainFrame) return false
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const expected =
    is.dev && devUrl
      ? new URL(devUrl).href
      : pathToFileURL(join(__dirname, '../renderer/index.html')).href
  return isExpectedPage(event.senderFrame?.url, expected)
}

export function registerIpcHandlers(): void {
  const handle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      if (args.length > 1 || !validIpcInput(channel, args[0])) {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'Invalid request. Refresh and try again.' }
        }
      }
      try {
        const result = await handler(event, args[0])
        if (result?.ok === false && result.error?.code === 'INTERNAL') {
          return {
            ok: false,
            error: { code: 'INTERNAL', message: 'Could not complete the request. Try again.' }
          }
        }
        return result
      } catch {
        return {
          ok: false,
          error: { code: 'INTERNAL', message: 'Could not complete the request. Try again.' }
        }
      }
    })
  }

  // Initialize persistence for recently stopped processes
  const initialSettings = settingsService.getSettings()
  recentlyStoppedService.loadIfPersisted(!!initialSettings.persistRecentlyStopped)

  // procs:list
  handle('procs:list', async (event): Promise<Result<Proc[]>> => {
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

  handle('project:apps', async () => ({ ok: true, data: detectApplications() }))
  for (const channel of ['project:openEditor', 'project:openFinder', 'project:openTerminal']) {
    handle(channel, async (_event, { path }: { path: string }) => {
      const settings = settingsService.getSettings()
      const procs = await processProvider.listProcesses({
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      })
      const root = verifyProjectPath(
        path,
        procs.flatMap((proc) => (proc.projectPath ? [proc.projectPath] : []))
      )
      if (!root)
        return {
          ok: false,
          error: {
            code: 'DENIED',
            message: 'This project folder could not be verified. Refresh and try again.'
          }
        }
      if (channel === 'project:openFinder') shell.showItemInFolder(root)
      else {
        const kind = channel === 'project:openEditor' ? 'editor' : 'terminal'
        const preferred = kind === 'editor' ? settings.preferredEditor : settings.preferredTerminal
        const app = detectApplications().find(
          (candidate) =>
            candidate.kind === kind &&
            (!preferred || preferred === 'auto' || candidate.id === preferred)
        )
        if (!app)
          return {
            ok: false,
            error: {
              code: 'NOT_FOUND',
              message: `No ${kind} was found. Choose an installed application in Settings.`
            }
          }
        await openWithApplication(app, root)
      }
      return { ok: true, data: null }
    })
  }

  handle('url:open', async (_event, { url }: { url: string }) => {
    await shell.openExternal(url)
    return { ok: true, data: null }
  })

  handle('ports:lookup', async (_event, { port }: { port: number }) => {
    const settings = settingsService.getSettings()
    return {
      ok: true,
      data: await processProvider.lookupPort(port, {
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      })
    }
  })

  // settings:get
  handle('settings:get', async (event): Promise<Result<Settings>> => {
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
  handle('settings:set', async (event, partial: Partial<Settings>): Promise<Result<Settings>> => {
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
      if (partial.persistRecentlyStopped !== undefined) {
        recentlyStoppedService.saveIfPersisted(!!updated.persistRecentlyStopped)
      }
      return { ok: true, data: updated }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update settings'
      return {
        ok: false,
        error: { code: 'INTERNAL', message }
      }
    }
  })

  for (const channel of ['procs:stop', 'procs:stopProject', 'procs:stopAll']) {
    handle(channel, async (event, input: unknown): Promise<Result<KillReport>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      const value = input as Record<string, unknown> | null
      const keys = channel === 'procs:stopProject' ? 'project,targets' : 'targets'
      if (
        !value ||
        typeof value !== 'object' ||
        Object.keys(value).sort().join(',') !== keys ||
        !validIdentities(value.targets) ||
        (channel === 'procs:stopProject' &&
          (typeof value.project !== 'string' || !value.project.trim()))
      ) {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'Invalid confirmed process identities' }
        }
      }
      const targets = value.targets
      try {
        const settings = settingsService.getSettings()
        const procs = await processProvider.listProcesses({
          userIgnoreList: settings.ignoreList,
          customAllowlist: settings.customAllowlist
        })
        const scope = new Map(
          procs
            .filter((proc) => channel !== 'procs:stopProject' || proc.project === value.project)
            .map((proc) => [proc.pid, proc])
        )
        const scopedDeps = {
          ...defaultKillDeps,
          revalidate: async (pids: number[]) => {
            const result = await defaultKillDeps.revalidate(pids)
            return {
              ok: result.ok.filter((proc) => scope.has(proc.pid)),
              refused: [...result.refused, ...pids.filter((pid) => !scope.has(pid))]
            }
          }
        }
        const report = await terminate(targets, scopedDeps)
        const stopped = new Set([...report.stopped, ...report.forced])
        const actual = procs.filter(
          (proc) =>
            stopped.has(proc.pid) &&
            targets.some(
              (target) =>
                target.pid === proc.pid &&
                target.startTime === proc.startTime &&
                target.command === proc.command
            )
        )
        recentlyStoppedService.recordStopped(actual, !!settings.persistRecentlyStopped)
        return { ok: true, data: report }
      } catch {
        return {
          ok: false,
          error: { code: 'INTERNAL', message: 'Could not stop processes. Refresh and try again.' }
        }
      }
    })
  }

  // recent:list
  handle('recent:list', async (event): Promise<Result<RecentlyStoppedItem[]>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    return { ok: true, data: recentlyStoppedService.getItems() }
  })

  // recent:restart
  handle(
    'recent:restart',
    async (event, { id }: { id: string }): Promise<Result<{ pid?: number }>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      if (typeof id !== 'string' || !id) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid item ID' } }
      }
      const settings = settingsService.getSettings()
      return await recentlyStoppedService.restart(id, {
        customAllowlist: settings.customAllowlist,
        userIgnoreList: settings.ignoreList
      })
    }
  )

  // recent:clear
  handle('recent:clear', async (event): Promise<Result<null>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    const settings = settingsService.getSettings()
    recentlyStoppedService.clear(!!settings.persistRecentlyStopped)
    return { ok: true, data: null }
  })

  // docker:list
  handle('docker:list', async (event): Promise<Result<Container[]>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    const settings = settingsService.getSettings()
    return await dockerService.listContainers(settings.dockerSocketPath)
  })

  // docker:action
  handle(
    'docker:action',
    async (
      event,
      { id, action }: { id: string; action: 'start' | 'stop' | 'restart' }
    ): Promise<Result<null>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      if (typeof id !== 'string' || !/^[a-f0-9]{12,64}$/i.test(id)) {
        return {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'Invalid container ID format' }
        }
      }
      if (!['start', 'stop', 'restart'].includes(action)) {
        return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid container action' } }
      }
      const settings = settingsService.getSettings()
      return await dockerService.containerAction(id, action, settings.dockerSocketPath)
    }
  )

  // docker:stopAll
  handle('docker:stopAll', async (event): Promise<Result<null>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    const settings = settingsService.getSettings()
    return await dockerService.stopAllContainers(settings.dockerSocketPath)
  })

  // docker:logs:start
  handle('docker:logs:start', async (event, { id }: { id: string }): Promise<Result<null>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    if (typeof id !== 'string' || !/^[a-f0-9]{12,64}$/i.test(id)) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid container ID format' }
      }
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
  })

  // docker:logs:stop
  handle('docker:logs:stop', async (event, { id }: { id: string }): Promise<Result<null>> => {
    if (!isSenderAuthorized(event)) {
      return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
    }
    if (typeof id !== 'string' || !/^[a-f0-9]{12,64}$/i.test(id)) {
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid container ID format' }
      }
    }
    return dockerService.stopContainerLogs(id)
  })

  // Forward docker changes to all open windows
  dockerService.onDockerChanged(() => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('docker:changed')
      }
    })
  })

  // Forward recent changes to all open windows
  recentlyStoppedService.onChanged(() => {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('recent:changed')
      }
    })
  })
}
