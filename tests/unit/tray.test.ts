import { describe, expect, it } from 'vitest'
import { confirmTrayStopAll } from '../../src/main/services/tray'
import type { Proc } from '../../src/shared/types'

const targets = [
  { pid: 42, project: 'web' },
  { pid: 43, project: 'api' }
] as Proc[]

describe('tray stop-all confirmation', () => {
  it('cancel leaves processes running and confirmation names the projects', async () => {
    let running = true
    const report = await confirmTrayStopAll(
      targets,
      async (message, detail) => {
        expect(message).toContain('2 development processes')
        expect(detail).toBe('api\nweb')
        return false
      },
      async () => {
        running = false
        throw new Error('Cancel must never reach termination')
      }
    )
    expect(running).toBe(true)
    expect(report).toBeNull()
  })

  it('confirmation stops precisely the captured targets and returns partial results', async () => {
    const result = await confirmTrayStopAll(
      targets,
      async () => true,
      async (confirmed) => ({
        requested: confirmed.map((target) => target.pid),
        stopped: [42],
        forced: [],
        refused: [43],
        stillRunning: []
      })
    )
    expect(result?.requested).toEqual([42, 43])
    expect(result?.refused).toEqual([43])
  })
})
