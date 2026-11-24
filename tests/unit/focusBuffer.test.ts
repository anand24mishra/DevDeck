import { it, expect, vi } from 'vitest'
const harness = vi.hoisted(() => ({
  listeners: new Map<string, Function>(),
  exposed: {} as Record<string, any>
}))
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => {
      harness.exposed[name] = api
    }
  },
  ipcRenderer: {
    on: (channel, callback) => harness.listeners.set(channel, callback),
    invoke: vi.fn(),
    removeListener: vi.fn()
  }
}))
it('delivers an initial focus link after the renderer subscribes', async () => {
  vi.stubGlobal('window', {})
  try {
    await import('../../src/preload/index')
    harness.listeners.get('app:focus')!({}, { port: 3000 })
    const callback = vi.fn()
    const unsubscribe = harness.exposed.api.onFocusTarget(callback)
    await Promise.resolve()
    expect(callback).toHaveBeenCalledWith({ port: 3000 })
    unsubscribe()
    harness.listeners.get('app:focus')!({}, { port: 4000 })
    expect(callback).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
  }
})
