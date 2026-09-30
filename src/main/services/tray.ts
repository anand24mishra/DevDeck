import path from 'path'
import fs from 'fs'
import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'

export class TrayService {
  private tray: Tray | null = null
  private runningCount: number = 0
  private mainWindow: BrowserWindow | null = null
  private onStopAll: (() => Promise<void>) | null = null

  public init(mainWindow: BrowserWindow, onStopAll: () => Promise<void>): Tray | null {
    this.mainWindow = mainWindow
    this.onStopAll = onStopAll

    try {
      const iconPath = this.getTrayIconPath()
      if (!iconPath || !fs.existsSync(iconPath)) {
        return null
      }

      const image = nativeImage.createFromPath(iconPath)
      image.setTemplateImage(true)

      this.tray = new Tray(image)
      this.tray.setToolTip('DevDeck — Development Instrument Panel')

      this.tray.on('click', () => {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return
        if (this.mainWindow.isVisible()) {
          if (this.mainWindow.isFocused()) {
            this.mainWindow.hide()
          } else {
            this.mainWindow.focus()
          }
        } else {
          this.mainWindow.show()
          this.mainWindow.focus()
        }
      })

      this.renderMenu()
      return this.tray
    } catch (err: unknown) {
      console.warn('Failed to initialize menu bar tray:', err)
      return null
    }
  }

  private getTrayIconPath(): string | null {
    const candidates = [
      path.join(__dirname, '../../resources/trayTemplate.png'),
      path.join(__dirname, '../resources/trayTemplate.png'),
      path.join(process.cwd(), 'resources/trayTemplate.png')
    ]

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c
      }
    }
    return null
  }

  public updateProcessCount(count: number): void {
    this.runningCount = count
    if (this.tray) {
      const tooltip =
        count === 0
          ? 'DevDeck — No running dev processes'
          : `DevDeck — ${count} running dev ${count === 1 ? 'process' : 'processes'}`
      this.tray.setToolTip(tooltip)
      this.renderMenu()
    }
  }

  private renderMenu(): void {
    if (!this.tray) return

    const count = this.runningCount
    const statusText =
      count === 0
        ? 'No running dev processes'
        : `${count} running dev ${count === 1 ? 'process' : 'processes'}`

    const contextMenu = Menu.buildFromTemplate([
      {
        label: statusText,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open DevDeck',
        click: (): void => {
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.show()
            this.mainWindow.focus()
          }
        }
      },
      {
        label: 'Stop All Dev Processes',
        enabled: count > 0,
        click: (): void => {
          this.onStopAll?.().catch((err) => console.error('Failed to stop all processes:', err))
        }
      },
      { type: 'separator' },
      {
        label: 'Quit DevDeck',
        accelerator: 'CmdOrCtrl+Q',
        click: (): void => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

export const trayService = new TrayService()
