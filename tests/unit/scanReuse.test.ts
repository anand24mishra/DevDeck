import { describe, expect, it, vi } from 'vitest'
import { DarwinProcessProvider } from '../../src/main/providers/process.darwin'

type Internals = {
  getRawProcesses: () => Promise<unknown[]>
  getOpenFiles: () => Promise<unknown>
}

function provider(): { instance: DarwinProcessProvider; ps: ReturnType<typeof vi.fn> } {
  const instance = new DarwinProcessProvider({ pid: 1, ppid: 0 })
  const ps = vi.fn(async () => [])
  const internals = instance as unknown as Internals
  internals.getRawProcesses = ps
  internals.getOpenFiles = async () => ({
    listeners: new Map(),
    cwds: new Map(),
    sockets: new Map(),
    connections: new Map(),
    files: new Map()
  })
  return { instance, ps }
}

describe('scan reuse', () => {
  it('scans fresh by default so safety checks never see stale data', async () => {
    const { instance, ps } = provider()
    await instance.listProcesses()
    await instance.listProcesses()
    expect(ps).toHaveBeenCalledTimes(2)
  })

  it('shares one scan between callers that accept a recent result', async () => {
    const { instance, ps } = provider()
    await Promise.all([
      instance.listProcesses({}, { maxAgeMs: 5000 }),
      instance.listProcesses({}, { maxAgeMs: 5000 })
    ])
    expect(ps).toHaveBeenCalledTimes(1)
  })

  it('does not reuse a scan made with different options', async () => {
    const { instance, ps } = provider()
    await instance.listProcesses({ userIgnoreList: ['a'] }, { maxAgeMs: 5000 })
    await instance.listProcesses({ userIgnoreList: ['b'] }, { maxAgeMs: 5000 })
    expect(ps).toHaveBeenCalledTimes(2)
  })

  it('does not serve a failed scan to later callers', async () => {
    const { instance, ps } = provider()
    ps.mockRejectedValueOnce(new Error('ps failed'))
    await expect(instance.listProcesses({}, { maxAgeMs: 5000 })).rejects.toThrow()
    await expect(instance.listProcesses({}, { maxAgeMs: 5000 })).resolves.toEqual([])
    expect(ps).toHaveBeenCalledTimes(2)
  })
})
