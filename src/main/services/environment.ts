import { execFile } from 'child_process'
import { promisify } from 'util'
import type { EnvironmentEntry, ProcessIdentity, Result } from '../../shared/types'
import { defaultKillDeps, type KillDeps } from './kill'

export function parseEnvironmentOutput(output: string, command: string): EnvironmentEntry[] {
  const line = output.trimStart()
  if (!line.startsWith(command)) return []
  const suffix = line.slice(command.length).trim()
  const matches = [...suffix.matchAll(/(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=/g)]
  return matches.slice(0, 512).map((match, index) => ({
    key: match[1],
    value: suffix
      .slice(match.index! + match[0].length, matches[index + 1]?.index ?? suffix.length)
      .trimEnd()
      .slice(0, 65536),
    sensitive: /(KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTH)/i.test(match[1])
  }))
}
export async function readEnvironment(
  pid: number,
  startTime: string,
  revalidate: KillDeps['revalidate'] = defaultKillDeps.revalidate,
  read: (pid: number) => Promise<string> = async (target) =>
    (
      await promisify(execFile)('/bin/ps', ['eww', '-p', String(target), '-o', 'command='], {
        timeout: 3000,
        maxBuffer: 1024 * 1024
      })
    ).stdout
): Promise<Result<EnvironmentEntry[]>> {
  const denied = {
    ok: false as const,
    error: {
      code: 'DENIED' as const,
      message: 'This process cannot be inspected safely. Refresh and try again.'
    }
  }
  try {
    const original = (await revalidate([pid])).ok.find(
      (proc) => proc.pid === pid && proc.startTime === startTime
    )
    if (!original) return denied
    const output = await read(pid)
    const current: ProcessIdentity | undefined = (await revalidate([pid])).ok.find(
      (proc) => proc.pid === pid
    )
    if (
      !current ||
      current.startTime !== original.startTime ||
      current.command !== original.command
    )
      return denied
    return { ok: true, data: parseEnvironmentOutput(output, original.command) }
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Environment values are unavailable for this process.' }
    }
  }
}
