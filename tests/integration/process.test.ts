import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { DarwinProcessProvider } from '../../src/main/providers/process.darwin'

describe('DarwinProcessProvider Integration', () => {
  it('detects a real spawned child node server on an assigned port', async () => {
    // Choose an unused port
    let testPort = 0
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
        const http = require('http');
        const server = http.createServer((req, res) => res.end('ok'));
        server.listen(0, '127.0.0.1', () => {
          if (process.send) process.send('ready');
          console.log('ready:'+server.address().port);
        });
        `
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    )

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('Server did not become ready'))
      }, 3000)
      child.stdout?.on('data', (d) => {
        const match = d.toString().match(/ready:(\d+)/)
        if (match) {
          testPort = Number(match[1])
          clearTimeout(timer)
          resolve()
        }
      })
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`Fixture exited: ${code}`))
      })
    })

    const provider = new DarwinProcessProvider({ pid: 0, ppid: 0 })

    try {
      const procs = await provider.listProcesses()
      const found = procs.find((p) => p.pid === child.pid)

      expect(found).toBeDefined()
      if (found) {
        expect(found.ports).toContain(testPort)
        expect(found.name).toBe('node')
        const owners = await provider.lookupPort(testPort)
        expect(
          owners.some((owner) => owner.pid === child.pid && owner.address === '127.0.0.1')
        ).toBe(true)
      }
    } finally {
      child.kill('SIGTERM')
    }
  })
})
