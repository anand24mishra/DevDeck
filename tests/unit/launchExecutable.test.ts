import { it, expect } from 'vitest'
import { safeResolvedExecutable } from '../../src/main/security/launchExecutable'
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
