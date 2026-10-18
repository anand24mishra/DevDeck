import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
test('feature UX: scoped navigation, profile form, filter recovery, modal focus and concealed details', async () => {
  test.setTimeout(90000)
  const root = await mkdtemp(path.join(homedir(), '.devdeck-ux-')),
    data = path.join(root, 'data')
  await mkdir(data)
  await writeFile(path.join(root, 'package.json'), '{}')
  await mkdir('/tmp/devdeck-ux', { recursive: true })
  const app = await electron.launch({
    args: [path.resolve('e2e/main.cjs')],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      DEVDECK_TEST_DATA: data,
      DEVDECK_TEST_UX: '1',
      DEVDECK_TEST_PROJECT: root
    }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Skip guide', exact: true }).click()
    await expect(page.locator('.process-row')).toHaveCount(3)
    await page.getByText('Filters', { exact: true }).click()
    await page.getByLabel('Socket protocol').selectOption('UDP')
    await expect(page.getByText('No processes match these filters', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click()
    await expect(page.locator('.process-row')).toHaveCount(3)
    await page.getByText('Filters', { exact: true }).click()
    await page.screenshot({ path: '/tmp/devdeck-ux/processes-after.png' })
    await page.getByRole('button', { name: 'Open settings', exact: true }).click()
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
    await expect(settings.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    await settings.getByLabel('Global shortcut', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(settings.getByLabel('Global shortcut', { exact: true })).not.toBeFocused()
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press('Tab')
      expect(await settings.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await settings
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('button', { name: 'Notifications', exact: true })
      .click()
    await settings.getByLabel('Memory warning (MB)', { exact: true }).fill('3')
    await page.keyboard.press('Tab')
    await expect(settings.getByRole('alert')).toContainText('whole memory limit')
    await expect(settings.getByLabel('Memory warning (MB)', { exact: true })).toHaveValue('4096')
    await settings
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('button', { name: 'General', exact: true })
      .click()
    await settings.getByLabel('Interface theme').selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.waitForTimeout(250)
    await page.screenshot({ path: '/tmp/devdeck-ux/settings-dark-after.png' })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Open settings', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Profiles', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Stop all', exact: true })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Filter processes', exact: true })).toHaveCount(
      0
    )
    await page.getByRole('button', { name: 'New profile', exact: true }).click()
    const form = page.getByRole('form', { name: 'Profile editor' })
    await form.getByLabel('Profile name', { exact: true }).fill('Local stack')
    await form.getByLabel('Member 1 name', { exact: true }).fill('Web')
    await form.getByLabel('Member 1 project folder', { exact: true }).fill(root)
    await form.getByLabel('Member 1 start command', { exact: true }).fill('npm run dev')
    await expect(form.getByLabel('Member 1 start command', { exact: true })).toHaveAttribute(
      'type',
      'password'
    )
    await form.getByRole('button', { name: 'Reveal', exact: true }).click()
    await expect(form.getByLabel('Member 1 start command', { exact: true })).toHaveAttribute(
      'type',
      'text'
    )
    await page.getByRole('button', { name: 'Docker', exact: false }).first().click()
    await page.getByRole('button', { name: 'Profiles', exact: true }).click()
    await expect(form.getByLabel('Member 1 start command', { exact: true })).toHaveAttribute(
      'type',
      'password'
    )
    await expect(form.getByLabel('Member 1 start command', { exact: true })).toHaveValue(
      'npm run dev'
    )
    await form.getByLabel('Member 1 expected ports', { exact: true }).fill('0')
    await form.getByRole('button', { name: 'Save profile', exact: true }).click()
    await expect(form.getByRole('alert')).toContainText('65535')
    await form.getByLabel('Member 1 expected ports', { exact: true }).fill('3001')
    await page.screenshot({ path: '/tmp/devdeck-ux/profile-editor-after.png' })
    await form.getByRole('button', { name: 'Save profile', exact: true }).click()
    await expect(form).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Local stack', exact: true })).toBeVisible()
    await page.screenshot({ path: '/tmp/devdeck-ux/profiles-after.png' })
    await page.getByText('Start a process and capture output', { exact: true }).click()
    const launch = page.getByRole('region', { name: 'Launch and capture' })
    await launch
      .getByLabel('Start command', { exact: true })
      .fill('node server.js --token=synthetic')
    await launch.getByRole('button', { name: 'Reveal', exact: true }).click()
    await page.getByRole('button', { name: 'Docker', exact: false }).first().click()
    await page.getByRole('button', { name: 'Profiles', exact: true }).click()
    await expect(launch.getByLabel('Start command', { exact: true })).toHaveAttribute(
      'type',
      'password'
    )
    await expect(launch.getByLabel('Start command', { exact: true })).toHaveValue(
      'node server.js --token=synthetic'
    )
    await page.getByText('Start a process and capture output', { exact: true }).click()
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('profiles:action')
      ipcMain.handle('profiles:action', () => ({
        ok: false,
        error: { code: 'TEST_REFUSAL', message: 'Review the changed profile before starting.' }
      }))
    })
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Review the changed profile')
    await page.getByRole('button', { name: 'Docker', exact: false }).first().click()
    await page.getByRole('button', { name: 'Profiles', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Review the changed profile')
    await page.getByRole('button', { name: 'Docker', exact: false }).first().click()
    await expect(page.locator('.container-row')).toHaveCount(3)
    const row = page.locator('.container-row').first()
    await row.getByRole('button', { name: 'Details', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Container inspection' })).toBeVisible()
    await page
      .getByRole('region', { name: 'Container inspection' })
      .getByText('Environment', { exact: true })
      .click()
    await expect(page.getByText('synthetic-only', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reveal POSTGRES_PASSWORD', exact: true }).click()
    await expect(page.getByText('POSTGRES_PASSWORD=synthetic-only', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Details', exact: true }).click()
    await row.getByRole('button', { name: 'Details', exact: true }).click()
    await expect(page.getByText('POSTGRES_PASSWORD=synthetic-only', { exact: true })).toHaveCount(0)
    await row.getByRole('button', { name: 'Details', exact: true }).click()
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('docker:stats', {
        id: 'abcdef123450',
        sample: { at: Date.now(), cpu: 3.2, memMB: 128, rxBytes: 1048576, txBytes: 2097152 }
      })
    )
    await page.screenshot({ path: '/tmp/devdeck-ux/docker-after.png' })
    await row.getByRole('button', { name: 'Logs', exact: true }).click()
    const logs = page.getByRole('dialog', { name: 'Logs for web' })
    await expect(logs.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    await expect(logs).toContainText('Ready to accept connections')
    await logs.getByRole('button', { name: 'Pause scrolling', exact: true }).click()
    await expect(logs.getByRole('button', { name: 'Follow output', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await page.waitForTimeout(200)
    await page.screenshot({ path: '/tmp/devdeck-ux/logs-after.png' })
    await page.keyboard.press('Escape')
    await page
      .getByRole('button', { name: /Processes/ })
      .first()
      .click()
    await page.locator('.process-row').first().click()
    await expect(page.getByRole('region', { name: 'Process details', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0)
    await app.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler('proc:signal')
      ipcMain.handle('proc:signal', (_event, input) => ({
        ok: true,
        data: { signaled: [input.target.pid], stopped: [], refused: [], stillRunning: [] }
      }))
    })
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await page.screenshot({ path: '/tmp/devdeck-ux/process-details-after.png' })
  } finally {
    await app.close()
    await rm(root, { recursive: true, force: true })
  }
})
