import { spawn, execFile } from 'child_process'
import { createConnection } from 'net'
import { spawnedIdentity } from './security/launchExecutable'
// Fixed bundled code. Main validates argv/cwd; output is a private authenticated local pipe.
process.parentPort.once('message', ({ data }) => {
  const output = createConnection(data.outputPath)
  output.once('error', () => process.exit(1))
  output.once('connect', () => {
    output.write(data.outputToken + '\n', () => {
      try {
        const child = spawn(data.file, data.args, {
          cwd: data.cwd,
          env: data.env,
          shell: false,
          detached: true,
          stdio: ['ignore', output, output]
        })
        child.once('error', () => {
          process.parentPort.postMessage({ error: true })
          process.exit(1)
        })
        child.once('spawn', () => {
          child.unref()
          execFile(
            '/bin/ps',
            ['-p', String(child.pid), '-o', 'ppid=,lstart=,command='],
            {
              encoding: 'utf8',
              timeout: 1000,
              maxBuffer: 1024 * 1024
            },
            (_error, stdout) => {
              const identity = !_error ? spawnedIdentity(stdout, process.pid, child) : undefined
              process.parentPort.postMessage({ pid: child.pid, ...identity })
              setTimeout(() => process.exit(0), 50)
            }
          )
        })
      } catch {
        process.parentPort.postMessage({ error: true })
        process.exit(1)
      }
    })
  })
})
