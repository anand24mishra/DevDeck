import { expect, it } from 'vitest'
import { parseGitHead } from '../../src/main/services/context'

it('reads branch and detached HEAD values but never returns arbitrary file contents', () => {
  expect(parseGitHead('ref: refs/heads/feature/test\n')).toBe('feature/test')
  expect(parseGitHead('a'.repeat(40))).toBe('detached aaaaaaaa')
  expect(parseGitHead('TOKEN=secret')).toBeUndefined()
  expect(parseGitHead('ref: refs/heads/a\nSECRET=value')).toBeUndefined()
})

it('detects declared runtimes without executing project files', async () => {
  const fs = await import('node:fs/promises'),
    os = await import('node:os'),
    path = await import('node:path')
  const { runtimeHints } = await import('../../src/main/services/runtime')
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devdeck-runtime-'))
  try {
    await fs.writeFile(path.join(root, '.nvmrc'), '20')
    await fs.writeFile(path.join(root, 'go.mod'), 'module example\ngo 1.23\n')
    await fs.writeFile(path.join(root, 'rust-toolchain.toml'), '[toolchain]\nchannel = "stable"')
    await fs.writeFile(path.join(root, '.java-version'), '21')
    expect(await runtimeHints(root)).toEqual([
      'Node requested: 20',
      'Go requested: 1.23',
      'Rust toolchain: stable',
      'Java requested: 21'
    ])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
