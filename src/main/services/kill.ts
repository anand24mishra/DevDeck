import { execFile } from 'child_process'
import os from 'os'
import { promisify } from 'util'
import { KillReport } from '../../shared/types'
import { isProcessAllowed } from '../security/allowlist'
import { settingsService } from './settings'

const execFileAsync = promisify(execFile)

export interface RevalidatedProcess {
  pid: number
  startTime?: string
  command: string
}

export interface KillDeps {
  revalidate: (pids: number[]) => Promise<{ ok: RevalidatedProcess[]; refused: number[] }>
  signal: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => boolean
  alive: (pid: number) => boolean
  sleep: (ms: number) => Promise<void>
}

/**
 * Pure termination escalation flow. Injectable dependencies for unit testing with fake timers.
 */
export async function terminate(pids: number[], deps: KillDeps): Promise<KillReport> {
  const uniquePids = Array.from(new Set(pids)).filter((p) => Number.isInteger(p) && p > 1)
  if (uniquePids.length === 0) {
    return { requested: pids, stopped: [], forced: [], refused: pids, stillRunning: [] }
  }

  // 1. Re-validate targets against safety allowlist and identity
  const { ok, refused } = await deps.revalidate(uniquePids)

  // 2. Send SIGTERM to all valid processes
  ok.forEach((p) => deps.signal(p.pid, 'SIGTERM'))

  // 3. Grace period (3s)
  await deps.sleep(3000)

  // 4. Send SIGKILL to remaining survivors
  const survivors = ok.filter((p) => deps.alive(p.pid))
  survivors.forEach((p) => deps.signal(p.pid, 'SIGKILL'))

  // 5. Short post-kill settle (300ms)
  await deps.sleep(300)

  // 6. Final accounting
  const stillRunning = survivors.filter((p) => deps.alive(p.pid)).map((p) => p.pid)
  const forced = survivors.map((p) => p.pid).filter((pid) => !stillRunning.includes(pid))
  const stopped = ok.map((p) => p.pid).filter((pid) => !survivors.some((s) => s.pid === pid))

  return {
    requested: pids,
    stopped,
    forced,
    refused,
    stillRunning
  }
}

/**
 * Real production implementation of KillDeps for macOS.
 */
export const defaultKillDeps: KillDeps = {
  signal: (pid: number, signal: 'SIGTERM' | 'SIGKILL'): boolean => {
    try {
      process.kill(pid, signal)
      return true
    } catch {
      return false
    }
  },

  alive: (pid: number): boolean => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  },

  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),

  revalidate: async (pids: number[]): Promise<{ ok: RevalidatedProcess[]; refused: number[] }> => {
    const ok: RevalidatedProcess[] = []
    const refused: number[] = []
    const settings = settingsService.getSettings()
    const currentPid = process.pid
    const targetSet = new Set(pids)

    if (pids.length === 0) {
      return { ok, refused }
    }

    try {
      const currentUser = os.userInfo().username
      const { stdout } = await execFileAsync('ps', [
        '-o',
        'pid=,user=,lstart=,command=',
        '-p',
        pids.join(',')
      ])

      const lines = stdout.split('\n')
      const foundPids = new Set<number>()

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Match pid, user, lstart (24 chars), command
        const match = trimmed.match(/^(\d+)\s+(\S+)\s+([A-Za-z0-9:\s]{24})\s+(.+)$/)
        if (!match) continue

        const pid = parseInt(match[1], 10)
        if (!targetSet.has(pid)) continue

        const procUser = match[2]
        const startTime = match[3].trim()
        const command = match[4].trim()
        foundPids.add(pid)

        // Only allow killing processes owned by the current user
        if (procUser !== currentUser) {
          refused.push(pid)
          continue
        }

        const check = isProcessAllowed(pid, command, {
          currentPid,
          userIgnoreList: settings.ignoreList,
          customAllowlist: settings.customAllowlist
        })

        if (check.allowed) {
          ok.push({ pid, startTime, command })
        } else {
          refused.push(pid)
        }
      }

      // Any pid requested that wasn't found in ps is refused/gone
      for (const reqPid of pids) {
        if (!foundPids.has(reqPid) && !refused.includes(reqPid)) {
          refused.push(reqPid)
        }
      }
    } catch {
      // If ps fails, refuse all requested pids for safety
      return { ok: [], refused: [...pids] }
    }

    return { ok, refused }
  }
}
