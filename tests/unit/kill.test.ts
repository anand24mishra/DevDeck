import { describe, it, expect, vi } from 'vitest'
import { terminate, validIdentities, type KillDeps } from '../../src/main/services/kill'
import type { ProcessIdentity } from '../../src/shared/types'

const original: ProcessIdentity = {
  pid: 501,
  startTime: 'Wed Sep 30 14:00:00 2026',
  command: 'node server.js'
}
function dependencies(): KillDeps {
  return {
    revalidate: vi.fn(async () => ({ ok: [original], refused: [] })),
    signal: vi.fn(() => true),
    alive: vi.fn(() => false),
    sleep: vi.fn(async () => {})
  }
}
describe('safe process termination', () => {
  it('gives a normal stop three seconds before reporting success', async () => {
    const deps = dependencies()
    expect((await terminate([original], deps)).stopped).toEqual([501])
    expect(deps.signal).toHaveBeenCalledExactlyOnceWith(501, 'SIGTERM')
    expect(deps.sleep).toHaveBeenCalledWith(3000)
  })
  it.each(['startTime', 'command'] as const)(
    'refuses a changed %s before any signal',
    async (field) => {
      const deps = dependencies()
      const report = await terminate([{ ...original, [field]: 'different' }], deps)
      expect(report.refusalReasons?.[501]).toBe('identity-changed')
      expect(deps.signal).not.toHaveBeenCalled()
    }
  )
  it.each(['startTime', 'command'] as const)(
    'refuses a changed %s during the grace period',
    async (field) => {
      const deps = dependencies()
      vi.mocked(deps.alive).mockReturnValue(true)
      vi.mocked(deps.revalidate)
        .mockResolvedValueOnce({ ok: [original], refused: [] })
        .mockResolvedValue({ ok: [{ ...original, [field]: 'changed' }], refused: [] })
      const report = await terminate([original], deps)
      expect(report.refusalReasons?.[501]).toBe('identity-changed')
      expect(deps.signal).toHaveBeenCalledExactlyOnceWith(501, 'SIGTERM')
    }
  )
  it('force stops only verified survivors and accounts for failed signals', async () => {
    const deps = dependencies()
    vi.mocked(deps.alive).mockReturnValueOnce(true).mockReturnValueOnce(false)
    expect((await terminate([original], deps)).forced).toEqual([501])
    expect(deps.signal).toHaveBeenLastCalledWith(501, 'SIGKILL')
    vi.mocked(deps.signal).mockReturnValue(false)
    expect((await terminate([original], deps)).stillRunning).toEqual([501])
  })
  it('refuses an unmanageable process without signaling', async () => {
    const deps = dependencies()
    vi.mocked(deps.revalidate).mockResolvedValue({ ok: [], refused: [501] })
    expect((await terminate([original], deps)).refused).toEqual([501])
    expect(deps.signal).not.toHaveBeenCalled()
  })
  it('rejects malformed IPC identities and extra fields without throwing', () => {
    for (const invalid of [
      null,
      {},
      [null],
      [{ pid: 1 }],
      [{ ...original, extra: true }],
      [{ ...original, startTime: '' }],
      [original, original],
      Array(501).fill(original)
    ]) {
      expect(validIdentities(invalid)).toBe(false)
    }
    expect(validIdentities([original])).toBe(true)
  })
})
