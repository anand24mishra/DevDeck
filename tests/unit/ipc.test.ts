import { beforeAll, expect, it, vi } from 'vitest'
import type { Result } from '../../src/shared/types'

type TestHandler = (event: unknown, ...args: unknown[]) => Promise<Result<unknown>>
const errorCode = (result: Result<unknown>): string | undefined =>
  result.ok ? undefined : result.error.code
import { registerIpcHandlers } from '../../src/main/ipc'
import { DarwinProcessProvider } from '../../src/main/providers/process.darwin'

const state = vi.hoisted(() => ({
  handlers: new Map<string, TestHandler>(),
  ownsWindow: true,
  sender: { mainFrame: { url: 'http://localhost:5173/' } }
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }))
vi.mock('electron', () => ({
  app: { getPath: () => '/dev/null/devdeck-test', isPackaged: false },
  safeStorage: undefined,
  ipcMain: {
    handle: (channel: string, handler: TestHandler) => state.handlers.set(channel, handler)
  },
  BrowserWindow: {
    fromWebContents: (sender: unknown) =>
      sender === state.sender && state.ownsWindow ? { webContents: sender } : null,
    getAllWindows: () => []
  }
}))
beforeAll(() => {
  vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173/')
  registerIpcHandlers()
  return () => vi.unstubAllEnvs()
})
it('rejects subframes, unowned windows, and lookalike URLs before accessing processes', async () => {
  const read = vi.spyOn(DarwinProcessProvider.prototype, 'listProcesses')
  const invoke = state.handlers.get('procs:list')!
  const event = { sender: state.sender, senderFrame: state.sender.mainFrame }
  expect(errorCode(await invoke({ ...event, senderFrame: { ...state.sender.mainFrame } }))).toBe(
    'DENIED'
  )
  state.ownsWindow = false
  expect(errorCode(await invoke(event))).toBe('DENIED')
  state.ownsWindow = true
  state.sender.mainFrame.url = 'http://localhost:5173.evil.test/'
  expect(errorCode(await invoke(event))).toBe('DENIED')
  state.sender.mainFrame.url = 'http://localhost:5173/'
  expect(read).not.toHaveBeenCalled()
  read.mockRestore()
})
it('rejects malformed destructive requests and excess IPC arguments without throwing', async () => {
  const event = { sender: state.sender, senderFrame: state.sender.mainFrame }
  for (const input of [null, {}, { pids: [123] }, { targets: [] }]) {
    expect(errorCode(await state.handlers.get('procs:stop')!(event, input))).toBe('INVALID_INPUT')
  }
  expect(errorCode(await state.handlers.get('procs:list')!(event, undefined, 'extra'))).toBe(
    'INVALID_INPUT'
  )
})
it('redacts errors returned by legacy handlers as well as thrown failures', async () => {
  const read = vi
    .spyOn(DarwinProcessProvider.prototype, 'listProcesses')
    .mockRejectedValue(new Error('secret-token-in-OS-output'))
  const event = { sender: state.sender, senderFrame: state.sender.mainFrame }
  const result = await state.handlers.get('procs:list')!(event)
  expect(result).toEqual({
    ok: false,
    error: { code: 'INTERNAL', message: 'Could not complete the request. Try again.' }
  })
  expect(JSON.stringify(result)).not.toContain('secret-token')
  read.mockRestore()
})

it('does not return details when the identity changed after the scan', async () => {
  const { defaultKillDeps } = await import('../../src/main/services/kill')
  const read = vi
    .spyOn(DarwinProcessProvider.prototype, 'listProcesses')
    .mockResolvedValue([
      {
        pid: 123,
        startTime: 'old',
        command: 'node --token SECRET'
      } as import('../../src/shared/types').Proc
    ])
  const verify = vi
    .spyOn(defaultKillDeps, 'revalidate')
    .mockResolvedValue({
      ok: [{ pid: 123, startTime: 'new', command: 'node other.js' }],
      refused: []
    })
  const event = { sender: state.sender, senderFrame: state.sender.mainFrame }
  const result = await state.handlers.get('proc:details')!(event, { pid: 123, startTime: 'old' })
  expect(result.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain('SECRET')
  read.mockRestore()
  verify.mockRestore()
})
