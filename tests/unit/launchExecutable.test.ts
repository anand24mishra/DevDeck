import { it, expect } from 'vitest'
import { safeResolvedExecutable, spawnedIdentity } from '../../src/main/security/launchExecutable'
import type { Settings } from '../../src/shared/types'
it('permits known package shims but refuses app and shell aliases', () => {
  const settings = { ignoreList: [], customAllowlist: [] } as unknown as Settings
  expect(
    safeResolvedExecutable(
      '/usr/local/bin/npm',
      '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
      ['run', 'dev'],
      settings
    )
  ).toBe(true)
  expect(
    safeResolvedExecutable(
      '/usr/local/bin/node',
      '/Applications/Test.app/Contents/node',
      [],
      settings
    )
  ).toBe(false)
  expect(safeResolvedExecutable('/usr/local/bin/node', '/bin/sh', [], settings)).toBe(false)
  expect(
    safeResolvedExecutable('/usr/local/bin/cargo', '/Users/test/.cargo/bin/rustup', [], settings)
  ).toBe(true)
})

it('binds launch snapshots to the live direct child and rejects recycled or malformed snapshots', () => {
  const child = { pid: 99, exitCode: null, signalCode: null }
  const output = '  88 Mon Oct 19 04:30:00 2026 /usr/local/bin/node server.js'
  expect(spawnedIdentity(output, 88, child)).toEqual({
    pid: 99,
    startTime: 'Mon Oct 19 04:30:00 2026',
    command: '/usr/local/bin/node server.js'
  })
  expect(spawnedIdentity(output, 77, child)).toBeUndefined()
  expect(spawnedIdentity(output, 88, { ...child, exitCode: 0 })).toBeUndefined()
  expect(spawnedIdentity(output, 88, { ...child, signalCode: 'SIGTERM' })).toBeUndefined()
  expect(spawnedIdentity('malformed', 88, child)).toBeUndefined()
  expect(spawnedIdentity(output, 88, { ...child, pid: undefined })).toBeUndefined()
})
