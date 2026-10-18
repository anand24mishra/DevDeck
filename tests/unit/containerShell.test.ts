import { describe, it, expect, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
import { containerShellArguments, TERMINAL_BRIDGE } from '../../src/main/services/containerShell'
describe('interactive shell arguments', () => {
  it('keeps socket paths as a single argument and refuses injected ids', () => {
    expect(containerShellArguments('/tmp/a space.sock', 'abcdef123456', 'sh')).toEqual([
      '--host',
      'unix:///tmp/a space.sock',
      'exec',
      '-it',
      'abcdef123456',
      'sh'
    ])
    expect(() => containerShellArguments('/tmp/socket', 'abc;rm', 'bash')).toThrow()
    expect(TERMINAL_BRIDGE).toContain("Process.spawn(config.fetch('file'), *config.fetch('args'))")
  })
})
