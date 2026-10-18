import { readMetadata } from './metadata'
import { runtimeHints } from './runtime'
import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ProjectContext } from '../../shared/types'

const cache = new Map<string, { at: number; pending: Promise<ProjectContext> }>()
export function parseGitHead(head: string): string | undefined {
  const text = head.trim()
  const branch = text.match(/^ref: refs\/heads\/(.{1,200})$/)
  if (
    branch &&
    ![...branch[1]].some(
      (character) =>
        character.charCodeAt(0) <= 32 ||
        character.charCodeAt(0) === 127 ||
        ['~', '^', ':', '?', '*', '[', '\\'].includes(character)
    )
  )
    return branch[1]
  return /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(text) ? `detached ${text.slice(0, 8)}` : undefined
}
async function readContext(root: string): Promise<ProjectContext> {
  try {
    let git = path.join(root, '.git')
    const info = await fs.stat(git)
    if (info.isFile()) {
      if (info.size > 4096) return {}
      const pointer = readMetadata(root, '.git', 4096)
        .trim()
        .match(/^gitdir: (.+)$/)
      if (!pointer) return {}
      git = path.resolve(root, pointer[1])
    }
    const branch = parseGitHead(readMetadata(git, 'HEAD', 4096))
    if (!branch) return {}
    let executable: string | undefined
    for (const candidate of [
      '/opt/homebrew/bin/git',
      '/usr/local/bin/git',
      '/Library/Developer/CommandLineTools/usr/bin/git',
      '/Applications/Xcode.app/Contents/Developer/usr/bin/git'
    ]) {
      try {
        await fs.access(candidate)
        executable = candidate
        break
      } catch {
        /* Try next installed Git. */
      }
    }
    if (!executable) return {}
    const { stdout } = await promisify(execFile)(
      executable,
      [
        '--no-optional-locks',
        '-c',
        'core.fsmonitor=false',
        '-c',
        'core.hooksPath=/dev/null',
        '-C',
        root,
        'status',
        '--porcelain=v1',
        '--untracked-files=normal'
      ],
      { timeout: 1000, maxBuffer: 65536 }
    )
    return { branch, dirty: stdout.trim().length > 0 }
  } catch {
    return {}
  }
}
export function projectContext(root: string): Promise<ProjectContext> {
  const cached = cache.get(root)
  if (cached && Date.now() - cached.at < 10_000) return cached.pending
  if (cache.size > 500) cache.clear()
  const pending = Promise.all([readContext(root), runtimeHints(root)]).then(([git, runtime]) => ({
    ...git,
    runtime
  }))
  cache.set(root, { at: Date.now(), pending })
  return pending
}
