import type { StackProfile, ProfileMember, Proc } from './types'
const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= max &&
  !value.includes('\0')
export function validMember(value: unknown): value is ProfileMember {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const m = value as ProfileMember
  if (
    Object.keys(m).some((k) => !['name', 'command', 'cwd', 'ports', 'containerId'].includes(k)) ||
    !text(m.name, 120) ||
    !Array.isArray(m.ports) ||
    m.ports.length > 50 ||
    !m.ports.every((p) => Number.isInteger(p) && p > 0 && p <= 65535)
  )
    return false
  if (m.containerId !== undefined)
    return /^[a-f0-9]{12,64}$/.test(m.containerId) && m.command === undefined && m.cwd === undefined
  return text(m.command, 8192) && text(m.cwd, 4096) && m.cwd.startsWith('/')
}
export function validProfile(value: unknown): value is StackProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = value as StackProfile
  return (
    Object.keys(p).sort().join(',') === (p.repo ? 'id,members,name,repo' : 'id,members,name') &&
    (!p.repo ||
      (Object.keys(p.repo).sort().join(',') === 'hash,path' &&
        text(p.repo.path, 4096) &&
        p.repo.path.startsWith('/') &&
        /^[a-f0-9]{64}$/.test(p.repo.hash))) &&
    typeof p.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,80}$/.test(p.id) &&
    text(p.name, 120) &&
    Array.isArray(p.members) &&
    p.members.length > 0 &&
    p.members.length <= 50 &&
    p.members.every(validMember) &&
    new Set(p.members.map((m) => m.name)).size === p.members.length
  )
}
export function profileProcesses(member: ProfileMember, processes: Proc[]): Proc[] {
  return processes.filter(
    (p) =>
      p.manageable !== false &&
      p.cwd === member.cwd &&
      (p.command === member.command ||
        (member.ports.length > 0 && member.ports.some((port) => p.ports.includes(port))))
  )
}

export function validThresholds(
  value: unknown
): value is Record<string, { cpu?: number; memMB?: number }> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length > 200
  )
    return false
  return Object.entries(value).every(
    ([key, v]) =>
      text(key, 4096) &&
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).every((k) => ['cpu', 'memMB'].includes(k)) &&
      Object.entries(v).every(
        ([k, n]) =>
          typeof n === 'number' &&
          Number.isFinite(n) &&
          n > 0 &&
          n <= (k === 'cpu' ? 100000 : 1048576)
      )
  )
}
