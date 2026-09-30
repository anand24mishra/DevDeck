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
  dockerSocketPath?: string
  theme: 'system' | 'light' | 'dark'
  openAtLogin: boolean
  persistRecentlyStopped?: boolean
}

export interface KillReport {
  requested: number[]
  stopped: number[]
  forced: number[]
  refused: number[]
  stillRunning: number[]
}

export type ContainerState = 'running' | 'exited' | 'paused' | 'restarting' | 'created' | 'dead'

export interface Container {
  id: string
  name: string
  image: string
  state: ContainerState
  status: string
  project: string | null
  ports: number[]
  created: number
}

export interface RecentlyStoppedItem {
  id: string
  name: string
  command: string
  args: string[]
  cwd: string | null
  project: string
  stoppedAt: number
  envKeys?: string[]
}

export interface DockerLogMessage {
  id: string
  text: string
}

export interface DevDeckApi {
  getProcesses: () => Promise<Result<Proc[]>>
  getSettings: () => Promise<Result<Settings>>
  updateSettings: (partial: Partial<Settings>) => Promise<Result<Settings>>
  stopProcess: (pid: number) => Promise<Result<KillReport>>
  stopProject: (project: string) => Promise<Result<KillReport>>
  stopAll: () => Promise<Result<KillReport>>
  getRecentlyStopped: () => Promise<Result<RecentlyStoppedItem[]>>
  restartStopped: (id: string) => Promise<Result<{ pid?: number }>>
  clearRecentlyStopped: () => Promise<Result<null>>
  onRecentlyStoppedChanged: (callback: () => void) => () => void
  listContainers: () => Promise<Result<Container[]>>
  containerAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<Result<null>>
  stopAllContainers: () => Promise<Result<null>>
  startContainerLogs: (id: string) => Promise<Result<null>>
  stopContainerLogs: (id: string) => Promise<Result<null>>
  onDockerLog: (callback: (msg: DockerLogMessage) => void) => () => void
  onDockerChanged: (callback: () => void) => () => void
}
