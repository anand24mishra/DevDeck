import { dialog } from 'electron'
import type { CliRequest } from './cliServer'
import { DarwinProcessProvider } from '../providers/process.darwin'
import { settingsService } from './settings'
import { terminate, defaultKillDeps } from './kill'
import { notificationService } from './notifications'
import { recentlyStoppedService } from './recentlyStopped'
import { launches } from './launcher'
const provider = new DarwinProcessProvider()
let stopping = false
export async function cliCommand(request: CliRequest): Promise<unknown> {
  if (request.command === 'logs') {
    const matches = [...launches.values()].filter(
      (l) =>
        l.name === request.args[0] || String(l.pid) === request.args[0] || l.id === request.args[0]
    )
    if (matches.length !== 1)
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: matches.length
            ? 'Several launches have that name. Use a PID or launch ID.'
            : 'No captured logs for this process. Start it through DevDeck first.'
        }
      }
    return { ok: true, data: matches[0].log.read() }
  }
  const settings = settingsService.getSettings(),
    options = {
      userIgnoreList: settings.ignoreList,
      customAllowlist: settings.customAllowlist,
      hintsEnabled: settings.hintsEnabled
    }
  if (request.command === 'port')
    return {
      ok: true,
      data: (await provider.lookupPort(Number(request.args[0]), options)).map((o) => ({
        pid: o.pid,
        name: o.name,
        port: o.port,
        address: o.address,
        manageable: !!o.process && o.process.manageable !== false,
        explanation: o.explanation
      }))
    }
  const procs = await provider.listProcesses(options)
  if (request.command === 'ls')
    return {
      ok: true,
      data: procs.map((p) => ({
        pid: p.pid,
        name: p.name,
        project: p.project,
        ports: p.ports,
        cpu: p.cpu,
        memMB: p.memMB,
        command: '[hidden]'
      }))
    }
  if (stopping)
    return { ok: false, error: { code: 'DENIED', message: 'Another CLI stop is still running.' } }
  stopping = true
  try {
    const [prefix, last] = request.args[0].includes(':')
        ? request.args[0].split(':')
        : ['', request.args[0]],
      number = Number(last)
    const onPort = procs.filter((p) => p.ports.includes(number)),
      targets = (
        prefix === 'pid'
          ? procs.filter((p) => p.pid === number)
          : prefix === 'port'
            ? onPort
            : onPort.length
              ? onPort
              : procs.filter((p) => p.pid === number)
      ).filter((p) => p.manageable !== false)
    if (!targets.length)
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'No manageable process matches this target.' }
      }
    if (!request.yes) {
      const result = await dialog.showMessageBox({
        type: 'warning',
        message: `Stop ${targets.length} process(es) requested by the CLI?`,
        detail: targets.map((p) => `${p.name} · ${p.project} · PID ${p.pid}`).join('\n'),
        buttons: ['Cancel', 'Stop'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      if (result.response !== 1)
        return {
          ok: true,
          data: { cancelled: true, stopped: [], forced: [], refused: [], stillRunning: [] }
        }
    }
    notificationService.expectStops(targets)
    const report = await terminate(targets, defaultKillDeps)
    notificationService.report(report, settings)
    const stopped = new Set([...report.stopped, ...report.forced])
    recentlyStoppedService.recordStopped(
      targets.filter((p) => stopped.has(p.pid)),
      !!settings.persistRecentlyStopped
    )
    return { ok: true, data: report }
  } finally {
    stopping = false
  }
}
