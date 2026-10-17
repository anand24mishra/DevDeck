import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { InstalledApplication } from '../../shared/types'

export const EDITOR_IDS = ['auto', 'vscode', 'cursor', 'zed', 'sublime', 'jetbrains']
export const TERMINAL_IDS = ['auto', 'terminal', 'iterm', 'warp', 'ghostty']
const candidates = [
  ['vscode', 'Visual Studio Code', 'editor'],
  ['cursor', 'Cursor', 'editor'],
  ['zed', 'Zed', 'editor'],
  ['sublime', 'Sublime Text', 'editor'],
  ['jetbrains', 'WebStorm', 'editor'],
  ['jetbrains', 'IntelliJ IDEA', 'editor'],
  ['jetbrains', 'PyCharm', 'editor'],
  ['iterm', 'iTerm', 'terminal'],
  ['warp', 'Warp', 'terminal'],
  ['ghostty', 'Ghostty', 'terminal']
] as const
export function detectApplications(): InstalledApplication[] {
  const apps: InstalledApplication[] = []
  for (const [id, name, kind] of candidates) {
    for (const directory of ['/Applications', path.join(os.homedir(), 'Applications')]) {
      const appPath = path.join(directory, `${name}.app`)
      if (fs.existsSync(appPath) && !apps.some((app) => app.id === id))
        apps.push({ id, name, path: appPath, kind })
    }
  }
  const terminal = '/System/Applications/Utilities/Terminal.app'
  if (fs.existsSync(terminal))
    apps.push({ id: 'terminal', name: 'Terminal', path: terminal, kind: 'terminal' })
  for (const [id, name, shim] of [
    ['vscode', 'VS Code', 'code'],
    ['cursor', 'Cursor', 'cursor'],
    ['zed', 'Zed', 'zed'],
    ['sublime', 'Sublime Text', 'subl'],
    ['jetbrains', 'JetBrains', 'idea']
  ]) {
    for (const directory of ['/opt/homebrew/bin', '/usr/local/bin']) {
      const executable = path.join(directory, shim)
      try {
        fs.accessSync(executable, fs.constants.X_OK)
      } catch {
        continue
      }
      if (!apps.some((app) => app.id === id))
        apps.push({ id, name, path: executable, kind: 'editor', cli: true })
    }
  }
  return apps
}
export function verifyProjectPath(requested: string, activeRoots: string[]): string | null {
  try {
    if (!path.isAbsolute(requested) || requested.includes('\0')) return null
    const root = fs.realpathSync(requested)
    if (
      !fs.statSync(root).isDirectory() ||
      !activeRoots.some((candidate) => {
        try {
          return fs.realpathSync(candidate) === root
        } catch {
          return false
        }
      })
    )
      return null
    return fs.existsSync(path.join(root, '.git')) || fs.existsSync(path.join(root, 'package.json'))
      ? root
      : null
  } catch {
    return null
  }
}
export function applicationInvocation(
  app: InstalledApplication,
  root: string
): { file: string; args: string[] } {
  if (app.cli) return { file: app.path, args: [root] }
  if (app.id === 'ghostty')
    return {
      file: '/usr/bin/open',
      args: ['-na', app.path, '--args', `--working-directory=${root}`]
    }
  if (app.id === 'warp') {
    const url = new URL('warp://action/new_tab')
    url.searchParams.set('path', root)
    return { file: '/usr/bin/open', args: ['-a', app.path, url.href] }
  }
  return { file: '/usr/bin/open', args: ['-a', app.path, root] }
}
export async function openWithApplication(app: InstalledApplication, root: string): Promise<void> {
  const invocation = applicationInvocation(app, root)
  await promisify(execFile)(invocation.file, invocation.args, { timeout: 5000, maxBuffer: 65536 })
}
