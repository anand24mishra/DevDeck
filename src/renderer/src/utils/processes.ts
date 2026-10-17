import type { Proc } from '../../../shared/types'

export type ProcessSort = 'name' | 'memory' | 'cpu' | 'uptime' | 'port'
export function processTotals(processes: Proc[]): { memMB: number; cpu: number } {
  return processes.reduce(
    (sum, proc) => ({ memMB: sum.memMB + proc.memMB, cpu: sum.cpu + proc.cpu }),
    { memMB: 0, cpu: 0 }
  )
}
export function sortProcesses(processes: Proc[], sort: ProcessSort): Proc[] {
  return processes
    .map((proc, index) => ({ proc, index }))
    .sort((a, b) => {
      const difference =
        sort === 'memory'
          ? b.proc.memMB - a.proc.memMB
          : sort === 'cpu'
            ? b.proc.cpu - a.proc.cpu
            : sort === 'uptime'
              ? b.proc.uptimeSec - a.proc.uptimeSec
              : sort === 'port'
                ? (a.proc.ports[0] ?? Infinity) - (b.proc.ports[0] ?? Infinity)
                : a.proc.name.localeCompare(b.proc.name)
      return difference || a.index - b.index
    })
    .map(({ proc }) => proc)
}
