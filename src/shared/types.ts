export type Result<T> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }

export type ErrorCode = 'DENIED' | 'NOT_FOUND' | 'DOCKER_UNAVAILABLE' | 'INVALID_INPUT' | 'INTERNAL'

export interface Proc {
  pid: number
  ppid: number
  name: string
  command: string
  cpu: number
  memMB: number
  uptimeSec: number
  cwd: string | null
  project: string
  projectPath: string | null
  ports: number[]
}

export interface Settings {
  refreshIntervalSec: 2 | 3 | 5 | 10
  ignoreList: string[]
  customAllowlist: string[]
}

export interface KillReport {
  requested: number[]
  stopped: number[]
  forced: number[]
  refused: number[]
  stillRunning: number[]
}

export interface DevDeckApi {
  getProcesses: () => Promise<Result<Proc[]>>
  getSettings: () => Promise<Result<Settings>>
  updateSettings: (partial: Partial<Settings>) => Promise<Result<Settings>>
  stopProcess: (pid: number) => Promise<Result<KillReport>>
  stopProject: (project: string) => Promise<Result<KillReport>>
  stopAll: () => Promise<Result<KillReport>>
}
