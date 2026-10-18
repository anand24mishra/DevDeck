import type { Proc, Settings, ResourceSample } from '../../shared/types'
import { notificationService } from './notifications'
export class ResourceHistory {
  private samples = new Map<string, ResourceSample[]>()
  private high = new Set<string>()
  constructor(
    private now = Date.now,
    private notify = (name: string, cpu: number, mem: number) =>
      notificationService.projectThreshold(name, cpu, mem)
  ) {}
  observe(procs: Proc[], settings: Settings): void {
    const at = this.now(),
      totals = new Map<string, { cpu: number; memMB: number }>()
    for (const p of procs) {
      if (p.manageable === false) continue
      const total = totals.get(p.project) || { cpu: 0, memMB: 0 }
      total.cpu += p.cpu
      total.memMB += p.memMB
      totals.set(p.project, total)
    }
    for (const [name, series] of this.samples) {
      const valid = series.filter((p) => p.at > at - 3600000)
      if (valid.length) this.samples.set(name, valid)
      else this.samples.delete(name)
    }
    const high = new Set<string>()
    for (const [name, total] of totals) {
      const series = this.samples.get(name) || []
      if (!series.length || at - series[series.length - 1].at >= 1900) {
        series.push({ at, ...total })
        this.samples.set(name, series.slice(-1800))
      }
      const limit = settings.resourceThresholds?.[name]
      if (
        limit &&
        ((limit.cpu && total.cpu >= limit.cpu) || (limit.memMB && total.memMB >= limit.memMB))
      ) {
        high.add(name)
        if (!this.high.has(name)) this.notify(name, total.cpu, total.memMB)
      }
    }
    this.high = high
    while (this.samples.size > 500) this.samples.delete(this.samples.keys().next().value!)
  }
  read(project: string): ResourceSample[] {
    const cutoff = this.now() - 3600000
    return (this.samples.get(project) || []).filter((p) => p.at > cutoff).map((p) => ({ ...p }))
  }
}
export const resourceHistory = new ResourceHistory()
