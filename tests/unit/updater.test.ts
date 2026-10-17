import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  failInstall: false,
  errorHandler: undefined as undefined | (() => void),
  packaged: true,
  decisions: [] as number[],
  downloaded: false,
  installed: false,
  checks: 0,
  failVerification: false,
  messages: [] as { message?: string; detail?: string }[]
}))
vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return state.packaged
    }
  },
  dialog: {
    showMessageBox: async (options: { message?: string; detail?: string }) => {
      state.messages.push(options)
      return { response: state.decisions.shift() ?? 0 }
    }
  }
}))
vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: {
      on: (_event: string, handler: () => void) => {
        state.errorHandler = handler
      },
      checkForUpdates: async () => {
        state.checks++
        return { isUpdateAvailable: true, updateInfo: { version: '1.0.1' } }
      },
      downloadUpdate: async () => {
        if (state.failVerification) throw new Error('secret-token-in-updater-error')
        state.downloaded = true
      },
      quitAndInstall: () => {
        if (state.failInstall) state.errorHandler?.()
        else state.installed = true
      }
    }
  }
}))
beforeEach(() => {
  vi.resetModules()
  Object.assign(state, {
    failInstall: false,
    errorHandler: undefined,
    packaged: true,
    decisions: [],
    downloaded: false,
    installed: false,
    checks: 0,
    failVerification: false,
    messages: []
  })
})
it('source builds never contact the update feed', async () => {
  state.packaged = false
  await (await import('../../src/main/services/updater')).checkForUpdates()
  expect(state.checks).toBe(0)
})
it('requires download and restart consent separately', async () => {
  const { checkForUpdates } = await import('../../src/main/services/updater')
  await checkForUpdates()
  expect(state.downloaded).toBe(false)
  state.decisions.push(1, 0)
  await checkForUpdates()
  expect(state.downloaded).toBe(true)
  expect(state.installed).toBe(false)
  state.decisions.push(1, 1)
  await checkForUpdates()
  expect(state.installed).toBe(true)
})
it('failed download verification cannot reach installation or expose error contents', async () => {
  state.decisions.push(1)
  state.failVerification = true
  await (await import('../../src/main/services/updater')).checkForUpdates()
  expect(state.installed).toBe(false)
  expect(JSON.stringify(state.messages)).not.toContain('secret-token')
})

it('uses the real CommonJS export shape supported by the installed updater', async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "const m = await import('electron-updater'); process.stdout.write(String('autoUpdater' in m.default))"
    ],
    { timeout: 5000 }
  )
  expect(stdout).toBe('true')
})
it('reports native verification failure after install was requested', async () => {
  state.decisions.push(1, 1)
  state.failInstall = true
  await (await import('../../src/main/services/updater')).checkForUpdates()
  expect(state.installed).toBe(false)
  expect(
    state.messages.some((message) => message.message === 'Could not install the update.')
  ).toBe(true)
})
