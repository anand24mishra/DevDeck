import { Notification } from 'electron'
import {
  DEFAULT_NOTIFICATIONS,
  type FocusTarget,
  type KillReport,
  type Proc,
  type Settings
} from '../../shared/types'

type Notice = { title: string; body: string; target: FocusTarget }
export class NotificationService {
  private previous = new Map<number, Proc>()
  private high = new Set<string>()
  private expected = new Map<number, number>()
  private focus: (target: FocusTarget) => void = () => {}
  constructor(private readonly send?: (notice: Notice) => void) {}
  setFocus(focus: (target: FocusTarget) => void): void {
    this.focus = focus
  }
  private notify(notice: Notice): void {
    if (this.send) {
      this.send(notice)
      return
    }
    if (!Notification.isSupported()) return
    const notification = new Notification({ title: notice.title, body: notice.body, silent: true })
    notification.on('click', () => this.focus(notice.target))
    notification.show()
  }
  expectStops(processes: { pid: number }[]): void {
    for (const proc of processes) this.expected.set(proc.pid, Date.now() + 15_000)
  }
  observe(processes: Proc[], settings: Settings): void {
    const preferences = settings.notifications || DEFAULT_NOTIFICATIONS
    const current = new Map(processes.map((proc) => [proc.pid, proc]))
    if (preferences.serverStopped)
      for (const old of this.previous.values()) {
        if (
          old.ports.length &&
          current.get(old.pid)?.startTime !== old.startTime &&
          (this.expected.get(old.pid) || 0) < Date.now()
        )
          this.notify({
            title: 'A watched server stopped',
            body: `${old.name} in ${old.project} is no longer running.`,
            target: { project: old.project }
          })
      }
    const high = new Set<string>()
    for (const proc of processes) {
      const identity = `${proc.pid}:${proc.startTime}`
      if (proc.memMB >= (settings.memoryThresholdMb || 4096)) {
        high.add(identity)
        if (preferences.memory && !this.high.has(identity))
          this.notify({
            title: 'High memory use',
            body: `${proc.name} in ${proc.project} is using ${proc.memMB} MB.`,
            target: { pid: proc.pid, project: proc.project }
          })
      }
    }
    this.previous = current
    this.high = high
    for (const [pid, expiry] of this.expected) if (expiry < Date.now()) this.expected.delete(pid)
  }
  report(report: KillReport, settings: Settings): void {
    if (!(settings.notifications || DEFAULT_NOTIFICATIONS).actionResults) return
    this.notify({
      title: 'Stop finished',
      body: `${report.stopped.length} stopped, ${report.forced.length} force stopped, ${report.refused.length} skipped, ${report.stillRunning.length} still running.`,
      target: {}
    })
  }
}
export const notificationService = new NotificationService()
