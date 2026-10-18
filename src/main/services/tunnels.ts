import path from 'path'
import { parseCommandLine } from '../utils/command'
import type { Proc } from '../../shared/types'

function safeTarget(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (/^[a-z]+:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      return ['http:', 'https:', 'tcp:'].includes(url.protocol)
        ? `${url.protocol}//${url.host}`
        : undefined
    } catch {
      return undefined
    }
  }
  return /^[\w.:[\]/-]{1,200}$/.test(value) ? value : undefined
}
export function detectTunnel(command: string): Proc['tunnel'] {
  const { executable, args } = parseCommandLine(command)
  const name = path.basename(executable).toLowerCase()
  if (name === 'ssh') {
    for (let index = 0; index < args.length; index++) {
      const forward = args[index].match(/^-[1246AaCfGgKkMNnqsTtVvXxYy]*([LRD])(.*)$/)
      if (!forward) continue
      const value = forward[2] || args[index + 1]
      const destination = value?.match(/(?:^|:)(\[[^\]]+\]|[^:]+):(\d+)$/)
      return {
        kind: 'ssh',
        target:
          forward[1] === 'D'
            ? 'Dynamic forwarding'
            : safeTarget(destination ? `${destination[1]}:${destination[2]}` : undefined)
      }
    }
  }
  const at = args.indexOf('port-forward')
  if (name === 'kubectl' && at >= 0)
    return { kind: 'kubectl', target: at >= 0 ? safeTarget(args[at + 1]) : undefined }
  if (name === 'ngrok') {
    const at = args.findIndex((arg) => arg === 'http' || arg === 'tcp')
    return { kind: 'ngrok', target: safeTarget(args[at + 1]) }
  }
  if (name === 'cloudflared' && args.includes('tunnel')) {
    const url =
      args.find((arg) => arg.startsWith('--url='))?.slice(6) ||
      (args.includes('--url') ? args[args.indexOf('--url') + 1] : undefined)
    return { kind: 'cloudflared', target: safeTarget(url) }
  }
  if (name === 'tailscale' && args.includes('funnel'))
    return { kind: 'tailscale', target: safeTarget(args[args.indexOf('funnel') + 1]) }
  return undefined
}
