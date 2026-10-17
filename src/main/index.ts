import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { windowStateManager } from './services/windowState'
import { trayService, confirmTrayStopAll } from './services/tray'
import { DarwinProcessProvider } from './providers/process.darwin'
import { terminate, defaultKillDeps } from './services/kill'
import { recentlyStoppedService } from './services/recentlyStopped'
import { checkForUpdates } from './services/updater'
import { settingsService } from './services/settings'

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
const processProvider = new DarwinProcessProvider()

async function handleStopAllFromTray(): Promise<void> {
  try {
    const settings = settingsService.getSettings()
    const procs = await processProvider.listProcesses({
      userIgnoreList: settings.ignoreList,
      customAllowlist: settings.customAllowlist
    })
    const report = await confirmTrayStopAll(
      procs,
      async (message, detail) => {
        const answer = await dialog.showMessageBox({
          type: 'warning',
          title: 'DevDeck',
          message,
          detail,
          buttons: ['Cancel', 'Stop'],
          defaultId: 0,
          cancelId: 0,
          noLink: true
        })
        return answer.response === 1
      },
      async (targets) => {
        const result = await terminate(targets, defaultKillDeps)
        const stopped = new Set([...result.stopped, ...result.forced])
        recentlyStoppedService.recordStopped(
          targets.filter((target) => stopped.has(target.pid)),
          !!settings.persistRecentlyStopped
        )
        return result
      }
    )
    if (!report) return
    await dialog.showMessageBox({
      type: report.refused.length || report.stillRunning.length ? 'warning' : 'info',
      title: 'DevDeck',
      message: 'Stop finished',
      detail: `${report.stopped.length} stopped; ${report.forced.length} force stopped; ${report.refused.length} skipped; ${report.stillRunning.length} still running.`
    })
    const remaining = await processProvider.listProcesses({
      userIgnoreList: settings.ignoreList,
      customAllowlist: settings.customAllowlist
    })
    trayService.updateProcessCount(remaining.length)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('procs:changed')
    }
  } catch (err: unknown) {
    console.error('Failed to stop all processes from tray')
    void err
  }
}

function createWindow(): BrowserWindow {
  const savedState = windowStateManager.getState()

  // Create the browser window with restored bounds
  mainWindow = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 640,
    minHeight: 480,
    title: 'DevDeck',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  if (savedState.isMaximized) {
    mainWindow.maximize()
  }

  // Track window bounds
  windowStateManager.track(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  mainWindow.webContents.session.setPermissionCheckHandler(() => false)

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

// Second-instance focus
app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.devdeck.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  const win = createWindow()
  if (app.isPackaged) {
    const updateTimer = setTimeout(() => {
      void checkForUpdates(false)
    }, 10_000)
    updateTimer.unref()
    app.once('before-quit', () => clearTimeout(updateTimer))
  }

  // Initialize menu bar tray
  trayService.init(win, handleStopAllFromTray)

  // Initial process count check for tray
  processProvider
    .listProcesses()
    .then((procs) => trayService.updateProcessCount(procs.length))
    .catch(() => {})

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow()
      trayService.init(newWin, handleStopAllFromTray)
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', () => {
  console.error('Unexpected main-process error')
  if (app.isReady())
    dialog.showErrorBox('DevDeck', 'Something went wrong. Restart DevDeck and try again.')
})
process.on('unhandledRejection', () => {
  console.error('Unexpected asynchronous main-process error')
})
app.on('before-quit', () => trayService.destroy())
