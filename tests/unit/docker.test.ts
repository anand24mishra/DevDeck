import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import { resolveDockerSocket, parseDockerContainers } from '../../src/main/services/docker'

describe('Docker socket discovery', () => {
  it('honors valid user override socket path', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/custom/docker.sock')
    vi.spyOn(fs, 'accessSync').mockReturnValue(undefined)

    const check = resolveDockerSocket('/custom/docker.sock')
    expect(check.found).toBe(true)
    expect(check.socketPath).toBe('/custom/docker.sock')

    vi.restoreAllMocks()
  })

  it('detects standard socket paths when available', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/var/run/docker.sock')
    vi.spyOn(fs, 'accessSync').mockReturnValue(undefined)

    const check = resolveDockerSocket()
    expect(check.found).toBe(true)
    expect(check.socketPath).toBe('/var/run/docker.sock')

    vi.restoreAllMocks()
  })

  it('reports DOCKER_UNAVAILABLE when no socket exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    const check = resolveDockerSocket()
    expect(check.found).toBe(false)
    expect(check.error).toBe('DOCKER_UNAVAILABLE')
    expect(check.message).toContain('Docker is not installed or not running')

    vi.restoreAllMocks()
  })

  it('reports DENIED when socket exists but permissions are insufficient', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'accessSync').mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    const check = resolveDockerSocket('/var/run/docker.sock')
    expect(check.found).toBe(false)
    expect(check.error).toBe('DENIED')
    expect(check.message).toContain('Permission denied')

    vi.restoreAllMocks()
  })
})

describe('Docker container parser', () => {
  it('parses raw Dockerode ContainerInfo objects into clean DevDeck Containers', () => {
    const rawFixture: any[] = [
      {
        Id: 'abcdef1234567890abcdef',
        Names: ['/my-web-app'],
        Image: 'nginx:alpine',
        State: 'running',
        Status: 'Up 2 hours',
        Created: 1727700000,
        Labels: {
          'com.docker.compose.project': 'ecommerce-app',
          'com.docker.compose.service': 'web'
        },
        Ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }]
      },
      {
        Id: '123456abcdef7890fedcba',
        Names: ['/db-postgres'],
        Image: 'postgres:16',
        State: 'exited',
        Status: 'Exited (0) 10 minutes ago',
        Created: 1727600000,
        Labels: {
          'com.docker.compose.project': 'ecommerce-app'
        },
        Ports: [{ PrivatePort: 5432, Type: 'tcp' }]
      },
      {
        Id: '987654321000fedcba9876',
        Names: ['/standalone-redis'],
        Image: 'redis:latest',
        State: 'running',
        Status: 'Up 1 day',
        Created: 1727500000,
        Labels: {},
        Ports: [{ IP: '127.0.0.1', PrivatePort: 6379, PublicPort: 6379, Type: 'tcp' }]
      }
    ]

    const containers = parseDockerContainers(rawFixture)

    expect(containers).toHaveLength(3)

    // First container (web)
    expect(containers[0].id).toBe('abcdef123456')
    expect(containers[0].name).toBe('my-web-app')
    expect(containers[0].image).toBe('nginx:alpine')
    expect(containers[0].state).toBe('running')
    expect(containers[0].project).toBe('ecommerce-app')
    expect(containers[0].ports).toEqual([8080])

    // Second container (db)
    expect(containers[1].id).toBe('123456abcdef')
    expect(containers[1].name).toBe('db-postgres')
    expect(containers[1].state).toBe('exited')
    expect(containers[1].project).toBe('ecommerce-app')
    expect(containers[1].ports).toEqual([])

    // Third container (standalone)
    expect(containers[2].id).toBe('987654321000')
    expect(containers[2].name).toBe('standalone-redis')
    expect(containers[2].state).toBe('running')
    expect(containers[2].project).toBeNull()
    expect(containers[2].ports).toEqual([6379])
  })

  it('handles empty names, missing labels, and undefined ports gracefully', () => {
    const rawFixture: any[] = [
      {
        Id: 'shortid',
        Names: [],
        Image: 'busybox',
        State: 'UNKNOWN_STATE',
        Status: 'Created',
        Created: 0,
        Labels: null,
        Ports: null
      }
    ]

    const containers = parseDockerContainers(rawFixture)
    expect(containers[0].name).toBe('')
    expect(containers[0].state).toBe('created')
    expect(containers[0].project).toBeNull()
    expect(containers[0].ports).toEqual([])
  })
})

describe('Compose dependency ordering', () => {
  it('starts dependencies before dependents and rejects dependency cycles', async () => {
    const { orderCompose } = await import('../../src/main/services/docker')
    const db = {
      id: 'aaaaaaaaaaaa',
      name: 'db',
      service: 'db',
      dependsOn: []
    } as import('../../src/shared/types').Container
    const web = {
      id: 'bbbbbbbbbbbb',
      name: 'app',
      service: 'web',
      dependsOn: ['db']
    } as import('../../src/shared/types').Container
    expect(orderCompose([web, db]).map((item) => item.id)).toEqual([db.id, web.id])
    expect(() => orderCompose([{ ...db, dependsOn: ['web'] }, web])).toThrow('Dependency cycle')
  })
})

it('restarts a Compose stack in dependency order, reports failures, and preserves volumes on removal', async () => {
  const { DockerService } = await import('../../src/main/services/docker')
  const db = 'aaaaaaaaaaaa',
    web = 'bbbbbbbbbbbb'
  const running = new Map([
    [db, true],
    [web, true]
  ])
  const order: string[] = []
  let failWeb = false,
    volumePresent = true
  const client = {
    ping: async () => {},
    listContainers: async () =>
      [...running].map(([id, active]) => ({
        Id: id,
        Names: [id === db ? '/db' : '/app'],
        State: active ? 'running' : 'exited',
        Labels: {
          'com.docker.compose.project': 'shop',
          'com.docker.compose.service': id === db ? 'db' : 'web',
          'com.docker.compose.depends_on': id === web ? 'db:service_started:false' : ''
        },
        Mounts: [{ Type: 'volume' }]
      })),
    getContainer: (id: string) => ({
      inspect: async () => ({ State: { Running: running.get(id) }, Mounts: [{ Type: 'volume' }] }),
      stop: async () => {
        order.push(`stop:${id}`)
        if (id === web && failWeb) throw new Error('fixture failure')
        running.set(id, false)
      },
      start: async () => {
        order.push(`start:${id}`)
        running.set(id, true)
      },
      remove: async (options: { v: boolean; force: boolean }) => {
        if (options.v) volumePresent = false
        expect(options.force).toBe(false)
        running.delete(id)
      }
    })
  }
  const service = new DockerService(client as unknown as import('dockerode'))
  const restarted = await service.composeAction('shop', 'restart', [db, web])
  expect(restarted.ok).toBe(true)
  expect(order).toEqual([`stop:${web}`, `stop:${db}`, `start:${db}`, `start:${web}`])
  failWeb = true
  const stopped = await service.composeAction('shop', 'stop', [db, web])
  expect(stopped.ok && stopped.data.find((item) => item.id === web)?.ok).toBe(false)
  expect(stopped.ok && stopped.data.find((item) => item.id === db)?.ok).toBe(true)
  expect((await service.removeContainer(db)).ok).toBe(true)
  expect(running.has(db)).toBe(false)
  expect(volumePresent).toBe(true)
})
