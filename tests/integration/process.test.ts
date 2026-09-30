import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { DarwinProcessProvider } from '../../src/main/providers/process.darwin'

describe('DarwinProcessProvider Integration', () => {
  it('detects a real spawned child node server on an assigned port', async () => {
    // Choose an unused port
    const testPort = 49281
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
        const http = require('http');
        const server = http.createServer((req, res) => res.end('ok'));
        server.listen(${testPort}, '127.0.0.1', () => {
          if (process.send) process.send('ready');
          console.log('ready');
        });
        `
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    await new Promise<void>((resolve, reject) => {
      child.stdout?.on('data', (d) => {
        if (d.toString().includes('ready')) resolve()
      })
      child.on('error', reject)
      setTimeout(() => resolve(), 1000)
    })

    const provider = new DarwinProcessProvider()

    try {
      const procs = await provider.listProcesses()
      const found = procs.find((p) => p.pid === child.pid)

      expect(found).toBeDefined()
      if (found) {
        expect(found.ports).toContain(testPort)
        expect(found.name).toBe('node')
      }
    } finally {
      child.kill('SIGTERM')
    }
  })
})
