import net from 'net'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { randomBytes } from 'crypto'
import { StringDecoder } from 'string_decoder'
const active = new Set<() => void>()
/** A private user-only socket transports bytes; no log data is written to disk. */
export async function launchOutput(
  append: (text: string) => void
): Promise<{ path: string; token: string; close: () => void }> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devdeck-output-'))
  await fs.chmod(directory, 0o700)
  const socketPath = path.join(directory, 'output.sock'),
    token = randomBytes(32).toString('hex')
  let connection: net.Socket | undefined
  const cleanup = (): void => {
    void fs.rm(directory, { recursive: true, force: true }).catch(() => {})
  }
  const server = net.createServer((socket) => {
    if (connection) {
      socket.destroy()
      return
    }
    connection = socket
    let authenticated = false,
      pending = Buffer.alloc(0)
    const decoder = new StringDecoder('utf8')
    socket.on('data', (chunk) => {
      if (!authenticated) {
        pending = Buffer.concat([pending, chunk])
        const split = pending.indexOf(10)
        if (split < 0) {
          if (pending.length > 128) socket.destroy()
          return
        }
        if (pending.subarray(0, split).toString() !== token) {
          socket.destroy()
          return
        }
        authenticated = true
        server.close()
        cleanup()
        append(decoder.write(pending.subarray(split + 1)))
        pending = Buffer.alloc(0)
      } else append(decoder.write(chunk))
    })
    socket.on('error', () => {})
    socket.on('close', () => {
      active.delete(close)
      server.close()
      cleanup()
    })
  })
  const close = (): void => {
    connection?.destroy()
    server.close()
    active.delete(close)
    cleanup()
  }
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(socketPath, () => resolve())
    })
    await fs.chmod(socketPath, 0o600)
  } catch (error) {
    close()
    throw error
  }
  active.add(close)
  return { path: socketPath, token, close }
}
export function closeLaunchOutputs(): void {
  for (const close of active) close()
}
