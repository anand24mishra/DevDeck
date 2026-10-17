import { it, expect } from 'vitest'
import Docker from 'dockerode'
import { DockerService, resolveDockerSocket } from '../../src/main/services/docker'

it.skipIf(process.env.DEVDECK_DOCKER_TEST !== '1')(
  'lists, stops, restarts, reads logs, and removes only its own Docker fixture',
  async ({ skip }) => {
    const socket = resolveDockerSocket(process.env.DEVDECK_DOCKER_SOCKET)
    if (!socket.found || !socket.socketPath) {
      skip()
      return
    }
    const client = new Docker({ socketPath: socket.socketPath, timeout: 5000 })
    try {
      await client.ping()
    } catch {
      skip()
      return
    }
    // Preload this image locally. The test and app never pull images or contact a registry.
    const image = process.env.DEVDECK_DOCKER_IMAGE || 'busybox:1.37'
    await client.getImage(image).inspect()
    const service = new DockerService()
    const container = await client.createContainer({
      Image: image,
      Cmd: ['sh', '-c', "trap 'exit 0' TERM; while true; do echo devdeck-smoke; sleep 1; done"],
      Labels: { 'devdeck.test': 'smoke' },
      HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, Memory: 32 * 1024 * 1024 }
    })
    try {
      await container.start()
      const listed = await service.listContainers(socket.socketPath)
      expect(listed.ok).toBe(true)
      if (!listed.ok) throw new Error('Could not list the Docker fixture')
      expect(listed.data.some((item) => item.id === container.id.slice(0, 12))).toBe(true)
      expect((await service.containerAction(container.id, 'stop', socket.socketPath)).ok).toBe(true)
      expect((await container.inspect()).State.Running).toBe(false)
      expect((await service.containerAction(container.id, 'restart', socket.socketPath)).ok).toBe(
        true
      )
      expect((await container.inspect()).State.Running).toBe(true)
      let logs = ''
      expect(
        (
          await service.startContainerLogs(
            container.id,
            (text) => {
              logs += text
            },
            socket.socketPath
          )
        ).ok
      ).toBe(true)
      await expect.poll(() => logs, { timeout: 5000 }).toContain('devdeck-smoke')
    } finally {
      service.stopAllLogs()
      // A full ID returned by createContainer is the only deletion target.
      await container.remove({ force: true })
    }
    await expect(container.inspect()).rejects.toMatchObject({ statusCode: 404 })
  },
  30_000
)
