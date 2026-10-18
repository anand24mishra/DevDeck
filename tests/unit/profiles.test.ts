import { describe, it, expect } from 'vitest'
import { validProfile, profileProcesses, equivalentCommand } from '../../src/shared/profiles'
import type { Proc } from '../../src/shared/types'
const profile = {
  id: 'web',
  name: 'Web',
  members: [{ name: 'Dev', command: 'npm run dev', cwd: '/tmp/project', ports: [3000] }]
}
describe('profile boundary', () => {
  it('refuses mixed container commands, extra fields and invalid ports', () => {
    expect(validProfile(profile)).toBe(true)
    expect(
      validProfile({
        ...profile,
        members: [{ ...profile.members[0], containerId: 'abcdef123456' }]
      })
    ).toBe(false)
    expect(validProfile({ ...profile, members: [{ ...profile.members[0], ports: [0] }] })).toBe(
      false
    )
    expect(validProfile({ ...profile, secret: 'unexpected' })).toBe(false)
  })
  it('matches only manageable project members with matching commands or ports', () => {
    const p = { pid: 10, cwd: '/tmp/project', ports: [3000], command: 'node web.js' } as Proc
    expect(
      profileProcesses(profile.members[0], [
        p,
        { ...p, pid: 11, manageable: false },
        { ...p, pid: 12, cwd: '/tmp/other' }
      ]).map((p) => p.pid)
    ).toEqual([10])
  })
})

it('matches normal absolute executable representations without relying on launch memory', () => {
  expect(equivalentCommand('node server.cjs', '/opt/homebrew/bin/node server.cjs')).toBe(true)
  expect(
    equivalentCommand(
      'npm run dev',
      '/opt/homebrew/bin/node /usr/local/lib/npm/bin/npm-cli.js run dev'
    )
  ).toBe(true)
  expect(equivalentCommand('node server.cjs', '/opt/homebrew/bin/node other.cjs')).toBe(false)
})
