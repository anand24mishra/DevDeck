import { it, expect, vi } from 'vitest'
vi.mock('electron', () => ({ Notification: { isSupported: () => false } }))
import { ResourceHistory } from '../../src/main/services/resourceHistory'
import type { Proc, Settings } from '../../src/shared/types'
it('aggregates per project, prunes one hour and notifies only on threshold crossings', () => {
  let now = 0
  const notify = vi.fn(),
    history = new ResourceHistory(() => now, notify)
  const procs = [
    { project: 'web', cpu: 30, memMB: 100 },
    { project: 'web', cpu: 30, memMB: 100 }
  ] as Proc[]
  const settings = { resourceThresholds: { web: { cpu: 50 } } } as Settings
  history.observe(procs, settings)
  now += 3000
  history.observe(procs, settings)
  expect(history.read('web')[0].cpu).toBe(60)
  expect(notify).toHaveBeenCalledTimes(1)
  history.observe([], settings)
  history.observe(procs, settings)
  expect(notify).toHaveBeenCalledTimes(2)
  now += 3600001
  expect(history.read('web')).toEqual([])
})
