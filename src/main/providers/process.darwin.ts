import { execFile } from 'child_process'
import os from 'os'
import { promisify } from 'util'
import { Proc } from '../../shared/types'
import { isProcessAllowed, extractBinaryName, FilterProcessOptions } from '../security/allowlist'
import { resolveProjectFromCwd } from '../services/project'

const execFileAsync = promisify(execFile)

export interface ProcessProvider {
  listProcesses(options?: FilterProcessOptions): Promise<Proc[]>
}

export function parseEtime(etime: string): number {
  const trimmed = etime.trim()
  if (!trimmed) return 0

  let days = 0
  let timeStr = trimmed

  if (trimmed.includes('-')) {
    const parts = trimmed.split('-')
    days = parseInt(parts[0], 10) || 0
    timeStr = parts[1] || ''
  }

  const timeParts = timeStr.split(':').map((p) => parseInt(p, 10) || 0)
  if (timeParts.length === 3) {
    return days * 86400 + timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]
  } else if (timeParts.length === 2) {
    return days * 86400 + timeParts[0] * 60 + timeParts[1]
  } else if (timeParts.length === 1) {
    return days * 86400 + timeParts[0]
  }
  return 0
}

interface RawProcess {
  pid: number
  ppid: number
  cpu: number
  rssKB: number
  etime: string
  command: string
}

export class DarwinProcessProvider implements ProcessProvider {
  /**
   * Fetches raw processes for the current user using macOS ps command.
   */
  private async getRawProcesses(): Promise<RawProcess[]> {
    const user = os.userInfo().username
    const { stdout } = await execFileAsync(
      'ps',
      ['-U', user, '-o', 'pid=,ppid=,pcpu=,rss=,etime=,command='],
      { maxBuffer: 10 * 1024 * 1024 }
    )

    const lines = stdout.split('\n')
    const processes: RawProcess[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Match pid, ppid, pcpu, rss, etime, followed by the rest of the line as command
      const match = trimmed.match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+([\d:-]+)\s+(.+)$/)
      if (match) {
        processes.push({
          pid: parseInt(match[1], 10),
          ppid: parseInt(match[2], 10),
          cpu: parseFloat(match[3]) || 0,
          rssKB: parseInt(match[4], 10) || 0,
          etime: match[5],
          command: match[6]
        })
      }
    }

    return processes
  }

  /**
   * Finds listening TCP ports and associates them with PIDs.
   */
  private async getListeningPorts(): Promise<Map<number, number[]>> {
    const portsMap = new Map<number, number[]>()
    try {
      const { stdout } = await execFileAsync('lsof', ['-iTCP', '-sTCP:LISTEN', '-nP', '-Fpn'])
      const lines = stdout.split('\n')
      let currentPid: number | null = null

      for (const line of lines) {
        if (line.startsWith('p')) {
          currentPid = parseInt(line.slice(1), 10)
        } else if (line.startsWith('n') && currentPid !== null) {
          const match = line.match(/:(\d+)$/)
          if (match) {
            const port = parseInt(match[1], 10)
            const list = portsMap.get(currentPid) || []
            if (!list.includes(port)) {
              list.push(port)
              portsMap.set(currentPid, list)
            }
          }
        }
      }
    } catch {
      // lsof may exit with code 1 if no matching connections exist
    }

    return portsMap
  }

  /**
   * Retrieves working directory for a batch of PIDs using lsof.
   */
  private async getCwds(pids: number[]): Promise<Map<number, string>> {
    const cwdMap = new Map<number, string>()
    if (pids.length === 0) return cwdMap

    try {
      const { stdout } = await execFileAsync('lsof', [
        '-a',
        '-d',
        'cwd',
        '-Fpn',
        '-p',
        pids.join(',')
      ])
      const lines = stdout.split('\n')
      let currentPid: number | null = null

      for (const line of lines) {
        if (line.startsWith('p')) {
          currentPid = parseInt(line.slice(1), 10)
        } else if (line.startsWith('n') && currentPid !== null) {
          cwdMap.set(currentPid, line.slice(1))
        }
      }
    } catch {
      // lsof exits non-zero if some processes have disappeared
    }

    return cwdMap
  }

  /**
   * Lists and enriches all allowlisted processes.
   */
  public async listProcesses(options: FilterProcessOptions = {}): Promise<Proc[]> {
    const rawProcesses = await this.getRawProcesses()
    const currentPid = process.pid

    // 1. Filter raw processes with safety allowlist
    const filtered = rawProcesses.filter((proc) => {
      const check = isProcessAllowed(proc.pid, proc.command, {
        currentPid,
        userIgnoreList: options.userIgnoreList,
        customAllowlist: options.customAllowlist
      })
      return check.allowed
    })

    if (filtered.length === 0) {
      return []
    }

    const pids = filtered.map((p) => p.pid)

    // 2. Fetch ports and cwds in parallel
    const [portsMap, cwdMap] = await Promise.all([this.getListeningPorts(), this.getCwds(pids)])

    // 3. Assemble complete Proc structures
    const result: Proc[] = filtered.map((proc) => {
      const { binaryName } = extractBinaryName(proc.command)
      const cwd = cwdMap.get(proc.pid) || null
      const project = resolveProjectFromCwd(cwd)
      const ports = portsMap.get(proc.pid) || []

      return {
        pid: proc.pid,
        ppid: proc.ppid,
        name: binaryName || 'unknown',
        command: proc.command,
        cpu: proc.cpu,
        memMB: Math.round(proc.rssKB / 1024),
        uptimeSec: parseEtime(proc.etime),
        cwd,
        project: project.name,
        projectPath: project.root,
        ports: ports.sort((a, b) => a - b)
      }
    })

    // Sort by project name, then by port, then by process name
    return result.sort((a, b) => {
      if (a.project !== b.project) {
        return a.project.localeCompare(b.project)
      }
      if (a.ports.length > 0 && b.ports.length > 0) {
        return a.ports[0] - b.ports[0]
      }
      return a.name.localeCompare(b.name)
    })
  }
}
