import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { terminate, defaultKillDeps } from '../../src/main/services/kill'

describe('Terminate Integration Test', () => {
  it('safely terminates a real spawned child dev process', async () => {
    // Spawn a real child process running node
    const child = spawn(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000)'],
      { stdio: 'ignore' }
    )

    const pid = child.pid
    expect(pid).toBeDefined()
    if (!pid) return

    // Confirm it is alive
    expect(defaultKillDeps.alive(pid)).toBe(true)

    // Execute terminate
    const report = await terminate([pid], defaultKillDeps)

    // Verify report accounting
    expect(report.requested).toContain(pid)
    expect(report.refused).toEqual([])
    expect(report.stillRunning).toEqual([])
    expect(report.stopped.includes(pid) || report.forced.includes(pid)).toBe(true)

    // Confirm it is no longer alive
    expect(defaultKillDeps.alive(pid)).toBe(false)
  }, 10000)
})
