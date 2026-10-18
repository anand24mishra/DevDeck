import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
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
    "console.log('launch-ready'); setInterval(()=>console.log('still-running'),500)"
  )
  const app = await electron.launch({
    args: [path.resolve('e2e/main.cjs')],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, DEVDECK_TEST_DATA: data }
  })
  let pid: number | undefined
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    })
    const command = `"${process.execPath}" server.cjs`
    const saved = await page.evaluate(
      async ({ root, command }) =>
        window.api.saveProfile({
          id: 'fixture',
          name: 'Fixture',
          members: [{ name: 'Web', cwd: root, command, ports: [] }]
        }),
      { root, command }
    )
    expect(saved.ok).toBe(true)
    const started = await page.evaluate(() => window.api.profileAction('fixture', 'start'))
    expect(started.ok).toBe(true)
    if (!started.ok) throw new Error('Start failed')
    expect(started.data[0].ok, started.data[0].message).toBe(true)
    pid = started.data[0].pid
    expect(pid).toBeGreaterThan(1)
    await expect
      .poll(async () => {
        const result = await page.evaluate(() => window.api.getProcesses())
        return result.ok && result.data.some((p) => p.pid === pid && p.manageable !== false)
      })
      .toBe(true)
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
