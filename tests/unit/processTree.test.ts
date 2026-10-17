import { expect, it } from 'vitest'
import { buildProcessTree, descendantsChildrenFirst } from '../../src/shared/processTree'
import type { Proc } from '../../src/shared/types'

it('builds out-of-order trees, orders descendants first and handles malformed cycles safely', () => {
  const processes = [
    { pid: 4, ppid: 3 },
    { pid: 2, ppid: 1 },
    { pid: 3, ppid: 2 },
    { pid: 5, ppid: 1 }
  ] as Proc[]
  expect(descendantsChildrenFirst(processes, 2).map((proc) => proc.pid)).toEqual([4, 3, 2])
  const tree = buildProcessTree(processes)
  expect(tree.map((node) => node.process.pid)).toEqual([2, 5])
  expect(tree[0].children[0].children[0].process.pid).toBe(4)
  expect(
    buildProcessTree([
      { pid: 2, ppid: 3 },
      { pid: 3, ppid: 2 }
    ] as Proc[])
  ).toHaveLength(1)
})
