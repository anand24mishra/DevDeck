import { repoApprovalCurrent } from './repoConfig'
import { dialog } from 'electron'
import { randomUUID } from 'crypto'
import { settingsService } from './settings'
import { dockerService } from './docker'
import { launchMember, launches } from './launcher'
import { DarwinProcessProvider } from '../providers/process.darwin'
import { terminate, defaultKillDeps } from './kill'
import { notificationService } from './notifications'
import { profileProcesses } from '../../shared/profiles'
import type { StackProfile, ProfileStatus, MemberReport, Result } from '../../shared/types'
const provider = new DarwinProcessProvider()
let busy = false
const read = async (): Promise<Awaited<ReturnType<typeof provider.listProcesses>>> => {
  const s = settingsService.getSettings()
  return provider.listProcesses({
    userIgnoreList: s.ignoreList,
    customAllowlist: s.customAllowlist
  })
}
function matched(
  member: StackProfile['members'][number],
  procs: Awaited<ReturnType<typeof read>>,
  profileId?: string
): typeof procs {
  const known = [...launches.values()].filter(
    (l) => l.cwd === member.cwd && l.command === member.command && l.identity
  )
  const saved = profileId
    ? settingsService.getSettings().profileLaunches?.[profileId]?.[member.name]
    : undefined
  const pids = new Set(profileProcesses(member, procs).map((p) => p.pid))
  return procs.filter(
    (p) =>
      pids.has(p.pid) ||
      (saved?.pid === p.pid && saved.startTime === p.startTime && saved.command === p.command) ||
      known.some(
        (l) =>
          l.identity!.pid === p.pid &&
          l.identity!.startTime === p.startTime &&
          l.identity!.command === p.command
      )
  )
}
export async function listProfiles(): Promise<ProfileStatus[]> {
  const [procs, containers] = await Promise.all([
    read(),
    dockerService.listContainers(settingsService.getSettings().dockerSocketPath)
  ])
  return (settingsService.getSettings().profiles || []).map((profile) => ({
    profile,
    members: profile.members.map((member) => ({
      name: member.name,
      running: member.containerId
        ? containers.ok &&
          containers.data.some((c) => member.containerId!.startsWith(c.id) && c.state === 'running')
        : matched(member, procs, profile.id).length > 0
    }))
  }))
}
export function saveProfile(profile: StackProfile): void {
  const current = settingsService.getSettings().profiles || []
  if (!current.some((p) => p.id === profile.id) && current.length >= 50)
    throw new Error('Profile limit')
  settingsService.updateSettings({
    profiles: [...current.filter((p) => p.id !== profile.id), profile]
  })
}
export async function profileFromProject(root: string): Promise<Result<null>> {
  const procs = (await read()).filter(
    (p) => p.projectPath === root && p.cwd && p.manageable !== false
  )
  if (!procs.length)
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'No manageable processes were found for this project.' }
    }
  const answer = await dialog.showMessageBox({
    type: 'question',
    message: 'Save these start commands as a profile?',
    detail:
      'Commands may contain private values. They will be saved in your local settings. Review every command.\n\n' +
      procs.map((p) => `${p.cwd}\n${p.command}`).join('\n\n'),
    buttons: ['Cancel', 'Save profile'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  if (answer.response !== 1) return { ok: true, data: null }
  saveProfile({
    id: randomUUID(),
    name: procs[0].project,
    members: procs.slice(0, 50).map((p) => ({
      name: `${p.name} (${p.pid})`,
      command: p.command,
      cwd: p.cwd!,
      ports: p.ports
    }))
  })
  return { ok: true, data: null }
}
export async function profileAction(
  id: string,
  action: 'start' | 'stop' | 'restart'
): Promise<Result<MemberReport[]>> {
  if (busy)
    return {
      ok: false,
      error: { code: 'DENIED', message: 'Another profile action is still running.' }
    }
  const profile = settingsService.getSettings().profiles?.find((p) => p.id === id)
  if (!profile)
    return { ok: false, error: { code: 'NOT_FOUND', message: 'This profile no longer exists.' } }
  if (action !== 'stop' && !(await repoApprovalCurrent(profile)))
    return {
      ok: false,
      error: {
        code: 'DENIED',
        message: 'This repository config changed or is unapproved. Import it again before starting.'
      }
    }
  busy = true
  try {
    const settings = settingsService.getSettings()
    const snapshot = await read()
    const captured = profile.members.map((member) => ({
      member,
      procs: matched(member, snapshot, profile.id)
    }))
    const answer = await dialog.showMessageBox({
      type: action === 'start' ? 'question' : 'warning',
      message: `${action[0].toUpperCase() + action.slice(1)} ${profile.name}?`,
      detail: captured
        .map(({ member, procs }) =>
          member.containerId
            ? `${member.name}: container ${member.containerId}`
            : `${member.name}: ${procs.length} running process(es)\n${action === 'stop' ? '' : `${member.cwd}\n${member.command}`}`
        )
        .join('\n\n'),
      buttons: ['Cancel', action[0].toUpperCase() + action.slice(1)],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (answer.response !== 1) return { ok: true, data: [] }
    if (action !== 'stop' && !(await repoApprovalCurrent(profile)))
      return {
        ok: false,
        error: {
          code: 'DENIED',
          message: 'The repository config changed during review. Import it again.'
        }
      }
    const reports: MemberReport[] = []
    for (const { member, procs } of captured) {
      try {
        if (member.containerId) {
          const result = await dockerService.containerAction(
            member.containerId,
            action,
            settings.dockerSocketPath
          )
          reports.push({
            name: member.name,
            ok: result.ok,
            message: result.ok ? 'Done' : result.error.message
          })
          continue
        }
        if (action !== 'start' && procs.length) {
          notificationService.expectStops(procs)
          const result = await terminate(procs, defaultKillDeps)
          if (result.refused.length || result.stillRunning.length) {
            reports.push({
              name: member.name,
              ok: false,
              message: 'Some processes could not be stopped. No replacement was started.'
            })
            continue
          }
        }
        if (action !== 'stop') {
          if (action === 'start' && procs.length) {
            reports.push({ name: member.name, ok: true, message: 'Already running' })
            continue
          }
          const result = await launchMember(member)
          let persisted = true
          if (result.ok) {
            const identity = launches.get(result.data.id)?.identity
            if (identity) {
              const current = settingsService.getSettings().profileLaunches || {}
              const { pid, startTime, command } = identity
              try {
                settingsService.updateSettings({
                  profileLaunches: {
                    ...current,
                    [profile.id]: {
                      ...current[profile.id],
                      [member.name]: { pid, startTime, command }
                    }
                  }
                })
              } catch {
                persisted = false
              }
            }
          }
          reports.push({
            name: member.name,
            ok: result.ok,
            message: result.ok
              ? persisted
                ? 'Started'
                : 'Started; could not save its restart identity. Refresh to see the process.'
              : result.error.message,
            ...(result.ok ? { pid: result.data.pid } : {})
          })
        } else
          reports.push({
            name: member.name,
            ok: true,
            message: procs.length ? 'Stopped' : 'Already stopped'
          })
      } catch {
        reports.push({
          name: member.name,
          ok: false,
          message: 'This member could not complete. Other members were still attempted.'
        })
      }
    }
    return { ok: true, data: reports }
  } finally {
    busy = false
  }
}
