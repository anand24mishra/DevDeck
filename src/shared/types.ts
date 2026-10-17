export type Result<T> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }

export type ErrorCode = 'DENIED' | 'NOT_FOUND' | 'DOCKER_UNAVAILABLE' | 'INVALID_INPUT' | 'INTERNAL'

export interface ProcessIdentity {
  pid: number
  startTime: string
  command: string
}

export interface Proc extends ProcessIdentity {
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
  sockets?: ListeningSocket[]
}

export interface Settings {
  refreshIntervalSec: 2 | 3 | 5 | 10
  ignoreList: string[]
  customAllowlist: string[]
  dockerSocketPath?: string
  theme: 'system' | 'light' | 'dark'
  openAtLogin: boolean
  memoryThresholdMb?: number
  hotkey?: string | null
  preferredEditor?: string
  preferredTerminal?: string
  persistRecentlyStopped?: boolean
}

export interface KillReport {
  undoItems?: { id: string; name: string }[]
  refusalReasons?: Record<number, 'identity-changed' | 'not-allowed'>
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
  getInstalledApps: () => Promise<Result<InstalledApplication[]>>
  openProjectInEditor: (path: string) => Promise<Result<null>>
  showProjectInFinder: (path: string) => Promise<Result<null>>
  openProjectInTerminal: (path: string) => Promise<Result<null>>
  openLocalUrl: (url: string) => Promise<Result<null>>
  lookupPort: (port: number, project?: string) => Promise<Result<PortOwner[]>>
  getProcesses: () => Promise<Result<Proc[]>>
  getSettings: () => Promise<Result<Settings>>
  updateSettings: (partial: Partial<Settings>) => Promise<Result<Settings>>
  stopProcess: (target: ProcessIdentity) => Promise<Result<KillReport>>
  stopProject: (project: string, targets: ProcessIdentity[]) => Promise<Result<KillReport>>
  stopAll: (targets: ProcessIdentity[]) => Promise<Result<KillReport>>
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

export interface ListeningSocket {
  pid: number
  name: string
  port: number
  address: string
}
export interface PortOwner extends ListeningSocket {
  process: Proc | null
  kind?: 'project' | 'other-project' | 'docker' | 'ssh' | 'kubectl' | 'tunnel' | 'readonly'
  explanation?: string
  suggestedAction?: 'stop-process' | 'stop-container' | 'none'
  containerId?: string
}

export interface InstalledApplication {
  id: string
  name: string
  path: string
  kind: 'editor' | 'terminal'
  cli?: boolean
}
