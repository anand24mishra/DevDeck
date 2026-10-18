import { detectTunnel } from '../services/tunnels'
import fs from 'fs'
import { leftoverHint } from '../services/leftovers'
import { execFile } from 'child_process'
import os from 'os'
import { promisify } from 'util'
import { Proc, PortOwner, ListeningSocket } from '../../shared/types'
import {
  isProcessAllowed,
  extractBinaryName,
  FilterProcessOptions,
  protectedProcessTree,
  ProcessContext
} from '../security/allowlist'
import { labelProcess } from '../services/labeler'
import { parseOpenFiles, type OpenFileSnapshot } from '../services/ports'
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
  startTime: string
  pgid: number
  status: string
  pid: number
  ppid: number
  cpu: number
  rssKB: number
  etime: string
  command: string
}

export class DarwinProcessProvider implements ProcessProvider {
  private previousParents = new Map<number, { ppid: number; startTime: string }>()
  constructor(private readonly self: ProcessContext = { pid: process.pid, ppid: process.ppid }) {}

  /**
   * Fetches raw processes for the current user using macOS ps command.
   */
  private async getRawProcesses(): Promise<RawProcess[]> {
    const user = os.userInfo().username
    const { stdout } = await execFileAsync(
      'ps',
      ['-U', user, '-o', 'pid=,ppid=,pgid=,stat=,pcpu=,rss=,etime=,lstart=,command='],
      { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
    )

    const lines = stdout.split('\n')
    const processes: RawProcess[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Match pid, ppid, pcpu, rss, etime, followed by the rest of the line as command
      const match = trimmed.match(
        /^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+([\d:-]+)\s+(.{24})\s+(.+)$/
      )
      if (match) {
        processes.push({
          pid: parseInt(match[1], 10),
          ppid: parseInt(match[2], 10),
          pgid: Number(match[3]),
          status: match[4],
          cpu: parseFloat(match[5]) || 0,
          rssKB: parseInt(match[6], 10) || 0,
          etime: match[7],
          startTime: match[8].trim(),
          command: match[9]
        })
      }
    }

    return processes
  }

  private async getOpenFiles(): Promise<OpenFileSnapshot> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-nP', '-FpcuftnPT'], {
        timeout: 5000,
        maxBuffer: 32 * 1024 * 1024
      })
      return parseOpenFiles(stdout)
    } catch (error) {
      return parseOpenFiles((error as { stdout?: string }).stdout || '')
    }
  }

  /**
   * Lists and enriches all allowlisted processes.
   */
  public async listProcesses(options: FilterProcessOptions = {}): Promise<Proc[]> {
    return (await this.scan(options)).processes
  }

  public async lookupPort(port: number, options: FilterProcessOptions = {}): Promise<PortOwner[]> {
    const snapshot = await this.scan(options)
    const owners = new Map(snapshot.processes.map((proc) => [proc.pid, proc]))
    return [...snapshot.listeners.values()]
      .flat()
      .filter((socket) => socket.port === port)
      .map((socket) => ({ ...socket, process: owners.get(socket.pid) || null }))
  }

  private async scan(
    options: FilterProcessOptions
  ): Promise<{ processes: Proc[]; listeners: Map<number, ListeningSocket[]> }> {
    const rawProcesses = await this.getRawProcesses()
    const currentPid = this.self.pid
    const protectedPids = protectedProcessTree(rawProcesses, this.self)

    // 1. Filter raw processes with safety allowlist
    const filtered = rawProcesses.filter((proc) => {
      const zombie = proc.status.includes('Z')
      const displayCommand = zombie
        ? proc.command.replace(/^\(([^)]+)\)$/, '$1').replace(/ <defunct>$/, '')
        : proc.command
      const check = isProcessAllowed(proc.pid, displayCommand, {
        currentPid,
        parentPid: this.self.ppid,
        protectedPids,
        userIgnoreList: options.userIgnoreList,
        customAllowlist: options.customAllowlist
      })
      return check.allowed
    })

    const openFiles = await this.getOpenFiles()
    const portsMap = openFiles.listeners
    const cwdMap = openFiles.cwds

    // 3. Assemble complete Proc structures
    const result: Proc[] = filtered.map((proc) => {
      const { binaryName } = extractBinaryName(proc.command)
      const cwd = cwdMap.get(proc.pid) || null
      const project = resolveProjectFromCwd(cwd)
      const sockets = openFiles.sockets.get(proc.pid) || []
      const ports = [...new Set((portsMap.get(proc.pid) || []).map((socket) => socket.port))]

      const status = proc.status.includes('T')
        ? ('paused' as const)
        : proc.status.includes('Z')
          ? ('zombie' as const)
          : ('running' as const)
      const tunnel = detectTunnel(proc.command)
      const hint = leftoverHint(
        { ppid: proc.ppid, startTime: proc.startTime, status, cwd },
        this.previousParents.get(proc.pid),
        !!cwd && fs.existsSync(cwd)
      )
      return {
        pid: proc.pid,
        startTime: proc.startTime,
        user: os.userInfo().username,
        parentName:
          extractBinaryName(rawProcesses.find((parent) => parent.pid === proc.ppid)?.command || '')
            .binaryName || 'Unavailable',
        ppid: proc.ppid,
        pgid: proc.pgid,
        status,
        manageable: status !== 'zombie',
        readOnlyReason:
          status === 'zombie'
            ? 'Waiting for parent cleanup; signals cannot remove a zombie.'
            : undefined,
        leftoverReason: hint,
        name:
          tunnel?.kind === 'ssh'
            ? 'SSH tunnel'
            : tunnel?.kind === 'kubectl'
              ? 'Kubernetes port forward'
              : tunnel?.kind === 'tailscale'
                ? 'Tailscale funnel'
                : labelProcess(binaryName || 'unknown', proc.command, project.root),
        tunnel,
        command: proc.command,
        cpu: proc.cpu,
        memMB: Math.round(proc.rssKB / 1024),
        uptimeSec: parseEtime(proc.etime),
        cwd,
        project: project.name,
        projectPath: project.root,
        ports: ports.sort((a, b) => a - b),
        sockets,
        establishedConnections: openFiles.connections.get(proc.pid) || 0,
        openFilesCount: openFiles.files.get(proc.pid) || 0,
        idleHint:
          options.hintsEnabled !== false &&
          ports.length > 0 &&
          parseEtime(proc.etime) >= 3 * 86400 &&
          !openFiles.connections.get(proc.pid)
            ? `Running ${Math.floor(parseEtime(proc.etime) / 86400)} days, no active connections seen`
            : undefined
      }
    })

    this.previousParents = new Map(
      rawProcesses.map((proc) => [proc.pid, { ppid: proc.ppid, startTime: proc.startTime }])
    )

    // Sort by project name, then by port, then by process name
    result.sort((a, b) => {
      if (a.project !== b.project) {
        return a.project.localeCompare(b.project)
      }
      if (a.ports.length > 0 && b.ports.length > 0) {
        return a.ports[0] - b.ports[0]
      }
      return a.name.localeCompare(b.name)
    })
    return { processes: result, listeners: portsMap }
  }
}
