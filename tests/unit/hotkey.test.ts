import { expect, it } from 'vitest'
import { HotkeyService, validHotkey } from '../../src/main/services/hotkey'

it('restores a working shortcut on conflict and unregisters it on shutdown', () => {
  const registered = new Set<string>()
  const service = new HotkeyService({
    register: (key) => {
      if (key === 'Control+Alt+X') return false
      registered.add(key)
      return true
    },
    unregister: (key) => {
      registered.delete(key)
    }
  })
  expect(service.configure('Control+Alt+D')).toBe(true)
  expect(service.configure('Control+Alt+X')).toBe(false)
  expect([...registered]).toEqual(['Control+Alt+D'])
  service.dispose()
  expect(registered.size).toBe(0)
  expect(validHotkey('D')).toBe(false)
  expect(validHotkey('Control+Alt+D;exec')).toBe(false)
  expect(validHotkey(null)).toBe(true)
})
