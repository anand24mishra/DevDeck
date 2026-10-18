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
    Object.keys(p).sort().join(',') === 'id,members,name' &&
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
