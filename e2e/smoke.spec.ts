import { _electron as electron, expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'

test('launch, search, native tray cancel, and confirmed process stop', async () => {
  test.skip(process.platform !== 'darwin', 'The shipped provider targets macOS')
  test.setTimeout(60_000)
  const fixture = await mkdtemp(path.join(homedir(), '.devdeck-smoke-'))
  const dataPath = path.join(fixture, 'app-data')
  await mkdir(dataPath)
  await writeFile(path.join(fixture, 'package.json'), '{}')
  const server = spawn(
    process.execPath,
    [
      '-e',
      `
    require('node:http').createServer((req, res) => res.end('test'))
      .listen(0, '127.0.0.1', function () { process.stdout.write(String(this.address().port)) })
  `
    ],
    {
      cwd: fixture,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', DEVDECK_SMOKE_TOKEN: 'fixture-secret' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined
  try {
    const [chunk] = await once(server.stdout!, 'data')
    const port = Number(chunk.toString().trim())
    expect(port).toBeGreaterThan(0)
    app = await electron.launch({
      args: [path.resolve('e2e/main.cjs')],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, DEVDECK_TEST_DATA: dataPath }
    })
    const page = await app.firstWindow()
    await expect(page).toHaveTitle('DevDeck')
    await expect(page.getByRole('button', { name: /^Processes/ })).toBeVisible()
    const project = page.getByRole('region', {
      name: `Project ${path.basename(fixture)}`,
      exact: true
    })
    await expect(project).toBeVisible({ timeout: 15_000 })
    await page.getByRole('textbox', { name: 'Filter processes' }).fill(String(port))
    await expect(page.locator('.process-row-container')).toHaveCount(1)

    await expect
      .poll(async () =>
        app!.evaluate(() => {
          const root = globalThis as unknown as {
            __devdeckTrayMenu?: { items: { label: string; enabled: boolean }[] }
          }
          return root.__devdeckTrayMenu?.items.some(
            (item) => item.label === 'Stop All Dev Processes' && item.enabled
          )
        })
      )
      .toBe(true)
    await app.evaluate(() => {
      const root = globalThis as unknown as {
        __devdeckTrayMenu: { items: { label: string; click: () => void }[] }
      }
      root.__devdeckTrayMenu.items.find((item) => item.label === 'Stop All Dev Processes')!.click()
    })
    await expect
      .poll(async () =>
        app!.evaluate(() => {
          const root = globalThis as unknown as {
            __devdeckDialogs: {
              message: string
              defaultId: number
              cancelId: number
              detail: string
            }[]
          }
          return root.__devdeckDialogs[0]
        })
      )
      .toMatchObject({
        defaultId: 0,
        cancelId: 0,
        detail: expect.stringContaining(path.basename(fixture))
      })
    expect(server.exitCode).toBeNull()
    process.kill(server.pid!, 0)

    await page.getByRole('textbox', { name: 'Free a port', exact: true }).fill(`localhost:${port}`)
    await expect(page.locator('.port-owner')).toContainText(String(port))
    await page.locator('.port-owner .row-stop-btn').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    process.kill(server.pid!, 0)
    await page.getByRole('textbox', { name: 'Free a port', exact: true }).fill('')

    await page.getByRole('button', { name: 'Open settings', exact: true }).click()
    await page.getByLabel('Enable environment viewer (values hidden by default)').check()
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    await page.locator('.process-row').click()
    const details = page.getByRole('region', { name: 'Process details', exact: true })
    await details.getByRole('button', { name: 'Show environment', exact: true }).click()
    const environment = page.getByRole('region', { name: 'Process environment', exact: true })
    await expect(environment.getByText('fixture-secret', { exact: true })).toHaveCount(0)
    await environment
      .getByRole('button', { name: 'Reveal DEVDECK_SMOKE_TOKEN', exact: true })
      .click()
    await expect(environment.getByText('fixture-secret', { exact: true })).toBeVisible()
    await details.getByRole('button', { name: 'Close environment', exact: true }).click()
    await details.getByRole('button', { name: 'Show environment', exact: true }).click()
    await expect(
      environment.getByRole('button', { name: 'Reveal DEVDECK_SMOKE_TOKEN', exact: true })
    ).toBeVisible()
    await expect(environment.getByText('fixture-secret', { exact: true })).toHaveCount(0)
    await page.locator('.process-row').click()

    await page.locator('.row-stop-btn').click()
    const confirmation = page.getByRole('dialog')
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
    process.kill(server.pid!, 0)
    await page.locator('.row-stop-btn').click()
    const exited = once(server, 'exit')
    await confirmation.getByRole('button', { name: 'Stop', exact: true }).click()
    await exited
    await expect(confirmation).not.toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.process-row-container')).toHaveCount(0)
  } finally {
    await app?.close()
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM')
    await rm(fixture, { recursive: true, force: true })
  }
})
