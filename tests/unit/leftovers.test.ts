import { expect, it } from 'vitest'
import { leftoverHint } from '../../src/main/services/leftovers'

it('distinguishes observed orphans and zombies from normal managed daemons', () => {
  const proc = { ppid: 1, startTime: 'now', status: 'running' as const, cwd: '/project' }
  expect(leftoverHint(proc, undefined, true)).toBeUndefined()
  expect(leftoverHint(proc, undefined, false)).toContain('folder')
  expect(leftoverHint(proc, { ppid: 42, startTime: 'now' }, true)).toContain('parent')
  expect(leftoverHint(proc, { ppid: 42, startTime: 'old' }, true)).toBeUndefined()
  expect(leftoverHint({ ...proc, status: 'zombie' }, undefined, true)).toContain('clean up')
})
