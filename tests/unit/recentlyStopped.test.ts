import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { EventEmitter } from 'events'
import { RecentlyStoppedService } from '../../src/main/services/recentlyStopped'
import { Proc } from '../../src/shared/types'

describe('RecentlyStoppedService', () => {
  let tempDir: string
  let testFilePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdeck-recent-test-'))
    testFilePath = path.join(tempDir, 'recently_stopped.enc')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  const mockProc = (id: number, name: string, cmd: string, project = 'my-app'): Proc => ({
    pid: id,
    ppid: 1,
    name,
    command: cmd,
    cpu: 1.0,
    memMB: 50,
    uptimeSec: 100,
    cwd: '/Users/dev/my-app',
    project,
    projectPath: '/Users/dev/my-app',
    ports: [3000]
  })

  it('records stopped processes up to a cap of 20 in FIFO order', () => {
    const service = new RecentlyStoppedService({ filePath: testFilePath })

    const procs: Proc[] = []
    for (let i = 1; i <= 25; i++) {
      procs.push(mockProc(100 + i, `proc-${i}`, `node server-${i}.js`))
    }

    service.recordStopped(procs, false)
    const items = service.getItems()

    expect(items.length).toBe(20)
    // Most recent (proc-25) should be at index 0
    expect(items[0].command).toBe('node server-25.js')
    expect(items[19].command).toBe('node server-6.js')
  })

  it('updates duplicate command + cwd by moving it to the front', () => {
    const service = new RecentlyStoppedService({ filePath: testFilePath })

    service.recordStopped([mockProc(101, 'node', 'node server.js')], false)
    service.recordStopped([mockProc(102, 'vite', 'vite dev')], false)
    service.recordStopped([mockProc(103, 'node', 'node server.js')], false)

    const items = service.getItems()
    expect(items.length).toBe(2)
    expect(items[0].command).toBe('node server.js')
    expect(items[1].command).toBe('vite dev')
  })

  it('respects persistence toggle and encrypts data when enabled', () => {
    let encryptedData = ''
    const mockStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (plain: string) => {
        encryptedData = `ENC:${plain}`
        return Buffer.from(encryptedData)
      },
      decryptString: (buf: Buffer) => buf.toString().replace(/^ENC:/, '')
    }

    const service = new RecentlyStoppedService({
      filePath: testFilePath,
      safeStorage: mockStorage
    })

    // Persistence disabled -> no file written
    service.recordStopped([mockProc(101, 'node', 'node server.js')], false)
    expect(fs.existsSync(testFilePath)).toBe(false)

    // Persistence enabled -> writes encrypted file
    service.recordStopped([mockProc(102, 'python', 'python app.py')], true)
    expect(fs.existsSync(testFilePath)).toBe(true)

    // Verify recovery on new service instance
    const freshService = new RecentlyStoppedService({
      filePath: testFilePath,
      safeStorage: mockStorage
    })
    freshService.loadIfPersisted(true)
    expect(freshService.getItems().length).toBe(2)
    expect(freshService.getItems()[0].command).toBe('python app.py')
  })

  it('refuses to restart disallowed commands', async () => {
    const service = new RecentlyStoppedService({ filePath: testFilePath })
    // Record a process that somehow was recorded or modified with a non-allowlisted binary
    service.recordStopped([mockProc(999, 'malicious', 'rm -rf /')], false)
    const item = service.getItems()[0]

    const result = await service.restart(item.id, {
      customAllowlist: []
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DENIED')
      expect(result.error.message).toContain('not in allowlist')
    }
  })

  it('restarts allowed commands by spawning detached process', async () => {
    const spawnedArgs: { cmd: string; args: string[]; opts: unknown }[] = []
    const mockChild = Object.assign(new EventEmitter(), {
      pid: 4321,
      unref: vi.fn()
    })

    const mockSpawn = vi.fn().mockImplementation((cmd, args, opts) => {
      spawnedArgs.push({ cmd, args, opts })
      return mockChild
    })

    const service = new RecentlyStoppedService({
      filePath: testFilePath,
      spawn: mockSpawn as unknown as any
    })

    service.recordStopped([mockProc(101, 'node', 'node server.js --port 8080')], false)
    const item = service.getItems()[0]

    const result = await service.restart(item.id)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.pid).toBe(4321)
    }

    expect(mockSpawn).toHaveBeenCalledTimes(1)
    expect(spawnedArgs[0].cmd).toBe('node')
    expect(spawnedArgs[0].args).toEqual(['server.js', '--port', '8080'])
    expect(spawnedArgs[0].opts).toMatchObject({
      cwd: '/Users/dev/my-app',
      detached: true,
      stdio: 'ignore'
    })
    expect(mockChild.unref).toHaveBeenCalled()
  })

  it('clears all items and deletes persistence file if disabled', () => {
    const mockStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (p: string) => Buffer.from(p),
      decryptString: (b: Buffer) => b.toString()
    }
    const service = new RecentlyStoppedService({
      filePath: testFilePath,
      safeStorage: mockStorage
    })

    service.recordStopped([mockProc(101, 'node', 'node server.js')], true)
    expect(fs.existsSync(testFilePath)).toBe(true)

    service.clear(false)
    expect(service.getItems().length).toBe(0)
    expect(fs.existsSync(testFilePath)).toBe(false)
  })
})
