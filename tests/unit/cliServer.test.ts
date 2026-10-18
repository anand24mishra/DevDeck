import { it, expect } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import net from 'net'
import { CliServer, validCliRequest } from '../../src/main/services/cliServer'
it('validates commands and requires a token on a user-only socket', async () => {
  expect(validCliRequest({ command: 'stop', args: ['pid:123'], yes: true })).toBe(true)
  expect(validCliRequest({ command: 'eval', args: [] })).toBe(false)
  expect(validCliRequest({ command: 'port', args: ['65536'] })).toBe(false)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devdeck-cli-test-')),
    server = new CliServer()
  const calls: unknown[] = []
  try {
    await server.start(root, async (request) => {
      calls.push(request)
      return { ok: true, data: [] }
    })
    const auth = JSON.parse(await fs.readFile(path.join(root, 'cli.json'), 'utf8'))
    expect((await fs.stat(auth.socketPath)).mode & 0o777).toBe(0o600)
    const send = (token: string): Promise<{ ok: boolean }> =>
      new Promise((resolve, reject) => {
        const socket = net.createConnection(auth.socketPath)
        let body = ''
        socket.on('error', reject)
        socket.on('connect', () =>
          socket.write(JSON.stringify({ token, command: 'ls', args: [] }) + '\n')
        )
        socket.on('data', (chunk) => (body += chunk.toString()))
        socket.on('end', () => resolve(JSON.parse(body)))
      })
    expect((await send('0'.repeat(64))).ok).toBe(false)
    expect(calls).toHaveLength(0)
    expect((await send(auth.token)).ok).toBe(true)
    expect(calls).toHaveLength(1)
  } finally {
    await server.stop()
    await fs.rm(root, { recursive: true, force: true })
  }
})
