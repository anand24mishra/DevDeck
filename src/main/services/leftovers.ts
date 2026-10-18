import type { Proc } from '../../shared/types'

export function leftoverHint(
  proc: Pick<Proc, 'ppid' | 'startTime' | 'status' | 'cwd'>,
  previous: { ppid: number; startTime: string } | undefined,
  directoryExists: boolean
): string | undefined {
  if (proc.status === 'zombie') return 'Waiting for its parent to clean up'
  if (proc.ppid !== 1) return undefined
  if (proc.cwd && !directoryExists) return 'Its project folder is no longer available'
  if (previous?.startTime === proc.startTime && previous.ppid > 1)
    return 'Its parent process closed'
  return undefined
}
