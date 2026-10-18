import { launchMember, launches } from './services/launcher'
import { repoConfigRequest } from './services/repoConfig'
import { listProfiles, saveProfile, profileFromProject, profileAction } from './services/profiles'
import { openContainerShell } from './services/containerShell'
import { projectContext } from './services/context'
import { readEnvironment } from './services/environment'
import { buildProcessTree, descendantsChildrenFirst } from '../shared/processTree'
import { notificationService } from './services/notifications'
import { hotkeyService } from './services/hotkey'
import { explainPortOwner } from './services/ports'
import { detectApplications, verifyProjectPath, openWithApplication } from './services/applications'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { isExpectedPage, validIpcInput } from './security/validate'
import { ipcMain, IpcMainInvokeEvent, BrowserWindow, shell, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import {
  Result,
  Proc,
  Settings,
  KillReport,
  Container,
  RecentlyStoppedItem,
  ProcessIdentity,
  ProcessSignalAction
} from '../shared/types'
import { DarwinProcessProvider } from './providers/process.darwin'
import { settingsService } from './services/settings'
import { dockerService, detectDockerApps } from './services/docker'
import { terminate, defaultKillDeps, validIdentities, sendControlSignal } from './services/kill'
import { recentlyStoppedService } from './services/recentlyStopped'

let latestPortProcesses: Proc[] = []
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
        customAllowlist: settings.customAllowlist,
        hintsEnabled: settings.hintsEnabled,
        showUnmanageable: settings.showUnmanageable || !!settings.reservedPorts?.length
      })
      latestPortProcesses = procs
      notificationService.observe(procs, settings)
      return {
        ok: true,
        data: settings.showUnmanageable ? procs : procs.filter((p) => p.manageable !== false)
      }
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

  handle('ports:lookup', async (_event, { port, project }: { port: number; project?: string }) => {
    const settings = settingsService.getSettings()
    const [owners, containers] = await Promise.all([
      processProvider.lookupPort(port, {
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      }),
      dockerService.listContainers(settings.dockerSocketPath)
    ])
    return {
      ok: true,
      data: owners.map((owner) =>
        explainPortOwner(owner, containers.ok ? containers.data : [], project)
      )
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
      if (partial.hotkey !== undefined && !hotkeyService.configure(partial.hotkey)) {
        return {
          ok: false,
          error: {
            code: 'DENIED',
            message: 'That shortcut is already in use. Choose a different shortcut.'
          }
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

  handle(
    'proc:environment',
    async (_event, { pid, startTime }: { pid: number; startTime: string }) => {
      if (!settingsService.getSettings().showEnvViewer)
        return {
          ok: false,
          error: { code: 'DENIED', message: 'Enable the environment viewer in Settings first.' }
        }
      return readEnvironment(pid, startTime)
    }
  )
  handle('proc:details', async (_event, { pid, startTime }: { pid: number; startTime: string }) => {
    const settings = settingsService.getSettings()
    const processes = await processProvider.listProcesses({
      userIgnoreList: settings.ignoreList,
      customAllowlist: settings.customAllowlist
    })
    const current = processes.find((proc) => proc.pid === pid && proc.startTime === startTime)
    if (!current)
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'This process changed or stopped. Refresh and try again.'
        }
      }
    const context = current.projectPath ? await projectContext(current.projectPath) : {}
    const verified = (await defaultKillDeps.revalidate([pid])).ok.find(
      (proc) => proc.pid === pid && proc.startTime === startTime && proc.command === current.command
    )
    if (!verified)
      return {
        ok: false,
        error: {
          code: 'DENIED',
          message: 'This process cannot be inspected safely. Refresh and try again.'
        }
      }
    return {
      ok: true,
      data: {
        runtime: context.runtime,
        canViewEnvironment: !!settings.showEnvViewer,
        process: current,
        user: current.user || 'Current user',
        parentName: current.parentName || 'Unavailable'
      }
    }
  })

  handle('proc:tree', async () => {
    const settings = settingsService.getSettings()
    return {
      ok: true,
      data: buildProcessTree(
        await processProvider.listProcesses({
          userIgnoreList: settings.ignoreList,
          customAllowlist: settings.customAllowlist
        })
      )
    }
  })

  for (const channel of ['procs:stop', 'procs:stopProject', 'procs:stopAll', 'proc:treeStop']) {
    handle(channel, async (event, input: unknown): Promise<Result<KillReport>> => {
      if (!isSenderAuthorized(event)) {
        return { ok: false, error: { code: 'DENIED', message: 'Unauthorized IPC sender' } }
      }
      const value = input as Record<string, unknown> | null
      const keys =
        channel === 'procs:stopProject'
          ? 'project,targets'
          : channel === 'proc:treeStop'
            ? 'root,targets'
            : 'targets'
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
      let targets = value.targets
      try {
        const settings = settingsService.getSettings()
        const procs = await processProvider.listProcesses({
          userIgnoreList: settings.ignoreList,
          customAllowlist: settings.customAllowlist
        })
        let treeMembers: Set<number> | undefined
        if (channel === 'proc:treeStop') {
          const root = value.root as ProcessIdentity
          const current = procs.find((proc) => proc.pid === root.pid)
          if (!current || current.startTime !== root.startTime || current.command !== root.command)
            return {
              ok: true,
              data: {
                requested: targets.map((target) => target.pid),
                stopped: [],
                forced: [],
                stillRunning: [],
                refused: targets.map((target) => target.pid),
                refusalReasons: Object.fromEntries(
                  targets.map((target) => [target.pid, 'identity-changed' as const])
                )
              }
            }
          const ordered = descendantsChildrenFirst(procs, root.pid)
          treeMembers = new Set(ordered.map((proc) => proc.pid))
          const captured = new Map(targets.map((target) => [target.pid, target]))
          targets = [
            ...ordered.flatMap((proc) => (captured.has(proc.pid) ? [captured.get(proc.pid)!] : [])),
            ...targets.filter((target) => !treeMembers!.has(target.pid))
          ]
        }
        const scope = new Map(
          procs
            .filter(
              (proc) =>
                (!treeMembers || treeMembers.has(proc.pid)) &&
                (channel !== 'procs:stopProject' || proc.project === value.project)
            )
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
        notificationService.expectStops(targets)
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
        report.undoItems = recentlyStoppedService
          .recordStopped(actual, !!settings.persistRecentlyStopped)
          .map(({ id, name }) => ({ id, name }))
        notificationService.report(report, settings)
        return { ok: true, data: report }
      } catch {
        return {
          ok: false,
          error: { code: 'INTERNAL', message: 'Could not stop processes. Refresh and try again.' }
        }
      }
    })
  }

  handle(
    'proc:signal',
    async (
      _event,
      { action, target }: { action: ProcessSignalAction; target: ProcessIdentity }
    ) => {
      const settings = settingsService.getSettings()
      const processes = await processProvider.listProcesses({
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      })
      const root = processes.find(
        (proc) =>
          proc.pid === target.pid &&
          proc.startTime === target.startTime &&
          proc.command === target.command
      )
      if (!root || (action === 'group' && (!root.pgid || root.pgid <= 1)))
        return {
          ok: false,
          error: { code: 'DENIED', message: 'This process changed. Refresh and try again.' }
        }
      const targets =
        action === 'group'
          ? processes
              .filter((proc) => proc.pgid === root.pgid)
              .map(({ pid, startTime, command }) => ({ pid, startTime, command }))
          : [target]
      if (targets.length > 500)
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'This group is too large. Select fewer processes.'
          }
        }
      if (action !== 'resume') {
        const verb = action === 'group' ? 'Stop group' : action[0].toUpperCase() + action.slice(1)
        const response = await dialog.showMessageBox({
          type: 'warning',
          title: 'DevDeck',
          message: `${verb} (${targets.length} processes)?`,
          detail: processes
            .filter((proc) => targets.some((item) => item.pid === proc.pid))
            .map((proc) => `${proc.name} in ${proc.project}`)
            .join('\n'),
          buttons: ['Cancel', verb],
          defaultId: 0,
          cancelId: 0,
          noLink: true
        })
        if (response.response !== 1)
          return {
            ok: true,
            data: {
              requested: targets.map((item) => item.pid),
              stopped: [],
              forced: [],
              refused: [],
              stillRunning: [],
              cancelled: true
            }
          }
      }
      const verifiedRoot = (await defaultKillDeps.revalidate([target.pid])).ok.find(
        (proc) =>
          proc.pid === target.pid &&
          proc.startTime === target.startTime &&
          proc.command === target.command
      )
      if (!verifiedRoot || (action === 'group' && verifiedRoot.pgid !== root.pgid))
        return {
          ok: false,
          error: {
            code: 'DENIED',
            message: 'This process changed during confirmation. Nothing was signaled.'
          }
        }
      const deps =
        action === 'group'
          ? {
              ...defaultKillDeps,
              revalidate: async (pids: number[]) => {
                const current = await defaultKillDeps.revalidate(pids)
                return {
                  ok: current.ok.filter((proc) => proc.pgid === root.pgid),
                  refused: [
                    ...current.refused,
                    ...current.ok.filter((proc) => proc.pgid !== root.pgid).map((proc) => proc.pid)
                  ]
                }
              }
            }
          : defaultKillDeps
      if (action === 'group' || action === 'stop') notificationService.expectStops(targets)
      const report =
        action === 'stop'
          ? await terminate(targets, deps)
          : await sendControlSignal(
              targets,
              action === 'pause'
                ? 'SIGSTOP'
                : action === 'resume'
                  ? 'SIGCONT'
                  : action === 'reload'
                    ? 'SIGHUP'
                    : 'SIGTERM',
              deps
            )
      if (action === 'stop' || action === 'group') {
        const stopped = new Set([...report.stopped, ...report.forced])
        report.undoItems = recentlyStoppedService
          .recordStopped(
            processes.filter((proc) => stopped.has(proc.pid)),
            !!settings.persistRecentlyStopped
          )
          .map(({ id, name }) => ({ id, name }))
        notificationService.report(report, settings)
      }
      return { ok: true, data: report }
    }
  )

  handle('project:context', async (_event, { path }: { path: string }) => {
    const settings = settingsService.getSettings()
    const procs = await processProvider.listProcesses({
      userIgnoreList: settings.ignoreList,
      customAllowlist: settings.customAllowlist
    })
    const root = verifyProjectPath(
      path,
      procs.flatMap((proc) => (proc.projectPath ? [proc.projectPath] : []))
    )
    return { ok: true, data: root ? await projectContext(root) : {} }
  })

  handle('docker:stats:start', async (event, { ids }: { ids: string[] }) => {
    const visible = (): boolean => {
      const window = BrowserWindow.fromWebContents(event.sender)
      return !!window && !window.isDestroyed() && window.isVisible()
    }
    return dockerService.startStats(
      ids,
      (id, sample) => {
        if (visible() && !event.sender.isDestroyed())
          event.sender.send('docker:stats', { id, sample })
      },
      visible,
      settingsService.getSettings().dockerSocketPath
    )
  })
  handle('docker:stats:stop', async (_event, { ids }: { ids: string[] }) => {
    dockerService.stopStats(ids)
    return { ok: true, data: null }
  })

  handle('docker:inspect', async (_event, { id }) =>
    dockerService.inspectContainer(id, settingsService.getSettings().dockerSocketPath)
  )
  handle('docker:exec', async (_event, { id }) => {
    const settings = settingsService.getSettings()
    const current = await dockerService.listContainers(settings.dockerSocketPath)
    if (!current.ok || !current.data.some((item) => item.id === id && item.state === 'running'))
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'This container is no longer running.' }
      }
    return openContainerShell(id, settings)
  })

  handle('profiles:list', async () => ({ ok: true, data: await listProfiles() }))
  handle('profiles:save', async (_event, { profile }) => {
    saveProfile(profile)
    return { ok: true, data: null }
  })
  handle('profiles:delete', async (_event, { id }) => {
    settingsService.updateSettings({
      profiles: (settingsService.getSettings().profiles || []).filter((p) => p.id !== id)
    })
    return { ok: true, data: null }
  })
  handle('profiles:fromProject', async (_event, { path }) => profileFromProject(path))
  handle('profiles:action', async (_event, { id, action }) => profileAction(id, action))
  for (const channel of ['repoConfig:read', 'repoConfig:import'])
    handle(channel, async (_event, { path }) => {
      const settings = settingsService.getSettings()
      const procs = await processProvider.listProcesses({
        userIgnoreList: settings.ignoreList,
        customAllowlist: settings.customAllowlist
      })
      const roots = [
        ...procs.flatMap((p) => (p.projectPath ? [p.projectPath] : [])),
        ...(settings.profiles || []).flatMap((p) =>
          p.members.flatMap((m) => (m.cwd ? [m.cwd] : []))
        )
      ]
      const root = verifyProjectPath(path, roots)
      if (!root)
        return {
          ok: false,
          error: { code: 'DENIED', message: 'Choose an active or saved project folder.' }
        }
      return repoConfigRequest(root, channel === 'repoConfig:import')
    })
  handle('ports:reserved', async () => ({
    ok: true,
    data: (settingsService.getSettings().reservedPorts || []).map((r) => ({
      ...r,
      owners: latestPortProcesses
        .filter((p) => p.ports.includes(r.port))
        .map((p) => `${p.name} · ${p.project}`),
      conflict: latestPortProcesses.some((p) => p.ports.includes(r.port) && p.project !== r.project)
    }))
  }))
  handle('ports:reserve', async (_event, value) => {
    const current = settingsService.getSettings().reservedPorts || []
    if (current.length >= 200 && !current.some((p) => p.port === value.port))
      return { ok: false, error: { code: 'DENIED', message: 'Remove an old reservation first.' } }
    settingsService.updateSettings({
      reservedPorts: [...current.filter((p) => p.port !== value.port), value]
    })
    return { ok: true, data: null }
  })
  handle('ports:unreserve', async (_event, { port }) => {
    settingsService.updateSettings({
      reservedPorts: (settingsService.getSettings().reservedPorts || []).filter(
        (p) => p.port !== port
      )
    })
    return { ok: true, data: null }
  })
  handle('launch:start', async (_event, { member }) => {
    const answer = await dialog.showMessageBox({
      type: 'question',
      message: `Start ${member.name}?`,
      detail: `Review this exact command before running it.\n\n${member.cwd}\n${member.command}`,
      buttons: ['Cancel', 'Start'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (answer.response !== 1)
      return { ok: false, error: { code: 'DENIED', message: 'Launch cancelled.' } }
    return launchMember(member)
  })
  handle('launch:list', async () => ({
    ok: true,
    data: [...launches.values()].map(({ id, name, pid }) => ({ id, name, pid }))
  }))
  handle('launch:logs', async (_event, { id }) => {
    const item = launches.get(id)
    return item
      ? { ok: true, data: item.log.read() }
      : {
          ok: false,
          error: { code: 'NOT_FOUND', message: 'No captured output exists for this launch.' }
        }
  })
  handle('launch:clear', async (_event, { id }) => {
    launches.get(id)?.log.clear()
    return { ok: true, data: null }
  })
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

  handle('docker:apps', async () => ({ ok: true, data: detectDockerApps() }))
  handle('docker:launch', async (_event, { app }: { app: 'desktop' | 'orbstack' }) => {
    const detected = detectDockerApps().find((candidate) => candidate.id === app)
    if (!detected)
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'This Docker provider is not installed.' }
      }
    const error = await shell.openPath(detected.path)
    return error
      ? { ok: false, error: { code: 'INTERNAL', message: 'Could not open this Docker provider.' } }
      : { ok: true, data: null }
  })
  handle('docker:remove', async (_event, { id }: { id: string }) =>
    dockerService.removeContainer(id, settingsService.getSettings().dockerSocketPath)
  )
  handle(
    'docker:composeAction',
    async (
      _event,
      input: { project: string; action: 'start' | 'stop' | 'restart'; ids: string[] }
    ) =>
      dockerService.composeAction(
        input.project,
        input.action,
        input.ids,
        settingsService.getSettings().dockerSocketPath
      )
  )

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
