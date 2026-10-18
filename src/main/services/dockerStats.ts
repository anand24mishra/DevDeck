import type Docker from 'dockerode'
import type { ContainerStatsSample } from '../../shared/types'

export function parseContainerStats(raw: Docker.ContainerStats): ContainerStatsSample {
  const cpu = raw.cpu_stats,
    previous = raw.precpu_stats
  const delta = (cpu?.cpu_usage?.total_usage || 0) - (previous?.cpu_usage?.total_usage || 0)
  const system = (cpu?.system_cpu_usage || 0) - (previous?.system_cpu_usage || 0)
  const cores = cpu?.online_cpus || cpu?.cpu_usage?.percpu_usage?.length || 1
  const memory = raw.memory_stats
  const cache =
    memory?.stats?.inactive_file || memory?.stats?.total_inactive_file || memory?.stats?.cache || 0
  const networks = Object.values(raw.networks || {})
  return {
    at: Date.now(),
    cpu: delta >= 0 && system > 0 ? (delta / system) * cores * 100 : 0,
    memMB: Math.max(0, (memory?.usage || 0) - cache) / 1048576,
    rxBytes: networks.reduce((sum, network) => sum + (network.rx_bytes || 0), 0),
    txBytes: networks.reduce((sum, network) => sum + (network.tx_bytes || 0), 0)
  }
}
type Slot = {
  cancelled: boolean
  stream?: NodeJS.ReadableStream
  timer?: NodeJS.Timeout
  latest?: ContainerStatsSample
  buffer: string
}
export class DockerStatsService {
  private slots = new Map<string, Slot>()
  async start(
    id: string,
    open: () => Promise<NodeJS.ReadableStream>,
    onSample: (sample: ContainerStatsSample) => void,
    visible: () => boolean
  ): Promise<void> {
    if (this.slots.has(id) || !visible() || this.slots.size >= 200) return
    const slot: Slot = { cancelled: false, buffer: '' }
    this.slots.set(id, slot)
    try {
      const stream = await open()
      slot.stream = stream
      if (slot.cancelled || !visible()) {
        this.close(id, slot)
        return
      }
      slot.timer = setInterval(() => {
        if (!visible()) {
          this.close(id, slot)
          return
        }
        if (slot.latest) {
          onSample(slot.latest)
          slot.latest = undefined
        }
      }, 1000)
      stream.on('data', (chunk: Buffer) => {
        slot.buffer += chunk.toString('utf8')
        if (slot.buffer.length > 1048576) {
          this.close(id, slot)
          return
        }
        let newline = slot.buffer.indexOf('\n')
        while (newline >= 0) {
          const line = slot.buffer.slice(0, newline)
          slot.buffer = slot.buffer.slice(newline + 1)
          try {
            slot.latest = parseContainerStats(JSON.parse(line))
          } catch {
            /* Ignore incomplete/malformed samples. */
          }
          newline = slot.buffer.indexOf('\n')
        }
      })
      stream.once('end', () => this.close(id, slot))
      stream.once('error', () => this.close(id, slot))
      stream.once('close', () => this.close(id, slot))
    } catch {
      this.close(id, slot)
    }
  }
  private close(id: string, slot: Slot): void {
    slot.cancelled = true
    if (slot.timer) clearInterval(slot.timer)
    if (
      slot.stream &&
      'destroy' in slot.stream &&
      typeof slot.stream.destroy === 'function' &&
      !('destroyed' in slot.stream && slot.stream.destroyed)
    )
      slot.stream.destroy()
    if (this.slots.get(id) === slot) this.slots.delete(id)
  }
  stop(ids: string[]): void {
    for (const id of ids) {
      const slot = this.slots.get(id)
      if (slot) this.close(id, slot)
    }
  }
  stopAll(): void {
    this.stop([...this.slots.keys()])
  }
}
