import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { terminate, createKillDeps } from '../../src/main/services/kill'

// A separate app identity keeps fixture children outside the simulated DevDeck tree.
const defaultKillDeps = createKillDeps({ pid: 0, ppid: 0 })

describe('Terminate Integration Test', () => {
  it('production defaults refuse a real child of the app before signaling', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore'
    })
    try {
      const snapshot = await defaultKillDeps.revalidate([child.pid!])
      const report = await terminate(snapshot.ok, createKillDeps())
      expect(report.refused).toEqual([child.pid])
      expect(defaultKillDeps.alive(child.pid!)).toBe(true)
    } finally {
      child.kill('SIGTERM')
    }
  })

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

it('pauses, resumes and reloads only a real fixture process', async () => {
  const { once } = await import('node:events')
  const { sendControlSignal } = await import('../../src/main/services/kill')
  const child = spawn(
    process.execPath,
    [
      '-e',
      "process.on('SIGHUP',()=>process.send('reloaded')); process.send('ready'); setInterval(()=>{},1000)"
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }
  )
  try {
    await once(child, 'message')
    const snapshot = (await defaultKillDeps.revalidate([child.pid!])).ok
    expect(snapshot).toHaveLength(1)
    expect((await sendControlSignal(snapshot, 'SIGSTOP', defaultKillDeps)).signaled).toEqual([
      child.pid
    ])
    expect((await sendControlSignal(snapshot, 'SIGCONT', defaultKillDeps)).signaled).toEqual([
      child.pid
    ])
    const reloaded = once(child, 'message')
    expect((await sendControlSignal(snapshot, 'SIGHUP', defaultKillDeps)).signaled).toEqual([
      child.pid
    ])
    expect((await reloaded)[0]).toBe('reloaded')
  } finally {
    child.kill('SIGCONT')
    child.kill('SIGTERM')
  }
}, 10_000)
