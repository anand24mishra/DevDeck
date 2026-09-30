import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { DarwinProcessProvider } from '../../src/main/providers/process.darwin'
import { terminate, defaultKillDeps } from '../../src/main/services/kill'
import { RecentlyStoppedService } from '../../src/main/services/recentlyStopped'

describe('RecentlyStopped Integration Test', () => {
  it('captures a stopped real process and restarts it successfully', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')
    const tmpScript = path.join(os.tmpdir(), `devdeck-test-${Date.now()}.js`)
    fs.writeFileSync(tmpScript, 'setInterval(() => {}, 1000);', 'utf-8')

    try {
      // 1. Spawn a real node process
      const child = spawn(process.execPath, [tmpScript], {
        stdio: 'ignore'
      })

    const pid = child.pid
    expect(pid).toBeDefined()
    if (!pid) return

    // Allow process to register in OS table
    await new Promise((r) => setTimeout(r, 200))
    expect(defaultKillDeps.alive(pid)).toBe(true)

    // 2. Fetch proc using DarwinProcessProvider
    const provider = new DarwinProcessProvider()
    const procs = await provider.listProcesses()
    const matching = procs.filter((p) => p.pid === pid)
    expect(matching.length).toBeGreaterThan(0)
    const proc = matching[0]

    // 3. Terminate process
    const report = await terminate([pid], defaultKillDeps)
    expect(report.stopped.includes(pid) || report.forced.includes(pid)).toBe(true)
    expect(defaultKillDeps.alive(pid)).toBe(false)

    // 4. Record into RecentlyStoppedService
    const recentService = new RecentlyStoppedService()
    recentService.recordStopped([proc], false)

    const items = recentService.getItems()
    expect(items.length).toBe(1)
    expect(items[0].command).toBe(proc.command)

    // 5. Restart process
    const restartResult = await recentService.restart(items[0].id)
    expect(restartResult.ok).toBe(true)
    if (!restartResult.ok || !restartResult.data.pid) return

    const restartedPid = restartResult.data.pid
    expect(defaultKillDeps.alive(restartedPid)).toBe(true)

    // 6. Clean up restarted process
    await terminate([restartedPid], defaultKillDeps)
    expect(defaultKillDeps.alive(restartedPid)).toBe(false)
    } finally {
      try {
        fs.unlinkSync(tmpScript)
      } catch {
        // ignore
      }
    }
  }, 15000)
})
