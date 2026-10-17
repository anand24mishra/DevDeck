import { globalShortcut } from 'electron'

export const DEFAULT_HOTKEY = 'Control+Alt+D'
export function validHotkey(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length <= 100 &&
      /^(?:(?:Control|Command|CommandOrControl|Alt|Option|Shift|Super)\+){1,4}(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4])|Space|Escape)$/.test(
        value
      ))
  )
}
type Registry = Pick<typeof globalShortcut, 'register' | 'unregister'>
export class HotkeyService {
  private current: string | null = null
  private toggle: () => void = () => {}
  constructor(private readonly registry?: Registry) {}
  setToggle(toggle: () => void): void {
    this.toggle = toggle
  }
  configure(value: string | null): boolean {
    if (!validHotkey(value)) return false
    if (value === this.current) return true
    const native = this.registry || globalShortcut
    const old = this.current
    if (old) native.unregister(old)
    try {
      if (value && !native.register(value, this.toggle)) throw new Error('Shortcut unavailable')
      this.current = value
      return true
    } catch {
      if (old) native.register(old, this.toggle)
      return false
    }
  }
  dispose(): void {
    if (this.current) (this.registry || globalShortcut).unregister(this.current)
    this.current = null
  }
}
export const hotkeyService = new HotkeyService()
