import type { ListeningSocket } from '../../shared/types'

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
