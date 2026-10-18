#!/usr/bin/env node
'use strict'
const fs = require('node:fs'),
  net = require('node:net'),
  os = require('node:os'),
  path = require('node:path')
function cleanTerminal(value) {
  return String(value)
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\|$)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
}
const print = (value) => console.log(cleanTerminal(value))
async function main() {
  const argv = process.argv.slice(2),
    json = argv.includes('--json'),
    yes = argv.includes('--yes')
  if (argv.some((a) => a.startsWith('--') && !['--json', '--yes', '--help'].includes(a)))
    throw new Error('Unknown option. Run devdeck --help.')
  if (!argv.length || argv.includes('--help')) {
    print(
      'devdeck ls [--json]\ndevdeck port 3000 [--json]\ndevdeck stop <port|pid:PID> [--yes] [--json]\ndevdeck logs <name|PID|launch-id> [--json]'
    )
    return
  }
  const positional = argv.filter((a) => !a.startsWith('--')),
    command = positional.shift()
  if (!['ls', 'port', 'stop', 'logs'].includes(command))
    throw new Error('Unknown command. Run devdeck --help.')
  const data =
    process.env.DEVDECK_DATA_DIR ||
    path.join(os.homedir(), 'Library', 'Application Support', 'DevDeck')
  let credentials
  try {
    const file = path.join(data, 'cli.json')
    const stat = fs.lstatSync(file)
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o077) !== 0 ||
      stat.size > 4096
    )
      throw new Error()
    credentials = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw new Error(
      'DevDeck is not running or its CLI connection is unavailable. Open DevDeck and try again.'
    )
  }
  const reply = await new Promise((resolve, reject) => {
    const socket = net.createConnection(credentials.socketPath)
    let body = ''
    socket.setTimeout(35000, () => {
      socket.destroy()
      reject(new Error('DevDeck did not respond. Check for a confirmation dialog.'))
    })
    socket.on('connect', () =>
      socket.write(
        JSON.stringify({ token: credentials.token, command, args: positional, yes }) + '\n'
      )
    )
    socket.on('data', (chunk) => {
      body += chunk.toString()
      if (body.length > 4194304) {
        socket.destroy()
        reject(new Error('Response was too large.'))
      }
    })
    socket.on('error', () =>
      reject(new Error('DevDeck is not running. Open DevDeck and try again.'))
    )
    socket.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid response from DevDeck.'))
      }
    })
  })
  if (!reply.ok) throw new Error(reply.error.message)
  if (json) {
    print(JSON.stringify(reply.data, null, 2))
    return
  }
  if (command === 'logs') print(reply.data.join('\n'))
  else if (command === 'ls')
    print(
      reply.data
        .map((p) => `${p.pid}\t${p.name}\t${p.project}\t${p.ports.join(',') || '—'}`)
        .join('\n') || 'No development processes found.'
    )
  else if (command === 'port')
    print(
      reply.data
        .map((p) => `${p.port}\t${p.pid}\t${p.name}\t${p.explanation || p.address}`)
        .join('\n') || `${positional[0]} is free.`
    )
  else {
    const r = reply.data
    print(
      r.cancelled
        ? 'Cancelled.'
        : `${r.stopped.length} stopped; ${r.forced.length} force stopped; ${r.refused.length} skipped; ${r.stillRunning.length} still running.`
    )
    if (r.refused?.length || r.stillRunning?.length) process.exitCode = 1
  }
}
module.exports = { cleanTerminal }
if (require.main === module)
  main().catch((error) => {
    console.error(cleanTerminal(error.message))
    process.exitCode = 1
  })
