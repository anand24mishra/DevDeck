import net from 'net'
import fs from 'fs/promises'
import path from 'path'
import { randomBytes, timingSafeEqual } from 'crypto'
export interface CliRequest {
  command: 'ls' | 'port' | 'stop' | 'logs'
  args: string[]
  yes?: boolean
}
export function validCliRequest(value: unknown): value is CliRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as CliRequest
  return (
    Object.keys(r).every((k) => ['command', 'args', 'yes'].includes(k)) &&
    ['ls', 'port', 'stop', 'logs'].includes(r.command) &&
    Array.isArray(r.args) &&
    r.args.length < 3 &&
    r.args.every(
      (a) => typeof a === 'string' && a.length > 0 && a.length <= 256 && !a.includes('\0')
    ) &&
    (r.yes === undefined || typeof r.yes === 'boolean') &&
    (r.command === 'ls' ? r.args.length === 0 : r.args.length === 1) &&
    (r.command !== 'port' || (/^[1-9]\d{0,4}$/.test(r.args[0]) && Number(r.args[0]) <= 65535)) &&
    (r.command !== 'stop' || /^(?:pid:|port:)?[1-9]\d{0,9}$/.test(r.args[0]))
  )
}
export class CliServer {
  private closeServer?: () => Promise<void>
  async start(
    userData: string,
    dispatch: (request: CliRequest) => Promise<unknown>
  ): Promise<void> {
    if (this.closeServer) return
    const directory = await fs.mkdtemp('/tmp/devdeck-cli-')
    await fs.chmod(directory, 0o700)
    const socketPath = path.join(directory, 'control.sock'),
      token = randomBytes(32).toString('hex'),
      credentials = path.join(userData, 'cli.json')
    const sockets = new Set<net.Socket>()
    const server = net.createServer((socket) => {
      sockets.add(socket)
      socket.setTimeout(30000, () => socket.destroy())
      socket.on('error', () => {})
      socket.on('close', () => sockets.delete(socket))
      let body = Buffer.alloc(0),
        received = false
      socket.on('data', (chunk) => {
        if (received) return
        body = Buffer.concat([body, chunk])
        if (body.length > 65536) {
          socket.destroy()
          return
        }
        if (!body.includes(10)) return
        received = true
        socket.pause()
        void (async () => {
          try {
            const parsed = JSON.parse(body.toString().trim())
            if (
              typeof parsed.token !== 'string' ||
              !/^[a-f0-9]{64}$/.test(parsed.token) ||
              !timingSafeEqual(Buffer.from(parsed.token), Buffer.from(token))
            ) {
              socket.end(
                JSON.stringify({
                  ok: false,
                  error: { code: 'DENIED', message: 'CLI authentication failed.' }
                }) + '\n'
              )
              return
            }
            const { token: _token, ...request } = parsed
            void _token
            if (!validCliRequest(request)) {
              socket.end(
                JSON.stringify({
                  ok: false,
                  error: { code: 'INVALID_INPUT', message: 'Invalid CLI command.' }
                }) + '\n'
              )
              return
            }
            const result = JSON.stringify(await dispatch(request))
            socket.end(
              (Buffer.byteLength(result) <= 4194304
                ? result
                : JSON.stringify({
                    ok: false,
                    error: { code: 'DENIED', message: 'Result is too large. Narrow your request.' }
                  })) + '\n'
            )
          } catch {
            socket.end(
              JSON.stringify({
                ok: false,
                error: { code: 'INTERNAL', message: 'The CLI request could not complete.' }
              }) + '\n'
            )
          }
        })()
      })
    })
    server.maxConnections = 16
    const close = async (): Promise<void> => {
      for (const socket of sockets) socket.destroy()
      server.close()
      await fs.rm(directory, { recursive: true, force: true })
      await fs.rm(credentials, { force: true })
      this.closeServer = undefined
    }
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(socketPath, () => resolve())
      })
      await fs.chmod(socketPath, 0o600)
      await fs.mkdir(userData, { recursive: true })
      const temporary = credentials + `.${process.pid}.tmp`
      await fs.writeFile(temporary, JSON.stringify({ socketPath, token }), { mode: 0o600 })
      await fs.chmod(temporary, 0o600)
      await fs.rename(temporary, credentials)
      this.closeServer = close
    } catch (error) {
      await close()
      throw error
    }
  }
  async stop(): Promise<void> {
    await this.closeServer?.()
  }
}
export const cliServer = new CliServer()
