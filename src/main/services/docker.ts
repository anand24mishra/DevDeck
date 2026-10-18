import { DockerStatsService } from './dockerStats'
import type { ContainerStatsSample } from '../../shared/types'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Writable } from 'stream'
import Docker from 'dockerode'
import {
  Container,
  ContainerState,
  Result,
  ContainerActionReport,
  ContainerInspection,
  DockerDesktopApp
} from '../../shared/types'

export interface DockerSocketCheck {
  found: boolean
  socketPath?: string
  error?: 'DOCKER_UNAVAILABLE' | 'DENIED' | 'INVALID_INPUT'
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

  if (overridePath !== undefined && overridePath.trim()) {
    const trimmed = overridePath.trim()
    if (!path.isAbsolute(trimmed) || trimmed.includes('\0') || !fs.existsSync(trimmed))
      return {
        found: false,
        error: 'INVALID_INPUT',
        message:
          'The Docker connection path is invalid. Choose an existing local Docker socket in Settings.'
      }
    candidates.push(path.normalize(trimmed))
  }

  const envHost = process.env['DOCKER_HOST']
  if (envHost && envHost.startsWith('unix://')) {
    candidates.push(envHost.replace(/^unix:\/\//, ''))
  }

  if (!candidates.length)
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
          if (!fs.statSync(socketPath).isSocket())
            return {
              found: false,
              error: 'INVALID_INPUT',
              message:
                'The Docker connection path is not a socket. Choose a Docker socket in Settings.'
            }
          return { found: true, socketPath }
        } catch {
          return {
            found: false,
            error: 'DENIED',
            message:
              'DevDeck cannot access Docker. Check your user access to the selected Docker connection.'
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
    message: detectDockerApps().length
      ? 'Docker is stopped. Start Docker Desktop or OrbStack, then check again.'
      : 'Docker is not installed. Install Docker Desktop, OrbStack, or Colima, then check again.'
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
      created: raw.Created || 0,
      hasVolumes: !!raw.Mounts?.length,
      service: raw.Labels?.['com.docker.compose.service'],
      dependsOn: (raw.Labels?.['com.docker.compose.depends_on'] || '')
        .split(',')
        .map((entry) => entry.split(':')[0])
        .filter(Boolean)
    }
  })
}

export class DockerService {
  private statsService = new DockerStatsService()
  constructor(private readonly injectedClient?: Docker) {}
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
    if (this.injectedClient) return { client: this.injectedClient }
    const check = resolveDockerSocket(overridePath)
    if (!check.found || !check.socketPath) {
      this.stopAllConnections()
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

    this.stopAllConnections()
    this.currentSocket = check.socketPath
    this.client = new Docker({ socketPath: check.socketPath })
    this.initEvents()
    return { client: this.client }
  }

  public async inspectContainer(
    id: string,
    override?: string
  ): Promise<Result<ContainerInspection>> {
    const { client, error } = this.getClient(override)
    if (!client)
      return {
        ok: false,
        error: { code: 'DOCKER_UNAVAILABLE', message: error?.message || 'Docker unavailable' }
      }
    try {
      const data = await client.getContainer(id).inspect()
      return {
        ok: true,
        data: {
          environment: (data.Config?.Env || []).slice(0, 1000).map((entry) => {
            const at = entry.indexOf('=')
            return {
              key: entry.slice(0, at < 0 ? entry.length : at),
              value: at < 0 ? '' : entry.slice(at + 1, at + 65537)
            }
          }),
          mounts: (data.Mounts || [])
            .slice(0, 200)
            .map((m) => `${m.Source} → ${m.Destination}${m.RW ? '' : ' (read only)'}`),
          networks: Object.keys(data.NetworkSettings?.Networks || {}).slice(0, 200),
          health: data.State.Health?.Status || data.State.Status,
          restartCount: data.RestartCount,
          exitCode: data.State.ExitCode,
          oomKilled: data.State.OOMKilled
        }
      }
    } catch {
      return {
        ok: false,
        error: {
          code: 'DOCKER_UNAVAILABLE',
          message: 'Could not inspect this container. Check Docker and try again.'
        }
      }
    }
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
      const requestedClient = this.client
      requestedClient.getEvents((err, stream) => {
        if (err || !stream) return
        if (this.client !== requestedClient) {
          if ('destroy' in stream && typeof stream.destroy === 'function') stream.destroy()
          return
        }
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
          if (this.eventStream === stream) this.eventStream = null
        })

        stream.on('error', () => {
          if (this.eventStream === stream) this.eventStream = null
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
          code:
            (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED' | 'INVALID_INPUT') ||
            'DOCKER_UNAVAILABLE',
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
          message: isRefused
            ? 'Docker is stopped. Start your Docker provider, then check again.'
            : 'Could not connect to Docker. Check your provider and connection path, then try again.'
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
          code:
            (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED' | 'INVALID_INPUT') ||
            'DOCKER_UNAVAILABLE',
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

  public async startStats(
    ids: string[],
    onSample: (id: string, sample: ContainerStatsSample) => void,
    visible: () => boolean,
    overridePath?: string
  ): Promise<Result<null>> {
    const { client } = this.getClient(overridePath)
    if (!client || !visible())
      return {
        ok: false,
        error: {
          code: 'DOCKER_UNAVAILABLE',
          message: 'Stats are available while Docker and this window are open.'
        }
      }
    const listed = await this.listContainers(overridePath)
    if (!listed.ok) return listed
    if (
      ids.some(
        (id) =>
          !listed.data.some((container) => container.id === id && container.state === 'running')
      )
    )
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'This container stopped. Refresh the list.' }
      }
    await Promise.all(
      ids.map((id) =>
        this.statsService.start(
          id,
          () => client.getContainer(id).stats({ stream: true }),
          (sample) => onSample(id, sample),
          visible
        )
      )
    )
    return { ok: true, data: null }
  }
  public stopStats(ids: string[]): void {
    this.statsService.stop(ids)
  }
  public stopAllStats(): void {
    this.statsService.stopAll()
  }

  public async removeContainer(id: string, overridePath?: string): Promise<Result<null>> {
    if (!/^[a-f0-9]{12,64}$/.test(id))
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid container ID' } }
    const { client } = this.getClient(overridePath)
    if (!client)
      return {
        ok: false,
        error: { code: 'DOCKER_UNAVAILABLE', message: 'Start Docker and try again.' }
      }
    try {
      const container = client.getContainer(id)
      const details = await container.inspect()
      if (details.State.Running) await container.stop({ t: 10 })
      await container.remove({ v: false, force: false })
      this.stopContainerLogs(id)
      this.notifyChanged()
      return { ok: true, data: null }
    } catch {
      return {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: 'Could not remove this container. Check Docker and try again.'
        }
      }
    }
  }

  public async composeAction(
    project: string,
    action: 'start' | 'stop' | 'restart',
    ids: string[],
    overridePath?: string
  ): Promise<Result<ContainerActionReport[]>> {
    const listed = await this.listContainers(overridePath)
    if (!listed.ok) return listed
    const members = listed.data.filter((item) => item.project === project && ids.includes(item.id))
    let ordered: Container[]
    try {
      ordered = orderCompose(members)
    } catch {
      return {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'This stack has a dependency cycle. Use individual container actions.'
        }
      }
    }
    const reports = new Map<string, ContainerActionReport>(
      ids.map((id) => [
        id,
        {
          id,
          name: members.find((item) => item.id === id)?.name || id,
          ok: members.some((item) => item.id === id),
          message: members.some((item) => item.id === id)
            ? undefined
            : 'Not a member of this stack.'
        }
      ])
    )
    const stages: ('start' | 'stop')[] = action === 'restart' ? ['stop', 'start'] : [action]
    for (const stage of stages)
      for (const member of stage === 'stop' ? [...ordered].reverse() : ordered) {
        if (!reports.get(member.id)?.ok) continue
        if (
          (stage === 'start' && action === 'start' && member.state === 'running') ||
          (stage === 'stop' && member.state !== 'running')
        )
          continue
        const result = await this.containerAction(member.id, stage, overridePath)
        if (!result.ok)
          reports.set(member.id, {
            id: member.id,
            name: member.name,
            ok: false,
            message: `Could not ${stage} this container.`
          })
      }
    return { ok: true, data: [...reports.values()] }
  }

  public async stopAllContainers(overridePath?: string): Promise<Result<null>> {
    const { client, error } = this.getClient(overridePath)
    if (!client) {
      return {
        ok: false,
        error: {
          code:
            (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED' | 'INVALID_INPUT') ||
            'DOCKER_UNAVAILABLE',
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
          code:
            (error?.code as 'DOCKER_UNAVAILABLE' | 'DENIED' | 'INVALID_INPUT') ||
            'DOCKER_UNAVAILABLE',
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

  public stopAllConnections(): void {
    this.statsService.stopAll()
    this.stopAllLogs()
    const stream = this.eventStream
    this.eventStream = null
    if (stream && 'destroy' in stream && typeof stream.destroy === 'function') stream.destroy()
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

export function orderCompose(containers: Container[]): Container[] {
  const ordered: Container[] = [],
    visiting = new Set<string>(),
    visited = new Set<string>()
  const visit = (container: Container): void => {
    if (visiting.has(container.id)) throw new Error('Dependency cycle')
    if (visited.has(container.id)) return
    visiting.add(container.id)
    for (const dependency of container.dependsOn || []) {
      const member = containers.find((item) => item.service === dependency)
      if (member) visit(member)
    }
    visiting.delete(container.id)
    visited.add(container.id)
    ordered.push(container)
  }
  for (const container of [...containers].sort((a, b) => a.name.localeCompare(b.name)))
    visit(container)
  return ordered
}

export function detectDockerApps(): DockerDesktopApp[] {
  return (['desktop', 'orbstack'] as const).flatMap((id) => {
    const name = id === 'desktop' ? 'Docker' : 'OrbStack'
    const found = ['/Applications', path.join(os.homedir(), 'Applications')]
      .map((directory) => path.join(directory, `${name}.app`))
      .find((appPath) => fs.existsSync(appPath))
    return found
      ? [{ id, name: id === 'desktop' ? 'Docker Desktop' : 'OrbStack', path: found }]
      : []
  })
}
