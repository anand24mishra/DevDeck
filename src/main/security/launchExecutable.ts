import path from 'path'
import { isProcessAllowed } from './allowlist'
import type { Settings, ProcessIdentity } from '../../shared/types'
const shims: Record<string, string[]> = {
  npm: ['npm-cli.js'],
  npx: ['npx-cli.js'],
  pnpm: ['pnpm.cjs', 'pnpm.js'],
  yarn: ['yarn.js', 'yarn.cjs'],
  cargo: ['rustup']
}
export function safeResolvedExecutable(
  candidate: string,
  real: string,
  args: string[],
  settings: Settings
): boolean {
  const options = { userIgnoreList: settings.ignoreList, customAllowlist: settings.customAllowlist }
  if (isProcessAllowed(2, `"${real}" ${args.join(' ')}`, options).allowed) return true
  const alias = path.basename(candidate).toLowerCase(),
    binary = path.basename(real).toLowerCase()
  if (!shims[alias]?.includes(binary)) return false
  if (
    real.includes('.app/Contents/') &&
    !settings.customAllowlist.some((n) => n.toLowerCase() === alias)
  )
    return false
  return !settings.ignoreList.some(
    (n) => n.trim() && `${real} ${args.join(' ')}`.toLowerCase().includes(n.trim().toLowerCase())
  )
}

/** Bind the first identity snapshot to the still-live direct child that was spawned. */
export function spawnedIdentity(
  output: string,
  workerPid: number,
  child: { pid?: number; exitCode: number | null; signalCode: string | null }
): ProcessIdentity | undefined {
  if (
    !Number.isSafeInteger(child.pid) ||
    child.pid! <= 1 ||
    child.exitCode !== null ||
    child.signalCode !== null
  )
    return undefined
  const snapshot = output.trim().match(/^(\d+)\s+(.{24})\s+(.+)$/)
  if (!snapshot || Number(snapshot[1]) !== workerPid || snapshot[3].length > 131072)
    return undefined
  return { pid: child.pid!, startTime: snapshot[2].trim(), command: snapshot[3].trim() }
}
