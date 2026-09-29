import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { Settings } from '../../shared/types'

const DEFAULT_SETTINGS: Settings = {
  refreshIntervalSec: 3,
  ignoreList: [],
  customAllowlist: []
}

export class SettingsService {
  private filePath: string
  private cached: Settings

  constructor() {
    try {
      this.filePath = path.join(app.getPath('userData'), 'settings.json')
    } catch {
      this.filePath = path.join(process.cwd(), '.settings.json')
    }
    this.cached = this.load()
  }

  private load(): Settings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        return {
          refreshIntervalSec: [2, 3, 5, 10].includes(parsed.refreshIntervalSec)
            ? parsed.refreshIntervalSec
            : 3,
          ignoreList: Array.isArray(parsed.ignoreList) ? parsed.ignoreList : [],
          customAllowlist: Array.isArray(parsed.customAllowlist) ? parsed.customAllowlist : []
        }
      }
    } catch {
      // Use defaults if load fails
    }
    return { ...DEFAULT_SETTINGS }
  }

  public getSettings(): Settings {
    return { ...this.cached }
  }

  public updateSettings(partial: Partial<Settings>): Settings {
    const updated: Settings = {
      ...this.cached,
      ...partial
    }

    // Validate values
    if (![2, 3, 5, 10].includes(updated.refreshIntervalSec)) {
      updated.refreshIntervalSec = 3
    }
    if (!Array.isArray(updated.ignoreList)) {
      updated.ignoreList = []
    }
    if (!Array.isArray(updated.customAllowlist)) {
      updated.customAllowlist = []
    }

    this.cached = updated

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(updated, null, 2), 'utf-8')
    } catch {
      // Persist failure is non-fatal in test/memory scenarios
    }

    return { ...this.cached }
  }
}

export const settingsService = new SettingsService()
