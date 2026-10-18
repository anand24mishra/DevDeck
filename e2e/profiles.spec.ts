import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

test('profile launches independently and stops through normal identity guards', async () => {
  test.skip(process.platform !== 'darwin')
  test.setTimeout(60000)
  const root = await mkdtemp(path.join(homedir(), '.devdeck-launch-'))
  const data = path.join(root, 'data')
  await mkdir(data)
  await writeFile(path.join(root, 'package.json'), '{}')
  await writeFile(
    path.join(root, 'server.cjs'),
    "console.log('launch-ready'); const output=setInterval(()=>console.log('still-running'),500); setTimeout(()=>{clearInterval(output); console.log('output-complete')},1500); setInterval(()=>{},1000)"
  )
  let app = await electron.launch({
    args: [path.resolve('e2e/main.cjs')],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, DEVDECK_TEST_DATA: data }
  })
  let pid: number | undefined
  try {
    let page = await app.firstWindow()
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
    const command = `"${process.execPath}" server.cjs "argument with spaces"`
    const saved = await page.evaluate(
      async ({ root, command }) =>
        window.api.saveProfile({
          id: 'fixture',
          name: 'Fixture',
          members: [
            { name: 'Web', cwd: root, command, ports: [] },
            {
              name: 'Missing folder',
              cwd: root + '/missing',
              command: 'node example.js',
              ports: []
            }
          ]
        }),
      { root, command }
    )
    expect(saved.ok).toBe(true)
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    })
    const cancelled = await page.evaluate(() => window.api.profileAction('fixture', 'start'))
    expect(cancelled.ok && cancelled.data).toEqual([])
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
    const started = await page.evaluate(() => window.api.profileAction('fixture', 'start'))
    expect(started.ok).toBe(true)
    if (!started.ok) throw new Error('Start failed')
    expect(started.data[0].ok, started.data[0].message).toBe(true)
    expect(started.data[1].ok).toBe(false)
    pid = started.data[0].pid
    expect(pid).toBeGreaterThan(1)
    await expect
      .poll(async () => {
        const result = await page.evaluate(() => window.api.getProcesses())
        return result.ok && result.data.some((p) => p.pid === pid && p.manageable !== false)
      })
      .toBe(true)
    const captured = await page.evaluate(() => window.api.listLaunches())
    expect(captured.ok && captured.data.length).toBe(1)
    const launchId = captured.ok ? captured.data[0].id : ''
    await expect
      .poll(async () => {
        const logs = await page.evaluate((id) => window.api.launchLogs(id), launchId)
        return logs.ok && logs.data.some((line) => line.includes('still-running'))
      })
      .toBe(true)
    const cli = async (args: string[]): Promise<string> => {
      const result = await promisify(execFile)(
        process.execPath,
        [path.resolve('cli/devdeck.cjs'), ...args],
        { env: { ...process.env, DEVDECK_DATA_DIR: data }, timeout: 15000 }
      )
      return result.stdout
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide())
    const listed = JSON.parse(await cli(['ls', '--json']))
    expect(listed.some((p) => p.pid === pid && p.command === '[hidden]')).toBe(true)
    expect(await cli(['logs', 'Web'])).toContain('still-running')
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
    })
    expect(JSON.parse(await cli(['stop', `pid:${pid}`, '--json'])).cancelled).toBe(true)
    process.kill(pid!, 0)
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
    // Wait for the fixture's explicit quiet phase before closing its output receiver.
    await expect
      .poll(async () => {
        const logs = await page.evaluate((id) => window.api.launchLogs(id), launchId)
        return logs.ok && logs.data.some((line) => line.includes('output-complete'))
      })
      .toBe(true)
    // A quiet fixture can survive app quit; captured logs intentionally do not persist.
    const stored = JSON.parse(await readFile(path.join(data, 'settings.json'), 'utf8'))
    expect(
      !!stored.profileLaunches?.fixture?.Web,
      'Captured launch identity must be persisted'
    ).toBe(true)
    await app.close()
    app = await electron.launch({
      args: [path.resolve('e2e/main.cjs')],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, DEVDECK_TEST_DATA: data }
    })
    page = await app.firstWindow()
    const statuses = await page.evaluate(() => window.api.listProfiles())
    const fresh = await page.evaluate(() => window.api.getProcesses())
    const visible = fresh.ok ? fresh.data.find((p) => p.pid === pid) : undefined
    let alive = false
    try {
      process.kill(pid!, 0)
      alive = true
    } catch {
      /* Fixture exited. */
    }
    expect(
      statuses.ok && statuses.data[0].members[0].running,
      JSON.stringify({
        alive,
        visible: !!visible,
        commandMatches: visible?.command === stored.profileLaunches.fixture.Web.command,
        startMatches: visible?.startTime === stored.profileLaunches.fixture.Web.startTime
      })
    ).toBe(true)
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
    const stopped = await page.evaluate(() => window.api.profileAction('fixture', 'stop'))
    expect(stopped.ok && stopped.data[0].message).toBe('Stopped')
    expect(() => process.kill(pid!, 0)).toThrow()
  } finally {
    if (pid) {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        /* Already stopped. */
      }
    }
    await app.close()
    await rm(root, { recursive: true, force: true })
  }
})
