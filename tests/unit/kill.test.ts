import { describe, it, expect, vi } from 'vitest'
import { terminate, KillDeps } from '../../src/main/services/kill'

describe('safe process termination escalation', () => {
  it('stops processes gracefully with SIGTERM when they respond', async () => {
    const signalsSent: { pid: number; signal: string }[] = []
    const aliveMap = new Map<number, boolean>([
      [101, true],
      [102, true]
    ])

    const deps: KillDeps = {
      revalidate: vi.fn().mockResolvedValue({
        ok: [
          { pid: 101, command: 'node server.js' },
          { pid: 102, command: 'python3 main.py' }
        ],
        refused: []
      }),
      signal: vi.fn((pid, sig) => {
        signalsSent.push({ pid, signal: sig })
        if (sig === 'SIGTERM') {
          // Process exits upon SIGTERM
          aliveMap.set(pid, false)
        }
        return true
      }),
      alive: vi.fn((pid) => aliveMap.get(pid) ?? false),
      sleep: vi.fn().mockResolvedValue(undefined)
    }

    const report = await terminate([101, 102], deps)

    expect(report.stopped).toEqual([101, 102])
    expect(report.forced).toEqual([])
    expect(report.stillRunning).toEqual([])
    expect(report.refused).toEqual([])
    expect(signalsSent).toEqual([
      { pid: 101, signal: 'SIGTERM' },
      { pid: 102, signal: 'SIGTERM' }
    ])
    expect(deps.sleep).toHaveBeenCalledWith(3000)
  })

  it('escalates to SIGKILL if process survives 3s grace period', async () => {
    const signalsSent: { pid: number; signal: string }[] = []
    let alive = true

    const deps: KillDeps = {
      revalidate: vi.fn().mockResolvedValue({
        ok: [{ pid: 201, command: 'node stubborn.js' }],
        refused: []
      }),
      signal: vi.fn((pid, sig) => {
        signalsSent.push({ pid, signal: sig })
        if (sig === 'SIGKILL') {
          alive = false
        }
        return true
      }),
      alive: vi.fn(() => alive),
      sleep: vi.fn().mockResolvedValue(undefined)
    }

    const report = await terminate([201], deps)

    expect(signalsSent).toEqual([
      { pid: 201, signal: 'SIGTERM' },
      { pid: 201, signal: 'SIGKILL' }
    ])
    expect(report.stopped).toEqual([])
    expect(report.forced).toEqual([201])
    expect(report.stillRunning).toEqual([])
    expect(deps.sleep).toHaveBeenCalledWith(3000)
    expect(deps.sleep).toHaveBeenCalledWith(300)
  })

  it('reports unkillable processes in stillRunning if SIGKILL fails to terminate them', async () => {
    const deps: KillDeps = {
      revalidate: vi.fn().mockResolvedValue({
        ok: [{ pid: 301, command: 'node zombie.js' }],
        refused: []
      }),
      signal: vi.fn().mockReturnValue(true),
      alive: vi.fn().mockReturnValue(true), // Remains alive even after SIGKILL
      sleep: vi.fn().mockResolvedValue(undefined)
    }

    const report = await terminate([301], deps)

    expect(report.stopped).toEqual([])
    expect(report.forced).toEqual([])
    expect(report.stillRunning).toEqual([301])
  })

  it('refuses invalid or unauthorized PIDs without signalling them', async () => {
    const signalFn = vi.fn()
    const deps: KillDeps = {
      revalidate: vi.fn().mockResolvedValue({
        ok: [{ pid: 401, command: 'node dev.js' }],
        refused: [1, 9999] // 1 is system, 9999 not found/not allowed
      }),
      signal: signalFn,
      alive: vi.fn().mockReturnValue(false),
      sleep: vi.fn().mockResolvedValue(undefined)
    }

    const report = await terminate([401, 1, 9999], deps)

    expect(report.refused).toEqual([1, 9999])
    expect(report.stopped).toEqual([401])
    expect(signalFn).toHaveBeenCalledTimes(1)
    expect(signalFn).toHaveBeenCalledWith(401, 'SIGTERM')
  })

  it('handles empty PID list safely', async () => {
    const deps: KillDeps = {
      revalidate: vi.fn(),
      signal: vi.fn(),
      alive: vi.fn(),
      sleep: vi.fn()
    }

    const report = await terminate([], deps)
    expect(report.requested).toEqual([])
    expect(report.stopped).toEqual([])
    expect(deps.revalidate).not.toHaveBeenCalled()
  })
})
