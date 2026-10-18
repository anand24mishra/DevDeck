'use strict'
const { execFileSync } = require('node:child_process'),
  path = require('node:path'),
  os = require('node:os')
const cli = process.env.DEVDECK_CLI || path.join(os.homedir(), '.local/bin/devdeck')
try {
  const query = (process.argv[2] || '').toLowerCase(),
    procs = JSON.parse(
      execFileSync(cli, ['ls', '--json'], { timeout: 5000, maxBuffer: 4194304, encoding: 'utf8' })
    )
  const items = procs
    .filter((p) =>
      `${p.name} ${p.project} ${p.pid} ${p.ports.join(' ')}`.toLowerCase().includes(query)
    )
    .map((p) => ({
      uid: String(p.pid),
      title: `${p.name} · ${p.project}`,
      subtitle: `PID ${p.pid} · ${p.ports.join(', ') || 'No listening port'} · ⌘ open server · ⌥ stop with confirmation`,
      arg: `devdeck://project/${encodeURIComponent(p.project)}`,
      mods: {
        alt: {
          arg: `stop:${p.pid}`,
          subtitle: 'Request stop in DevDeck; native confirmation required'
        },
        ...(p.ports.length
          ? { cmd: { arg: `http://localhost:${p.ports[0]}`, subtitle: 'Open this local server' } }
          : {})
      }
    }))
  console.log(
    JSON.stringify({
      items: items.length ? items : [{ title: 'No development processes found', valid: false }]
    })
  )
} catch {
  console.log(
    JSON.stringify({
      items: [
        {
          title: 'Open DevDeck and check the workflow CLI path',
          subtitle: 'Set DEVDECK_CLI to the absolute linked executable path.',
          valid: false
        }
      ]
    })
  )
}
