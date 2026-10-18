import fs from 'fs/promises'
import { randomUUID } from 'crypto'
import { defaultKillDeps } from './kill'
import { constants } from 'fs'
import path from 'path'
import { utilityProcess } from 'electron'
import { parseCommandLine } from '../utils/command'
import { isProcessAllowed } from '../security/allowlist'
import { settingsService } from './settings'
import type { ProfileMember, Result, ProcessIdentity } from '../../shared/types'
export interface LaunchedProcess {
  id: string
  name: string
  pid: number
  cwd: string
  lines: string[]
  partial: string
  command: string
  identity?: ProcessIdentity
  startedAt: number
}
export const launches = new Map<string, LaunchedProcess>()
export async function launchMember(
  member: ProfileMember
): Promise<Result<{ pid: number; id: string }>> {
  if (!member.command || !member.cwd)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'A command and project folder are required.' }
    }
  const settings = settingsService.getSettings()
  if (
    !isProcessAllowed(2, member.command, {
      userIgnoreList: settings.ignoreList,
      customAllowlist: settings.customAllowlist
    }).allowed
  )
    return {
      ok: false,
      error: { code: 'DENIED', message: 'This command is outside your executable allowlist.' }
    }
  let cwd: string
  try {
    cwd = await fs.realpath(member.cwd)
    if (
      !cwd.startsWith('/') ||
      ['/System', '/usr', '/bin', '/sbin', '/Library'].some(
        (root) => cwd === root || cwd.startsWith(root + '/')
      ) ||
      !(await fs.stat(cwd)).isDirectory()
    )
      throw new Error()
    const markers = await Promise.all(
      ['.git', 'package.json', 'go.mod', 'Cargo.toml', 'pyproject.toml', '.devdeck.json'].map(
        (name) =>
          fs.access(path.join(cwd, name)).then(
            () => true,
            () => false
          )
      )
    )
    if (!markers.some(Boolean)) throw new Error()
  } catch {
    return {
      ok: false,
      error: { code: 'DENIED', message: 'Choose an existing project folder with a project file.' }
    }
  }
  const parsed = parseCommandLine(member.command)
  let file: string | undefined
  for (const candidate of path.isAbsolute(parsed.executable)
    ? [parsed.executable]
    : (process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin')
        .split(path.delimiter)
        .filter((p) => path.isAbsolute(p))
        .map((p) => path.join(p, parsed.executable))) {
    try {
      await fs.access(candidate, constants.X_OK)
      const real = await fs.realpath(candidate)
      if ((await fs.stat(real)).isFile()) {
        file = candidate
        break
      }
    } catch {
      /* Try next executable. */
    }
  }
  if (!file)
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The executable was not found. Use its full path in the profile.'
      }
    }
  if (launches.size >= 200)
    return {
      ok: false,
      error: { code: 'DENIED', message: 'Clear old launch logs before starting more processes.' }
    }
  return new Promise((resolve) => {
    const worker = utilityProcess.fork(path.join(__dirname, 'launch-worker.js'), [], {
      stdio: 'pipe',
      serviceName: 'DevDeck launcher'
    })
    let pid = 0,
      settled = false
    const id = randomUUID()
    const entry: LaunchedProcess = {
      id,
      name: member.name,
      pid: 0,
      cwd,
      lines: [],
      partial: '',
      command: member.command!,
      startedAt: Date.now()
    }
    const append = (chunk: Buffer): void => {
      const text = (entry.partial + chunk.toString()).slice(-1048576)
      const lines = text.split('\n')
      entry.partial = (lines.pop() || '').slice(-16384)
      entry.lines.push(...lines.map((line) => line.slice(0, 16384)))
      if (entry.lines.length > 5000) entry.lines.splice(0, entry.lines.length - 5000)
    }
    worker.stdout?.on('data', append)
    worker.stderr?.on('data', append)
    worker.on('message', (message) => {
      if (Number.isSafeInteger(message.pid) && message.pid > 1) {
        pid = message.pid
        entry.pid = pid
      }
    })
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        worker.kill()
        resolve({
          ok: false,
          error: { code: 'INTERNAL', message: 'The launcher did not respond.' }
        })
      }
    }, 5000)
    worker.once('exit', async (code) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      if (code === 0 && pid) {
        entry.identity = (await defaultKillDeps.revalidate([pid])).ok.find((p) => p.pid === pid)
        launches.set(id, entry)
        resolve({ ok: true, data: { pid, id } })
      } else
        resolve({
          ok: false,
          error: { code: 'INTERNAL', message: 'The process could not be started.' }
        })
    })
    worker.postMessage({ file, args: parsed.args, cwd, env: { ...process.env } })
  })
}
