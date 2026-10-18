import type { Proc, Container } from './types'
const clean = (text: string): string =>
  [...text]
    .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join('')
    .slice(0, 200)
export interface Diagnostics {
  appVersion: string
  electronVersion: string
  macOS: string
  architecture: string
  dockerProvider: string
  processCount: number
  containerCount: number
}
export function exportPreview(
  kind: 'snapshot' | 'diagnostics',
  format: 'json' | 'text',
  processes: Proc[],
  containers: Container[],
  diagnostics: Diagnostics
): string {
  const data =
    kind === 'diagnostics'
      ? diagnostics
      : {
          generatedAt: new Date().toISOString(),
          commands: '[hidden]',
          processes: processes.slice(0, 2000).map((p) => ({
            pid: p.pid,
            name: clean(p.name),
            project: clean(p.project),
            ports: p.ports,
            cpu: p.cpu,
            memMB: p.memMB,
            command: '[hidden]'
          })),
          containers: containers.slice(0, 1000).map((c) => ({
            id: c.id,
            name: clean(c.name),
            state: c.state,
            project: c.project ? clean(c.project) : null,
            ports: c.ports
          })),
          truncated: processes.length > 2000 || containers.length > 1000
        }
  if (format === 'json') return JSON.stringify(data, null, 2)
  if (kind === 'diagnostics')
    return Object.entries(diagnostics)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')
  return [
    'DevDeck snapshot · arguments hidden · no environment data',
    ...processes
      .slice(0, 2000)
      .map(
        (p) =>
          `${p.pid} · ${clean(p.name)} · ${clean(p.project)} · ports ${p.ports.join(', ') || 'none'} · ${p.cpu.toFixed(1)}% CPU · ${p.memMB.toFixed(0)} MB`
      ),
    ...containers
      .slice(0, 1000)
      .map(
        (c) => `${c.id} · ${clean(c.name)} · ${c.state} · ports ${c.ports.join(', ') || 'none'}`
      ),
    ...(processes.length > 2000 || containers.length > 1000
      ? ['Snapshot truncated to 2,000 processes / 1,000 containers.']
      : [])
  ].join('\n')
}
