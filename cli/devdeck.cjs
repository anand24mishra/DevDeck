#!/usr/bin/env node
'use strict'
const fs = require('node:fs'),
  net = require('node:net'),
  os = require('node:os'),
  path = require('node:path')
async function main() {
  const argv = process.argv.slice(2),
    json = argv.includes('--json'),
    yes = argv.includes('--yes')
  if (argv.some((a) => a.startsWith('--') && !['--json', '--yes', '--help'].includes(a)))
    throw new Error('Unknown option. Run devdeck --help.')
  if (!argv.length || argv.includes('--help')) {
    console.log(
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
    console.log(JSON.stringify(reply.data, null, 2))
    return
  }
  if (command === 'logs') console.log(reply.data.join('\n'))
  else if (command === 'ls')
    console.log(
      reply.data
        .map((p) => `${p.pid}\t${p.name}\t${p.project}\t${p.ports.join(',') || '—'}`)
        .join('\n') || 'No development processes found.'
    )
  else if (command === 'port')
    console.log(
      reply.data
        .map((p) => `${p.port}\t${p.pid}\t${p.name}\t${p.explanation || p.address}`)
        .join('\n') || `${positional[0]} is free.`
    )
  else {
    const r = reply.data
    console.log(
      r.cancelled
        ? 'Cancelled.'
        : `${r.stopped.length} stopped; ${r.forced.length} force stopped; ${r.refused.length} skipped; ${r.stillRunning.length} still running.`
    )
    if (r.refused?.length || r.stillRunning?.length) process.exitCode = 1
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
