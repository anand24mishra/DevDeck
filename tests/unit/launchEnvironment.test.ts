import { describe, expect, it } from 'vitest'
import { launchEnvironment } from '../../src/main/services/launcher'

describe('launch environment', () => {
  it('keeps normal variables and drops Electron ones', () => {
    const env = launchEnvironment({
      PATH: '/usr/bin',
      HOME: '/Users/a',
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ATTACH_CONSOLE: '1'
    })
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/Users/a' })
  })
})
