import { describe, it, expect } from 'vitest'
import {
  isProcessAllowed,
  extractBinaryName,
  protectedProcessTree
} from '../../src/main/security/allowlist'

describe('allowlist security model', () => {
  it('extracts binary names accurately even with spaces and quotes', () => {
    expect(extractBinaryName('node server.js').binaryName).toBe('node')
    expect(extractBinaryName('/usr/local/bin/node index.js').binaryName).toBe('node')
    expect(extractBinaryName('"/Applications/My Tools/node" app.js').binaryName).toBe('node')
    expect(extractBinaryName("'/opt/homebrew/bin/python3' main.py").binaryName).toBe('python3')
  })

  it('allows standard dev binaries', () => {
    expect(isProcessAllowed(1234, 'node server.js').allowed).toBe(true)
    expect(isProcessAllowed(1235, 'python3 -m http.server').allowed).toBe(true)
    expect(isProcessAllowed(1236, 'vite dev').allowed).toBe(true)
    expect(isProcessAllowed(1237, 'cargo run').allowed).toBe(true)
  })

  it('rejects system binaries and non-allowlisted processes', () => {
    expect(isProcessAllowed(999, 'bash script.sh').allowed).toBe(false)
    expect(isProcessAllowed(998, 'zsh').allowed).toBe(false)
    expect(isProcessAllowed(997, 'curl https://example.com').allowed).toBe(false)
  })

  it('rejects PID <= 1 and self PID', () => {
    expect(isProcessAllowed(1, 'node server.js').allowed).toBe(false)
    expect(isProcessAllowed(0, 'node server.js').allowed).toBe(false)
    expect(isProcessAllowed(5000, 'node server.js', { currentPid: 5000 }).allowed).toBe(false)
  })

  it('skips executables inside .app/Contents/ bundles unless custom allowlisted', () => {
    const appPath = '/Applications/Visual Studio Code.app/Contents/MacOS/node server.js'
    expect(isProcessAllowed(2345, appPath).allowed).toBe(false)

    // With explicit custom allowlist
    expect(isProcessAllowed(2345, appPath, { customAllowlist: ['node'] }).allowed).toBe(true)
  })

  it('honors user ignore list with priority', () => {
    expect(
      isProcessAllowed(3456, 'node background-worker.js', { userIgnoreList: ['node'] }).allowed
    ).toBe(false)
    expect(isProcessAllowed(3457, 'python3 test.py', { userIgnoreList: ['test.py'] }).allowed).toBe(
      false
    )
  })
})

describe('DevDeck process-tree protection', () => {
  it('blocks self, parent, child, and out-of-order grandchild even with custom allowlist', () => {
    const protectedPids = protectedProcessTree(
      [
        { pid: 13, ppid: 12 },
        { pid: 10, ppid: 9 },
        { pid: 12, ppid: 10 },
        { pid: 14, ppid: 9 }
      ],
      { pid: 10, ppid: 9 }
    )
    for (const pid of [9, 10, 12, 13]) {
      expect(
        isProcessAllowed(pid, 'node dev.js', { protectedPids, customAllowlist: ['node'] }).allowed
      ).toBe(false)
    }
    expect(isProcessAllowed(14, 'node sibling.js', { protectedPids }).allowed).toBe(true)
    expect(protectedProcessTree([{ pid: 15, ppid: 10 }], { pid: 10, ppid: 9 }).has(15)).toBe(true)
  })
})
