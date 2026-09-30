import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { Settings } from '../../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  refreshIntervalSec: 3,
  ignoreList: [],
  customAllowlist: [],
  dockerSocketPath: undefined,
  theme: 'system',
  openAtLogin: false,
  persistRecentlyStopped: false
}

export class SettingsService {
  private filePath: string
  private cached: Settings

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath
    } else {
      try {
        this.filePath = path.join(app.getPath('userData'), 'settings.json')
      } catch {
        this.filePath = path.join(process.cwd(), '.settings.json')
      }
    }
    this.cached = this.load()
  }

  public getFilePath(): string {
    return this.filePath
  }

  private load(): Settings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        return this.validate(parsed)
      }
    } catch (err: unknown) {
      // Corrupt file or parse failure: log and return defaults
      console.warn('Failed to load settings file, falling back to defaults:', err)
    }
    return { ...DEFAULT_SETTINGS }
  }

  public validate(raw: unknown): Settings {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_SETTINGS }
    }

    const r = raw as Record<string, unknown>

    const refreshIntervalSec =
      typeof r.refreshIntervalSec === 'number' && [2, 3, 5, 10].includes(r.refreshIntervalSec)
        ? (r.refreshIntervalSec as 2 | 3 | 5 | 10)
        : DEFAULT_SETTINGS.refreshIntervalSec

    const ignoreList = Array.isArray(r.ignoreList)
      ? r.ignoreList.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []

    const customAllowlist = Array.isArray(r.customAllowlist)
      ? r.customAllowlist.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []

    let dockerSocketPath: string | undefined = undefined
    if (typeof r.dockerSocketPath === 'string') {
      const trimmed = r.dockerSocketPath.trim()
      if (trimmed.length > 0 && path.isAbsolute(trimmed) && !trimmed.includes('\0')) {
        dockerSocketPath = path.normalize(trimmed)
      }
    }

    const theme =
      typeof r.theme === 'string' && ['system', 'light', 'dark'].includes(r.theme)
        ? (r.theme as 'system' | 'light' | 'dark')
        : DEFAULT_SETTINGS.theme

    const openAtLogin = typeof r.openAtLogin === 'boolean' ? r.openAtLogin : false
    const persistRecentlyStopped =
      typeof r.persistRecentlyStopped === 'boolean' ? r.persistRecentlyStopped : false

    return {
      refreshIntervalSec,
      ignoreList,
      customAllowlist,
      dockerSocketPath,
      theme,
      openAtLogin,
      persistRecentlyStopped
    }
  }

  public getSettings(): Settings {
    return { ...this.cached }
  }

  public updateSettings(partial: Partial<Settings>): Settings {
    const merged = {
      ...this.cached,
      ...partial
    }

    const validated = this.validate(merged)
    this.cached = validated

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(validated, null, 2), 'utf-8')
    } catch (err: unknown) {
      console.error('Failed to save settings:', err)
    }

    // Apply login item settings if changed
    try {
      if (typeof app?.setLoginItemSettings === 'function') {
        app.setLoginItemSettings({ openAtLogin: validated.openAtLogin })
      }
    } catch {
      // Ignore in headless/test environments
    }

    return { ...this.cached }
  }
}

export const settingsService = new SettingsService()
