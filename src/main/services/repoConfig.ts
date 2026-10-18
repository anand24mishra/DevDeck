import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'
import { dialog } from 'electron'
import { settingsService } from './settings'
import { validProfile } from '../../shared/profiles'
import type { StackProfile, RepoConfigPreview, Result } from '../../shared/types'
export function parseRepoConfig(
  raw: string,
  root: string
): StackProfile & { expectedPorts: number[] } {
  if (Buffer.byteLength(raw) > 65536) throw new Error('Config too large')
  const value = JSON.parse(raw)
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (k) => !['version', 'name', 'expectedPorts', 'start', 'profile'].includes(k)
    ) ||
    value.version !== 1 ||
    !Array.isArray(value.start) ||
    value.start.length < 1 ||
    value.start.length > 50 ||
    !Array.isArray(value.expectedPorts) ||
    value.expectedPorts.length > 50 ||
    !value.expectedPorts.every((p) => Number.isInteger(p) && p > 0 && p <= 65535)
  )
    throw new Error('Invalid config')
  const hash = createHash('sha256')
    .update(root + '\0' + raw)
    .digest('hex')
  const profile: StackProfile = {
    id: 'repo-' + createHash('sha256').update(root).digest('hex').slice(0, 20),
    name: value.profile ?? value.name,
    repo: { path: root, hash },
    members: value.start.map((m) => {
      if (
        !m ||
        Object.keys(m).some((k) => !['name', 'command', 'cwd'].includes(k)) ||
        (m.cwd !== undefined && (typeof m.cwd !== 'string' || path.isAbsolute(m.cwd)))
      )
        throw new Error('Invalid command')
      const cwd = path.resolve(root, m.cwd || '.')
      if (cwd !== root && !cwd.startsWith(root + path.sep)) throw new Error('Outside project')
      return { name: m.name, command: m.command, cwd, ports: value.expectedPorts }
    })
  }
  if (
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 120 ||
    !validProfile(profile)
  )
    throw new Error('Invalid profile')
  return { ...profile, expectedPorts: value.expectedPorts }
}
export async function readRepoProfile(root: string): Promise<ReturnType<typeof parseRepoConfig>> {
  const real = await fs.realpath(root)
  if (real !== root) throw new Error('Noncanonical root')
  const file = path.join(root, '.devdeck.json')
  const handle = await fs.open(file, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 65536 || (await fs.realpath(file)) !== file)
      throw new Error('Unsafe config')
    const data = Buffer.alloc(65537)
    const { bytesRead } = await handle.read(data, 0, data.length, 0)
    const profile = parseRepoConfig(data.subarray(0, bytesRead).toString(), root)
    for (const member of profile.members) {
      const cwd = await fs.realpath(member.cwd!)
      if (cwd !== root && !cwd.startsWith(root + path.sep)) throw new Error('Outside root')
      if (!(await fs.stat(cwd)).isDirectory()) throw new Error('Invalid folder')
      member.cwd = cwd
    }
    return profile
  } finally {
    await handle.close()
  }
}
export async function repoApprovalCurrent(profile: StackProfile): Promise<boolean> {
  if (!profile.repo) return true
  try {
    const current = await readRepoProfile(profile.repo.path)
    return (
      current.repo!.hash === profile.repo.hash &&
      JSON.stringify(current.members) === JSON.stringify(profile.members) &&
      current.name === profile.name &&
      settingsService.getSettings().approvedRepoConfigs?.[profile.repo.path] === profile.repo.hash
    )
  } catch {
    return false
  }
}
export async function repoConfigRequest(
  root: string,
  importing: boolean
): Promise<Result<RepoConfigPreview | null>> {
  try {
    const profile = await readRepoProfile(root)
    const approved = await repoApprovalCurrent(profile)
    if (!importing)
      return {
        ok: true,
        data: {
          name: profile.name,
          expectedPorts: profile.expectedPorts,
          commandCount: profile.members.length,
          approved
        }
      }
    if (!approved) {
      const response = await dialog.showMessageBox({
        type: 'warning',
        message: `Approve commands from ${profile.name}?`,
        detail:
          'These commands come from this repository. Only approve commands you trust. Changes require approval again.\n\n' +
          profile.members.map((m) => `${m.name}\n${m.cwd}\n${m.command}`).join('\n\n'),
        buttons: ['Cancel', 'Approve and import'],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      })
      if (response.response !== 1) return { ok: true, data: null }
    }
    const fresh = await readRepoProfile(root)
    if (fresh.repo!.hash !== profile.repo!.hash) throw new Error('Changed during review')
    const { expectedPorts: _ports, ...saved } = fresh
    void _ports
    const settings = settingsService.getSettings()
    if ((settings.profiles || []).filter((p) => p.id !== saved.id).length >= 50)
      throw new Error('Profile limit')
    settingsService.updateSettings({
      approvedRepoConfigs: { ...settings.approvedRepoConfigs, [root]: fresh.repo!.hash },
      profiles: [...(settings.profiles || []).filter((p) => p.id !== saved.id), saved]
    })
    return { ok: true, data: null }
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message:
          'Could not import .devdeck.json. Check schema v1, folder paths and the 64 KiB limit; retry if the file changed during review.'
      }
    }
  }
}
