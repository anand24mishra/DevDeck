import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { windowStateManager } from './services/windowState'
import { trayService } from './services/tray'
import { DarwinProcessProvider } from './providers/process.darwin'
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
    const pids = procs.map((p) => p.pid)
    const { terminate, defaultKillDeps } = await import('./services/kill')
    await terminate(pids, defaultKillDeps)
    trayService.updateProcessCount(0)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('procs:changed')
    }
  } catch (err: unknown) {
    console.error('Failed to stop all processes from tray:', err)
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
      nodeIntegration: false
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

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (is.dev && devUrl && url.startsWith(devUrl)) {
      return
    }
    event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

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
