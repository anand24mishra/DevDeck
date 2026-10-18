import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
test('large lists window rows and support keyboard, reduced motion, zoom and export preview', async () => {
  test.setTimeout(60000)
  const data = await mkdtemp(path.join(os.tmpdir(), 'devdeck-accessibility-'))
  const app = await electron.launch({
    args: [path.resolve('e2e/main.cjs')],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
      DEVDECK_TEST_DATA: data,
      DEVDECK_TEST_LARGE_LIST: '1'
    }
  })
  try {
    const page = await app.firstWindow()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('list', { name: /rows, windowed/ })).toBeVisible()
    expect(await page.locator('.process-row').count()).toBeLessThan(80)
    const first = page.locator('.process-row').first()
    await first.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('.process-row').nth(1)).toBeFocused()
    await page.keyboard.press('Delete')
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(confirm).not.toBeVisible()
    await page.locator('.app-content').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect(page.locator('[aria-posinset="241"]')).toBeAttached()
    expect(await page.locator('.process-row').count()).toBeLessThan(80)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.send('app:focus', {
        pid: 100239,
        project: 'Large fixture'
      })
    )
    await expect(page.locator('[data-process-id="100239"] .process-row')).toBeFocused()
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2)
    )
    await page.getByText('Share…', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Copy snapshot…', exact: true })).toBeVisible()
    const motion = await page.evaluate(() => ({
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      overflow: document.documentElement.scrollWidth > innerWidth
    }))
    expect(motion.reduced).toBe(true)
    expect(motion.overflow).toBe(false)
    await page.getByRole('button', { name: 'Copy diagnostics…', exact: true }).click()
    const preview = page.getByRole('dialog', { name: 'Review export' })
    await expect(preview).toBeVisible()
    await expect(preview.getByLabel('Exact clipboard preview')).toHaveValue(/appVersion/)
    await expect(preview.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await preview.getByRole('button', { name: 'Cancel', exact: true }).click()
    const target = page.locator('[data-process-id="100239"] .process-row')
    await target.scrollIntoViewIfNeeded()
    await expect(target).toBeInViewport()
    await expect(target.getByRole('button', { name: 'Stop', exact: true })).toBeInViewport()
    // Native capture preserves Electron's physical viewport at non-default zoom.
    const capture = await app.evaluate(async ({ BrowserWindow }) =>
      (await BrowserWindow.getAllWindows()[0].capturePage()).toDataURL()
    )
    await writeFile(
      '/tmp/devdeck-accessibility-200-percent.png',
      Buffer.from(capture.split(',')[1], 'base64')
    )
  } finally {
    await app.close()
    await rm(data, { recursive: true, force: true })
  }
})
