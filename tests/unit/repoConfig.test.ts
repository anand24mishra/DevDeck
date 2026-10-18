import { describe, it, expect, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, dialog: {} }))
import { parseRepoConfig } from '../../src/main/services/repoConfig'
const config = {
  version: 1,
  name: 'Web',
  expectedPorts: [3000],
  start: [{ name: 'Web', command: 'npm run dev' }]
}
describe('repository command approval identity', () => {
  it('binds approval to root and exact config bytes', () => {
    const raw = JSON.stringify(config)
    const one = parseRepoConfig(raw, '/tmp/web')
    expect(one.members[0].cwd).toBe('/tmp/web')
    expect(parseRepoConfig(raw + ' ', '/tmp/web').repo!.hash).not.toBe(one.repo!.hash)
    expect(parseRepoConfig(raw, '/tmp/other').repo!.hash).not.toBe(one.repo!.hash)
  })
  it('rejects traversal, unknown fields and oversized files', () => {
    expect(() =>
      parseRepoConfig(
        JSON.stringify({ ...config, start: [{ name: 'x', command: 'node x', cwd: '..' }] }),
        '/tmp/web'
      )
    ).toThrow()
    expect(() =>
      parseRepoConfig(JSON.stringify({ ...config, postinstall: 'bad' }), '/tmp/web')
    ).toThrow()
    expect(() => parseRepoConfig(' '.repeat(65537), '/tmp/web')).toThrow()
  })
})
