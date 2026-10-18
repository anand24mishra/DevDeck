'use strict'
const { execFileSync } = require('node:child_process'),
  path = require('node:path'),
  os = require('node:os')
const input = process.argv[2] || '',
  cli = process.env.DEVDECK_CLI || path.join(os.homedir(), '.local/bin/devdeck')
try {
  if (/^stop:[1-9]\d{0,9}$/.test(input))
    execFileSync(cli, ['stop', `pid:${input.slice(5)}`], { timeout: 35000, maxBuffer: 65536 })
  else {
    const url = new URL(input)
    if (
      (url.protocol === 'devdeck:' &&
        url.hostname === 'project' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password &&
        /^\/[^/]+$/.test(url.pathname)) ||
      (url.protocol === 'http:' &&
        url.hostname === 'localhost' &&
        Number(url.port) > 0 &&
        Number(url.port) <= 65535 &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password)
    )
      execFileSync('/usr/bin/open', [url.href], { timeout: 5000, maxBuffer: 65536 })
    else throw new Error()
  }
} catch {
  console.error('The action could not complete. Check DevDeck and the workflow CLI path.')
  process.exitCode = 1
}
