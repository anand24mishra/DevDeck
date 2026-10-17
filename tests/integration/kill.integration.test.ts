import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { terminate, defaultKillDeps } from '../../src/main/services/kill'

describe('Terminate Integration Test', () => {
  it('safely terminates a real spawned child dev process', async () => {
    // Spawn a real child process running node
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore'
    })

    const pid = child.pid
    expect(pid).toBeDefined()
    if (!pid) return

    // Confirm it is alive
    expect(defaultKillDeps.alive(pid)).toBe(true)

    // Execute terminate
    const snapshot = await defaultKillDeps.revalidate([pid])
    expect(snapshot.ok).toHaveLength(1)
    const report = await terminate(snapshot.ok, defaultKillDeps)

    // Verify report accounting
    expect(report.requested).toContain(pid)
    expect(report.refused).toEqual([])
    expect(report.stillRunning).toEqual([])
    expect(report.stopped.includes(pid) || report.forced.includes(pid)).toBe(true)

    // Confirm it is no longer alive
    expect(defaultKillDeps.alive(pid)).toBe(false)
  }, 10000)

  it('refuses the stale identity of an exited child when a replacement is running', async () => {
    const first = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore'
    })
    const snapshot = await defaultKillDeps.revalidate([first.pid!])
    const exited = new Promise<void>((resolve) => first.once('exit', () => resolve()))
    first.kill('SIGTERM')
    await exited
    const replacement = spawn(process.execPath, ['-e', 'setInterval(() => {}, 2000)'], {
      stdio: 'ignore'
    })
    try {
      // OS PID reuse cannot be forced safely. Carry the stale captured identity onto the live PID.
      const stale = { ...snapshot.ok[0], pid: replacement.pid! }
      const report = await terminate([stale], defaultKillDeps)
      expect(report.refusalReasons?.[replacement.pid!]).toBe('identity-changed')
      expect(defaultKillDeps.alive(replacement.pid!)).toBe(true)
    } finally {
      replacement.kill('SIGTERM')
    }
  })
})
