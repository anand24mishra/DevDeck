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
// Synthetic read-only data for repeatable UI inspection; never shipped.
if (process.env.DEVDECK_TEST_UX === '1') {
  const root = process.env.DEVDECK_TEST_PROJECT
  const processes = [
    ['Vite dev server', 'storefront', 5173, 2, 180],
    ['API server', 'storefront', 3000, 12, 340],
    ['Python worker', 'data-pipeline', 8000, 63, 920]
  ].map(([name, project, port, cpu, memMB], i) => ({
    pid: 110000 + i,
    ppid: 1,
    startTime: 'fixture',
    command: 'node server.js --token=synthetic-only',
    name,
    project,
    projectPath: root,
    cwd: root,
    ports: [port],
    cpu,
    memMB,
    uptimeSec: 5400,
    sockets: [
      {
        pid: 110000 + i,
        name,
        port,
        address: i === 2 ? '*' : '127.0.0.1',
        protocol: 'TCP',
        family: 'IPv4',
        state: 'LISTEN'
      }
    ]
  }))
  const containers = [
    ['web', 'nginx:alpine', 'running', 8080],
    ['database', 'postgres:16', 'running', 5432],
    ['redis', 'redis:7', 'exited', 6379]
  ].map(([name, image, state, port], i) => ({
    id: `abcdef12345${i}`,
    name,
    image,
    state,
    status: state === 'running' ? 'Up 2 hours' : 'Exited 1 hour ago',
    project: 'storefront',
    ports: [port],
    created: 1,
    hasVolumes: name === 'database',
    service: name,
    dependsOn: []
  }))
  const handle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel, listener) =>
    handle(channel, async (event, input) => {
      if (channel === 'procs:list') return { ok: true, data: processes }
      if (channel === 'docker:list') return { ok: true, data: containers }
      if (channel === 'project:context')
        return {
          ok: true,
          data: { branch: 'feature/checkout', dirty: true, runtime: ['Node requested: 22'] }
        }
      if (channel === 'proc:details')
        return {
          ok: true,
          data: {
            process: processes.find((p) => p.pid === input.pid) || processes[0],
            user: 'you',
            parentName: 'launchd',
            runtime: ['Node requested: 22'],
            canViewEnvironment: true
          }
        }
      if (channel === 'proc:environment')
        return {
          ok: true,
          data: [
            { key: 'PORT', value: '5173', sensitive: false },
            { key: 'API_TOKEN', value: 'synthetic-only', sensitive: true }
          ]
        }
      if (channel === 'docker:inspect')
        return {
          ok: true,
          data: {
            environment: [{ key: 'POSTGRES_PASSWORD', value: 'synthetic-only' }],
            mounts: ['storefront-data → /var/lib/postgresql/data'],
            networks: ['storefront_default'],
            health: 'healthy',
            restartCount: 0,
            exitCode: 0,
            oomKilled: false
          }
        }
      if (channel === 'docker:logs:start') {
        setTimeout(
          () =>
            event.sender.send('docker:log', {
              id: input.id,
              text: 'Ready to accept connections\nGET / 200\n'
            }),
          100
        )
        return { ok: true, data: null }
      }
      if (channel === 'docker:logs:stop') return { ok: true, data: null }
      return listener(event, input)
    })
}
require(path.resolve(__dirname, '../out/main/index.js'))
