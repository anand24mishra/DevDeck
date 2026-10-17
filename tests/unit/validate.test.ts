import { describe, it, expect } from 'vitest'
import { isExpectedPage, validIpcInput } from '../../src/main/security/validate'

describe('IPC boundary', () => {
  it('rejects file and development URL prefix lookalikes', () => {
    const expected =
      'file:///Applications/DevDeck.app/Contents/Resources/app.asar/out/renderer/index.html'
    expect(isExpectedPage(expected, expected)).toBe(true)
    for (const actual of [
      undefined,
      'file:///tmp/other.html',
      expected + '/evil',
      expected + '?other'
    ]) {
      expect(isExpectedPage(actual, expected)).toBe(false)
    }
    expect(isExpectedPage('http://localhost:5173.evil.test/', 'http://localhost:5173/')).toBe(false)
  })
  it('rejects malformed and extra fields before destructuring older handler inputs', () => {
    for (const channel of [
      'procs:stop',
      'procs:stopProject',
      'procs:stopAll',
      'recent:restart',
      'docker:action',
      'docker:logs:start',
      'docker:logs:stop',
      'settings:set'
    ]) {
      for (const value of [undefined, null, [], 3, 'bad', { unexpected: true }]) {
        expect(validIpcInput(channel, value)).toBe(false)
      }
    }
    expect(validIpcInput('docker:list', {})).toBe(false)
    expect(validIpcInput('unknown:channel', undefined)).toBe(false)
    expect(validIpcInput('recent:restart', { id: 'known', unexpected: true })).toBe(false)
    expect(validIpcInput('docker:action', { id: 'abcdef123456', action: 'exec' })).toBe(false)
  })
  it('validates settings edits strictly without changing load-time recovery', () => {
    expect(validIpcInput('settings:set', { theme: 'dark', openAtLogin: false })).toBe(true)
    for (const value of [
      { theme: 'neon' },
      { openAtLogin: 1 },
      { ignoreList: [null] },
      { customAllowlist: Array(201).fill('node') },
      { dockerSocketPath: '../docker.sock' }
    ]) {
      expect(validIpcInput('settings:set', value)).toBe(false)
    }
  })
})
