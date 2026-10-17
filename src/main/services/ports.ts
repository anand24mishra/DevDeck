import type { ListeningSocket, PortOwner, Container } from '../../shared/types'

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
    explanation: `Port ${owner.port} is used by ${descriptions[kind]}.`
  }
}
