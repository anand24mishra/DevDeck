// Isolated test entry: no test hooks or alternate policies enter the production bundle.
const { app, Menu, dialog, ipcMain } = require('electron')
const path = require('node:path')
if (!process.env.DEVDECK_TEST_DATA) throw new Error('An isolated test data directory is required')
app.setPath('userData', process.env.DEVDECK_TEST_DATA)
global.__devdeckDialogs = []
const buildMenu = Menu.buildFromTemplate.bind(Menu)
Menu.buildFromTemplate = (template) => {
  const menu = buildMenu(template)
  global.__devdeckTrayMenu = menu
  return menu
}
dialog.showMessageBox = async (options) => {
  global.__devdeckDialogs.push(options)
  return { response: options.cancelId ?? 0, checkboxChecked: false }
}
// Read-only large-list fixture. Mutation handlers keep the production identity guards.
if (process.env.DEVDECK_TEST_LARGE_LIST === '1') {
  const handle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel, listener) =>
    handle(
      channel,
      channel === 'procs:list'
        ? async () => ({
            ok: true,
            data: Array.from({ length: 240 }, (_, index) => ({
              pid: 100000 + index,
              ppid: 1,
              startTime: 'fixture',
              command: 'node fixture.js',
              name: `Fixture ${index}`,
              project: 'Large fixture',
              projectPath: null,
              cwd: null,
              ports: [],
              cpu: 0,
              memMB: 20,
              uptimeSec: 1
            }))
          })
        : listener
    )
}
require(path.resolve(__dirname, '../out/main/index.js'))
