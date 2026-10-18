import { spawn } from 'child_process'
// This module is fixed, bundled code. The main process validates all launch data.
process.parentPort.once('message', ({ data }) => {
  try {
    const child = spawn(data.file, data.args, {
      cwd: data.cwd,
      env: data.env,
      shell: false,
      detached: true,
      stdio: ['ignore', 1, 2]
    })
    child.once('error', () => {
      process.parentPort.postMessage({ error: true })
      process.exit(1)
    })
    child.once('spawn', () => {
      child.unref()
      process.parentPort.postMessage({ pid: child.pid })
      setTimeout(() => process.exit(0), 50)
    })
  } catch {
    process.parentPort.postMessage({ error: true })
    process.exit(1)
  }
})
