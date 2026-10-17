import { app, dialog } from 'electron'
import type { AppUpdater } from 'electron-updater'

let updater: AppUpdater | undefined
let checking = false
let installing = false

async function getUpdater(): Promise<AppUpdater> {
  if (!updater) {
    const module = await import('electron-updater')
    updater = module.default.autoUpdater
    updater.logger = null
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.allowDowngrade = false
    updater.allowPrerelease = false
    updater.on('error', () => {
      // Download failures reject below; native signature failures arrive after quitAndInstall.
      if (!installing) return
      installing = false
      void dialog
        .showMessageBox({
          type: 'warning',
          title: 'DevDeck',
          message: 'Could not install the update.',
          detail:
            'The update could not be verified or installed. Your current copy has not been replaced.'
        })
        .catch(() => {})
    })
  }
  return updater
}

export async function checkForUpdates(interactive = true): Promise<void> {
  if (checking || installing) return
  if (!app.isPackaged) {
    if (interactive)
      await dialog.showMessageBox({
        type: 'info',
        title: 'DevDeck',
        message: 'Updates are available in installed releases.',
        detail: 'This copy is running from source. Install a signed release to receive updates.'
      })
    return
  }
  checking = true
  try {
    const client = await getUpdater()
    const result = await client.checkForUpdates()
    if (!result?.isUpdateAvailable) {
      if (interactive)
        await dialog.showMessageBox({
          type: 'info',
          title: 'DevDeck',
          message: 'DevDeck is up to date.'
        })
      return
    }
    const consent = await dialog.showMessageBox({
      type: 'info',
      title: 'DevDeck',
      message: `DevDeck ${result.updateInfo.version} is available.`,
      buttons: ['Later', 'Download update'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (consent.response !== 1) return
    await client.downloadUpdate()
    const restart = await dialog.showMessageBox({
      type: 'info',
      title: 'DevDeck',
      message: 'The update has downloaded.',
      detail: 'Restart DevDeck to finish installing it.',
      buttons: ['Later', 'Restart DevDeck'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (restart.response === 1) {
      installing = true
      client.quitAndInstall()
    }
  } catch {
    installing = false
    if (interactive)
      await dialog.showMessageBox({
        type: 'warning',
        title: 'DevDeck',
        message: 'Could not check for or install the update.',
        detail: 'Check your connection and try again. Your current copy has not been replaced.'
      })
  } finally {
    checking = false
  }
}
