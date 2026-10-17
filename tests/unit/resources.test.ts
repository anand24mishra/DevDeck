import { expect, it } from 'vitest'
import { sortProcesses, processTotals } from '../../src/renderer/src/utils/processes'
import type { Proc } from '../../src/shared/types'

it('sorts resources stably, keeps no-port rows last, and totals actual rows', () => {
  const a = { pid: 1, name: 'a', memMB: 100, cpu: 2, uptimeSec: 4, ports: [] } as unknown as Proc
  const b = { ...a, pid: 2, name: 'b', memMB: 200, ports: [3000] }
  const c = { ...b, pid: 3, name: 'c', ports: [8000] }
  expect(sortProcesses([a, b, c], 'memory').map((proc) => proc.pid)).toEqual([2, 3, 1])
  expect(sortProcesses([a, b, c], 'port').map((proc) => proc.pid)).toEqual([2, 3, 1])
  expect(processTotals([a, b, c])).toEqual({ memMB: 500, cpu: 6 })
})
