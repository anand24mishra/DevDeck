import { expect, it, vi } from 'vitest'
import { PassThrough } from 'stream'
import { DockerStatsService, parseContainerStats } from '../../src/main/services/dockerStats'

it('calculates CPU, non-cache memory and network totals', () => {
  const sample = parseContainerStats({
    cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 2000, online_cpus: 2 },
    precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000 },
    memory_stats: { usage: 104857600, stats: { inactive_file: 10485760 } },
    networks: { eth0: { rx_bytes: 20, tx_bytes: 30 } }
  } as unknown as import('dockerode').ContainerStats)
  expect(sample).toMatchObject({ cpu: 20, memMB: 90, rxBytes: 20, txBytes: 30 })
})
it('closes a pending stats stream after hide before it finishes opening', async () => {
  const service = new DockerStatsService(),
    stream = new PassThrough()
  let resolve: ((stream: PassThrough) => void) | undefined
  const pending = service.start(
    'aaaaaaaaaaaa',
    () =>
      new Promise((done) => {
        resolve = done
      }),
    () => {},
    () => true
  )
  service.stopAll()
  resolve!(stream)
  await pending
  expect(stream.destroyed).toBe(true)
})
it('batches samples once per second and stops all timers with streams', async () => {
  vi.useFakeTimers()
  const service = new DockerStatsService(),
    stream = new PassThrough(),
    samples: unknown[] = []
  try {
    await service.start(
      'aaaaaaaaaaaa',
      async () => stream,
      (sample) => samples.push(sample),
      () => true
    )
    stream.write('{}\n{}\n')
    await vi.advanceTimersByTimeAsync(1000)
    expect(samples).toHaveLength(1)
    service.stopAll()
    await vi.advanceTimersByTimeAsync(2000)
    expect(samples).toHaveLength(1)
    expect(stream.destroyed).toBe(true)
  } finally {
    service.stopAll()
    vi.useRealTimers()
  }
})
