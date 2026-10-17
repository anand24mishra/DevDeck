import { execFile } from 'child_process'
import os from 'os'
import { promisify } from 'util'
import { KillReport, ProcessIdentity } from '../../shared/types'
import { isProcessAllowed, protectedProcessTree, ProcessContext } from '../security/allowlist'
import { settingsService } from './settings'

const execFileAsync = promisify(execFile)

export type RevalidatedProcess = ProcessIdentity

export interface KillDeps {
  revalidate: (pids: number[]) => Promise<{ ok: RevalidatedProcess[]; refused: number[] }>
  signal: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => boolean
  alive: (pid: number) => boolean
  sleep: (ms: number) => Promise<void>
}

/**
 * Pure termination escalation flow with PID-reuse protection.
 * Injectable dependencies for unit testing with fake timers.
 */
export function validIdentities(value: unknown): value is ProcessIdentity[] {
  if (!Array.isArray(value) || value.length > 500) return false
  const seen = new Set<number>()
  return value.every((target) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) return false
    if (Object.keys(target).sort().join(',') !== 'command,pid,startTime') return false
    const valid =
      Number.isSafeInteger(target.pid) &&
      target.pid > 1 &&
      !seen.has(target.pid) &&
      typeof target.startTime === 'string' &&
      target.startTime.length > 0 &&
      target.startTime.length <= 64 &&
      typeof target.command === 'string' &&
      target.command.length > 0 &&
      target.command.length <= 131072
    seen.add(target.pid)
    return valid
  })
}

export async function terminate(targets: ProcessIdentity[], deps: KillDeps): Promise<KillReport> {
  const report: KillReport = {
    requested: targets.map((target) => target.pid),
    stopped: [],
    forced: [],
    refused: [],
    stillRunning: [],
    refusalReasons: {}
  }
  const refuse = (pid: number, reason: 'identity-changed' | 'not-allowed'): void => {
    if (!report.refused.includes(pid)) report.refused.push(pid)
    report.refusalReasons![pid] = reason
  }
  const verify = async (target: ProcessIdentity): Promise<boolean> => {
    const current = await deps.revalidate([target.pid])
    const actual = current.ok.find((candidate) => candidate.pid === target.pid)
    if (!actual) {
      refuse(target.pid, 'not-allowed')
      return false
    }
    if (
      !target.startTime ||
      actual.startTime !== target.startTime ||
      actual.command !== target.command
    ) {
      refuse(target.pid, 'identity-changed')
      return false
    }
    return true
  }
  const signaled: ProcessIdentity[] = []
  for (const target of targets) {
    if (report.requested.indexOf(target.pid) !== targets.indexOf(target)) continue
    if (await verify(target)) {
      if (deps.signal(target.pid, 'SIGTERM')) signaled.push(target)
      else report.stillRunning.push(target.pid)
    }
  }
  if (!signaled.length) return report
  await deps.sleep(3000)
  const forced: ProcessIdentity[] = []
  for (const target of signaled) {
    if (!deps.alive(target.pid)) {
      report.stopped.push(target.pid)
      continue
    }
    if (await verify(target)) {
      if (deps.signal(target.pid, 'SIGKILL')) forced.push(target)
      else report.stillRunning.push(target.pid)
    }
  }
  if (forced.length) await deps.sleep(300)
  for (const target of forced) {
    if (deps.alive(target.pid)) report.stillRunning.push(target.pid)
    else report.forced.push(target.pid)
  }
  return report
}

/**
 * Real production implementation of KillDeps for macOS.
 */
export function createKillDeps(
  self: ProcessContext = { pid: process.pid, ppid: process.ppid }
): KillDeps {
  return {
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

    revalidate: async (
      pids: number[]
    ): Promise<{ ok: RevalidatedProcess[]; refused: number[] }> => {
      const ok: RevalidatedProcess[] = []
      const refused: number[] = []
      const settings = settingsService.getSettings()
      const currentPid = self.pid
      const targetSet = new Set(pids)

      if (pids.length === 0) {
        return { ok, refused }
      }

      try {
        const currentUser = os.userInfo().username
        const { stdout } = await execFileAsync(
          'ps',
          ['-U', currentUser, '-o', 'pid=,ppid=,user=,lstart=,command='],
          { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
        )

        const lines = stdout.split('\n')
        const treeRows = lines.flatMap((line) => {
          const match = line.trim().match(/^(\d+)\s+(\d+)\s+/)
          return match ? [{ pid: Number(match[1]), ppid: Number(match[2]) }] : []
        })
        if (!treeRows.some((row) => row.pid === self.pid) && self.pid > 1) {
          return { ok: [], refused: [...pids] }
        }
        const protectedPids = protectedProcessTree(treeRows, self)
        const foundPids = new Set<number>()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          // Match pid, user, lstart (24 chars), command
          const match = trimmed.match(/^(\d+)\s+\d+\s+(\S+)\s+([A-Za-z0-9:\s]{24})\s+(.+)$/)
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
            parentPid: self.ppid,
            protectedPids,
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
}

export const defaultKillDeps = createKillDeps()
