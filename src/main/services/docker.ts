import fs from 'fs'
import os from 'os'
import path from 'path'
import { Writable } from 'stream'
import Docker from 'dockerode'
import { Container, ContainerState, Result } from '../../shared/types'

export interface DockerSocketCheck {
  found: boolean
  socketPath?: string
  error?: 'DOCKER_UNAVAILABLE' | 'DENIED'
  message?: string
}

/**
 * Discovers the active Docker socket path across macOS options:
 * 1. Explicit user override
 * 2. DOCKER_HOST env var
 * 3. ~/.docker/run/docker.sock (Docker Desktop standard)
 * 4. /var/run/docker.sock (traditional system default)
 * 5. ~/.orbstack/run/docker.sock (OrbStack)
 * 6. ~/.colima/default/docker.sock (Colima)
 */
export function resolveDockerSocket(overridePath?: string): DockerSocketCheck {
  const home = os.homedir()
  const candidates: string[] = []

  if (overridePath && typeof overridePath === 'string') {
    const trimmed = overridePath.trim()
    if (trimmed.length > 0 && path.isAbsolute(trimmed) && !trimmed.includes('\0')) {
      candidates.push(path.normalize(trimmed))
    }
  }

  const envHost = process.env['DOCKER_HOST']
  if (envHost && envHost.startsWith('unix://')) {
    candidates.push(envHost.replace(/^unix:\/\//, ''))
  }

  candidates.push(
    path.join(home, '.docker/run/docker.sock'),
    '/var/run/docker.sock',
    path.join(home, '.orbstack/run/docker.sock'),
    path.join(home, '.colima/default/docker.sock')
  )

  for (const socketPath of candidates) {
    try {
      if (fs.existsSync(socketPath)) {
        try {
          fs.accessSync(socketPath, fs.constants.R_OK | fs.constants.W_OK)
          return { found: true, socketPath }
        } catch {
          return {
            found: false,
            error: 'DENIED',
            message: `Permission denied accessing Docker socket at ${socketPath}`
          }
        }
      }
    } catch {
      // Continue checking next candidate
    }
  }

  return {
    found: false,
    error: 'DOCKER_UNAVAILABLE',
    message: 'Docker is not installed or not running. No Docker socket found.'
  }
}

/**
 * Pure parser from Dockerode ContainerInfo to DevDeck Container
 */
export function parseDockerContainers(rawContainers: Docker.ContainerInfo[]): Container[] {
  return rawContainers.map((raw) => {
    const rawName = raw.Names && raw.Names.length > 0 ? raw.Names[0] : ''
    const cleanName = rawName.replace(/^\//, '')
    const id = (raw.Id || '').slice(0, 12)
    const image = raw.Image || ''

    let state: ContainerState = 'created'
    const s = (raw.State || '').toLowerCase()
    if (s === 'running') state = 'running'
    else if (s === 'exited') state = 'exited'
    else if (s === 'paused') state = 'paused'
    else if (s === 'restarting') state = 'restarting'
    else if (s === 'dead') state = 'dead'

    const project = raw.Labels?.['com.docker.compose.project'] || null

    const ports: number[] = []
    if (Array.isArray(raw.Ports)) {
      for (const p of raw.Ports) {
        if (p.PublicPort && !ports.includes(p.PublicPort)) {
          ports.push(p.PublicPort)
        } else if (p.PrivatePort && !ports.includes(p.PrivatePort)) {
          ports.push(p.PrivatePort)
        }
      }
    }

    return {
      id,
      name: cleanName,
      image,
      state,
      status: raw.Status || '',
      project,
      ports,
      created: raw.Created || 0
    }
  })
}

export class DockerService {
  private client: Docker | null = null
  private currentSocket: string | null = null
  private activeStreams = new Map<
    string,
    {
      stream: NodeJS.ReadableStream
      buffer: string
      timer: NodeJS.Timeout | null
      onBatch: (text: string) => void
    }
  >()
  private eventStream: NodeJS.ReadableStream | null = null
  private listeners: (() => void)[] = []

  private getClient(overridePath?: string): {
    client: Docker | null
    error?: { code: string; message: string }
  } {
    const check = resolveDockerSocket(overridePath)
    if (!check.found || !check.socketPath) {
      this.client = null
      this.currentSocket = null
      return {
        client: null,
        error: {
          code: check.error || 'DOCKER_UNAVAILABLE',
          message: check.message || 'Docker unavailable'
        }
      }
    }

    if (this.client && this.currentSocket === check.socketPath) {
      return { client: this.client }
    }

    this.currentSocket = check.socketPath
    this.client = new Docker({ socketPath: check.socketPath })
    this.initEvents()
    return { client: this.client }
  }

  public onDockerChanged(callback: () => void): () => void {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback)
    }
  }

  private notifyChanged(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // Ignore listener error
      }
    }
  }

  private initEvents(): void {
    if (!this.client || this.eventStream) return
    try {
      this.client.getEvents((err, stream) => {
        if (err || !stream) return
        this.eventStream = stream

        stream.on('data', (chunk: Buffer) => {
          try {
            const data = JSON.parse(chunk.toString('utf8'))
            if (data.Type === 'container') {
              const action = data.Action || ''
              if (
                ['start', 'stop', 'die', 'destroy', 'pause', 'unpause', 'restart'].some((a) =>
                  action.startsWith(a)
                )
              ) {
                this.notifyChanged()
              }
            }
          } catch {
            // Non-JSON or split chunk
          }
        })

        stream.on('end', () => {
          this.eventStream = null
        })

        stream.on('error', () => {
          this.eventStream = null
        })
      })
    } catch {
      // Events unavailable
    }
  }

  public async listContainers(overridePath?: string): Promise<Result<Container[]>> {
    const { client, error } = this.getClient(overridePath)
    if (!client) {
      return {
        ok: false,
        error: {
          code: (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED') || 'DOCKER_UNAVAILABLE',
          message: error?.message || 'Docker unavailable'
        }
      }
    }

    try {
      // Ping with 2s timeout
      await Promise.race([
        client.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Docker ping timeout')), 2000))
      ])

      const raw = await client.listContainers({ all: true })
      return { ok: true, data: parseDockerContainers(raw) }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to Docker daemon'
      const isRefused =
        msg.includes('ECONNREFUSED') || msg.includes('timeout') || msg.includes('ENOENT')
      return {
        ok: false,
        error: {
          code: 'DOCKER_UNAVAILABLE',
          message: isRefused ? 'Docker is not running.' : msg
        }
      }
    }
  }

  public async containerAction(
    id: string,
    action: 'start' | 'stop' | 'restart',
    overridePath?: string
  ): Promise<Result<null>> {
    if (!/^[a-f0-9]{12,64}$/i.test(id)) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid container ID' } }
    }

    const { client, error } = this.getClient(overridePath)
    if (!client) {
      return {
        ok: false,
        error: {
          code: (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED') || 'DOCKER_UNAVAILABLE',
          message: error?.message || 'Docker unavailable'
        }
      }
    }

    try {
      const container = client.getContainer(id)
      if (action === 'start') {
        await container.start()
      } else if (action === 'stop') {
        await container.stop({ t: 10 })
      } else if (action === 'restart') {
        await container.restart({ t: 10 })
      }
      this.notifyChanged()
      return { ok: true, data: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} container`
      return { ok: false, error: { code: 'INTERNAL', message: msg } }
    }
  }

  public async stopAllContainers(overridePath?: string): Promise<Result<null>> {
    const { client, error } = this.getClient(overridePath)
    if (!client) {
      return {
        ok: false,
        error: {
          code: (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED') || 'DOCKER_UNAVAILABLE',
          message: error?.message || 'Docker unavailable'
        }
      }
    }

    try {
      const raw = await client.listContainers({ all: false }) // running only
      const stopPromises = raw.map((c) =>
        client
          .getContainer(c.Id)
          .stop({ t: 10 })
          .catch(() => null)
      )
      await Promise.all(stopPromises)
      this.notifyChanged()
      return { ok: true, data: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stop all containers'
      return { ok: false, error: { code: 'INTERNAL', message: msg } }
    }
  }

  public async startContainerLogs(
    id: string,
    onBatch: (text: string) => void,
    overridePath?: string
  ): Promise<Result<null>> {
    if (!/^[a-f0-9]{12,64}$/i.test(id)) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid container ID' } }
    }

    // Stop any existing stream for this container first
    this.stopContainerLogs(id)

    const { client, error } = this.getClient(overridePath)
    if (!client) {
      return {
        ok: false,
        error: {
          code: (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED') || 'DOCKER_UNAVAILABLE',
          message: error?.message || 'Docker unavailable'
        }
      }
    }

    try {
      const container = client.getContainer(id)
      const inspect = await container.inspect()
      const isTty = Boolean(inspect.Config?.Tty)

      const stream = (await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
        tail: 200
      })) as NodeJS.ReadableStream

      const state = {
        stream,
        buffer: '',
        timer: null as NodeJS.Timeout | null,
        onBatch
      }

      const flush = (): void => {
        if (state.buffer.length > 0) {
          const text = state.buffer
          state.buffer = ''
          state.onBatch(text)
        }
        state.timer = null
      }

      const append = (data: Buffer | string): void => {
        state.buffer += data.toString()
        if (!state.timer) {
          state.timer = setTimeout(flush, 100)
        }
      }

      if (isTty) {
        stream.on('data', append)
      } else {
        const outStream = new Writable({
          write(chunk, _encoding, callback) {
            append(chunk)
            callback()
          }
        })
        const errStream = new Writable({
          write(chunk, _encoding, callback) {
            append(chunk)
            callback()
          }
        })
        client.modem.demuxStream(stream, outStream, errStream)
      }

      stream.on('end', () => {
        flush()
        this.activeStreams.delete(id)
      })

      stream.on('error', () => {
        flush()
        this.activeStreams.delete(id)
      })

      this.activeStreams.set(id, state)
      return { ok: true, data: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to stream logs'
      return { ok: false, error: { code: 'INTERNAL', message: msg } }
    }
  }

  public stopContainerLogs(id: string): Result<null> {
    const active = this.activeStreams.get(id)
    if (active) {
      if (active.timer) {
        clearTimeout(active.timer)
      }
      if (active.buffer.length > 0) {
        active.onBatch(active.buffer)
      }
      try {
        // Destroy or end stream
        if ('destroy' in active.stream && typeof active.stream.destroy === 'function') {
          active.stream.destroy()
        }
      } catch {
        // Ignore destroy error
      }
      this.activeStreams.delete(id)
    }
    return { ok: true, data: null }
  }

  public stopAllLogs(): void {
    for (const id of Array.from(this.activeStreams.keys())) {
      this.stopContainerLogs(id)
    }
    if (this.eventStream) {
      try {
        if ('destroy' in this.eventStream && typeof this.eventStream.destroy === 'function') {
          this.eventStream.destroy()
        }
      } catch {
        // Ignore destroy error
      }
      this.eventStream = null
    }
  }
}

export const dockerService = new DockerService()
