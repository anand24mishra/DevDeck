import path from 'path'
import { isProcessAllowed } from './allowlist'
import type { Settings } from '../../shared/types'
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
