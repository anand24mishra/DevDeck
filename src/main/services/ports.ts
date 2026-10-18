import { detectTunnel } from './tunnels'
import type { ListeningSocket, PortOwner, Container, Proc } from '../../shared/types'

export function parseListeners(output: string): Map<number, ListeningSocket[]> {
  const listeners = new Map<number, ListeningSocket[]>()
  let pid = 0
  let name = ''
  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      pid = Number(line.slice(1))
      name = ''
    }
    if (line.startsWith('c')) name = line.slice(1)
    if (!line.startsWith('n') || line.includes('->') || pid <= 1) continue
    const match = line.slice(1).match(/^(.*):(\d+)$/)
    if (!match) continue
    const port = Number(match[2])
    if (port < 1 || port > 65535) continue
    const socket = { pid, name, port, address: match[1].replace(/^\[|\]$/g, '') }
    const entries = listeners.get(pid) || []
    if (!entries.some((entry) => entry.port === port && entry.address === socket.address))
      entries.push(socket)
    listeners.set(pid, entries)
  }
  return listeners
}

export function explainPortOwner(
  owner: PortOwner,
  containers: Container[],
  project?: string
): PortOwner {
  const container = containers.find(
    (item) => item.state === 'running' && item.ports.includes(owner.port)
  )
  if (container)
    return {
      ...owner,
      kind: 'docker',
      containerId: container.id,
      suggestedAction: 'stop-container',
      explanation: `Port ${owner.port} is used by Docker container ${container.name} (${container.image}).`
    }
  const command = owner.process?.command || owner.name
  const kind = /(?:^|\/)ssh\b.*\s-[LRD]/.test(command)
    ? 'ssh'
    : /\bkubectl\b.*\bport-forward\b/.test(command)
      ? 'kubectl'
      : /\b(?:ngrok|cloudflared|tailscale)\b/.test(command)
        ? 'tunnel'
        : !owner.process
          ? 'readonly'
          : project && owner.process.project !== project
            ? 'other-project'
            : 'project'
  const descriptions = {
    ssh: 'an SSH tunnel',
    kubectl: 'a Kubernetes port forward',
    tunnel: 'a network tunnel',
    readonly: `${owner.name || 'a protected process'} (read-only)`,
    'other-project': `another project, ${owner.process?.project}`,
    project: `${owner.process?.name} in ${owner.process?.project}`
  }
  return {
    ...owner,
    kind,
    suggestedAction: owner.process ? 'stop-process' : 'none',
    explanation: `Port ${owner.port} is used by ${descriptions[kind]}${detectTunnel(command)?.target ? `, forwarding to ${detectTunnel(command)!.target}` : ''}.`
  }
}

export interface OpenFileSnapshot {
  listeners: Map<number, ListeningSocket[]>
  sockets: Map<number, ListeningSocket[]>
  cwds: Map<number, string>
  connections: Map<number, number>
  files: Map<number, number>
  users: Map<number, string>
}
export function parseOpenFiles(output: string): OpenFileSnapshot {
  const result: OpenFileSnapshot = {
    listeners: new Map(),
    sockets: new Map(),
    cwds: new Map(),
    connections: new Map(),
    files: new Map(),
    users: new Map()
  }
  let pid = 0,
    name = '',
    fd = '',
    address = '',
    protocol = '',
    family = '',
    state = ''
  const flush = (): void => {
    if (pid <= 1 || !fd) return
    if (fd === 'cwd' && address) result.cwds.set(pid, address)
    if (/^\d/.test(fd)) result.files.set(pid, (result.files.get(pid) || 0) + 1)
    if (state === 'ESTABLISHED') result.connections.set(pid, (result.connections.get(pid) || 0) + 1)
    const local = address.split('->')[0].match(/^(.*):(\d+)$/)
    if (
      !local ||
      !['TCP', 'UDP'].includes(protocol) ||
      (protocol === 'TCP' && !['LISTEN', 'ESTABLISHED'].includes(state))
    )
      return
    const socket: ListeningSocket = {
      pid,
      name,
      port: Number(local[2]),
      address: local[1].replace(/^\[|\]$/g, ''),
      protocol: protocol as 'TCP' | 'UDP',
      family: family === 'IPv6' ? 'IPv6' : 'IPv4',
      state: state === 'ESTABLISHED' ? 'ESTABLISHED' : 'LISTEN'
    }
    const sockets = result.sockets.get(pid) || []
    sockets.push(socket)
    result.sockets.set(pid, sockets)
    if (socket.state === 'LISTEN') {
      const listeners = result.listeners.get(pid) || []
      if (
        !listeners.some(
          (entry) =>
            entry.port === socket.port &&
            entry.address === socket.address &&
            entry.protocol === socket.protocol
        )
      )
        listeners.push(socket)
      result.listeners.set(pid, listeners)
    }
  }
  for (const line of output.split('\n')) {
    const value = line.slice(1)
    switch (line[0]) {
      case 'p':
        flush()
        pid = Number(value)
        name = ''
        fd = ''
        break
      case 'c':
        name = value
        break
      case 'u':
        result.users.set(pid, value)
        break
      case 'f':
        flush()
        fd = value
        address = ''
        protocol = ''
        family = ''
        state = ''
        break
      case 'n':
        address = value
        break
      case 'P':
        protocol = value
        break
      case 't':
        family = value
        break
      case 'T':
        if (value.startsWith('ST=')) state = value.slice(3)
        break
    }
  }
  flush()
  return result
}

export function readOnlyPortProcesses(
  snapshot: OpenFileSnapshot,
  currentUid: string,
  excluded: ReadonlySet<number>,
  ignores: string[] = []
): Proc[] {
  return [...snapshot.listeners].flatMap(([pid, sockets]) => {
    const name = sockets[0]?.name || 'Unknown process'
    if (
      excluded.has(pid) ||
      ignores.some((ignore) => ignore && name.toLowerCase().includes(ignore.toLowerCase()))
    )
      return []
    return [
      {
        pid,
        ppid: 0,
        startTime: '',
        command: '',
        name,
        cpu: 0,
        memMB: 0,
        uptimeSec: 0,
        cwd: null,
        project: 'Read-only ports',
        projectPath: null,
        ports: [...new Set(sockets.map((socket) => socket.port))],
        sockets,
        manageable: false,
        readOnlyReason:
          snapshot.users.get(pid) === currentUid
            ? 'Protected by DevDeck or outside your executable allowlist.'
            : 'Owned by another user or the system.'
      }
    ]
  })
}
