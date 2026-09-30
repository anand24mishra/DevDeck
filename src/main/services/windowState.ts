import fs from 'fs'
import path from 'path'
import { app, BrowserWindow, screen, Rectangle } from 'electron'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

const DEFAULT_STATE: WindowState = {
  width: 960,
  height: 700
}

export class WindowStateManager {
  private filePath: string
  private state: WindowState

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath
    } else {
      try {
        this.filePath = path.join(app.getPath('userData'), 'window-state.json')
      } catch {
        this.filePath = path.join(process.cwd(), '.window-state.json')
      }
    }
    this.state = this.load()
  }

  private load(): WindowState {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        if (
          typeof parsed.width === 'number' &&
          parsed.width >= 400 &&
          typeof parsed.height === 'number' &&
          parsed.height >= 300
        ) {
          return {
            x: typeof parsed.x === 'number' ? parsed.x : undefined,
            y: typeof parsed.y === 'number' ? parsed.y : undefined,
            width: parsed.width,
            height: parsed.height,
            isMaximized: Boolean(parsed.isMaximized)
          }
        }
      }
    } catch {
      // Return defaults on corrupt file
    }
    return { ...DEFAULT_STATE }
  }

  public getState(): WindowState {
    // Validate position against available displays if x and y are set
    if (typeof this.state.x === 'number' && typeof this.state.y === 'number') {
      try {
        const bounds: Rectangle = {
          x: this.state.x,
          y: this.state.y,
          width: this.state.width,
          height: this.state.height
        }
        const visible = screen.getAllDisplays().some((display) => {
          const area = display.workArea
          return (
            bounds.x + bounds.width > area.x &&
            bounds.x < area.x + area.width &&
            bounds.y + bounds.height > area.y &&
            bounds.y < area.y + area.height
          )
        })
        if (!visible) {
          return { width: this.state.width, height: this.state.height }
        }
      } catch {
        // In headless / before ready
      }
    }
    return { ...this.state }
  }

  public track(win: BrowserWindow): void {
    let saveTimeout: NodeJS.Timeout | null = null

    const saveState = (): void => {
      try {
        if (win.isDestroyed()) return
        const isMaximized = win.isMaximized()
        if (!isMaximized) {
          const bounds = win.getBounds()
          this.state = {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            isMaximized: false
          }
        } else {
          this.state.isMaximized = true
        }

        fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8')
      } catch {
        // Non-fatal
      }
    }

    const debouncedSave = (): void => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveState, 500)
    }

    win.on('resize', debouncedSave)
    win.on('move', debouncedSave)
    win.on('close', saveState)
  }
}

export const windowStateManager = new WindowStateManager()
