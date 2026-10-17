// Isolated test entry: no test hooks or alternate policies enter the production bundle.
const { app, Menu, dialog } = require('electron')
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
require(path.resolve(__dirname, '../out/main/index.js'))
