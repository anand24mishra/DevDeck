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
  pgid?: number
  status?: 'running' | 'paused' | 'zombie'
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
  establishedConnections?: number
  openFilesCount?: number
  tunnel?: { kind: 'ssh' | 'kubectl' | 'ngrok' | 'cloudflared' | 'tailscale'; target?: string }
  leftoverReason?: string
  manageable?: boolean
  readOnlyReason?: string
  idleHint?: string
  user?: string
  parentName?: string
}

export interface Settings {
  refreshIntervalSec: 2 | 3 | 5 | 10
  ignoreList: string[]
  customAllowlist: string[]
  dockerSocketPath?: string
  theme: 'system' | 'light' | 'dark'
  openAtLogin: boolean
  showEnvViewer?: boolean
  onboardingComplete?: boolean
  hintsEnabled?: boolean
  notifications?: NotificationPreferences
  memoryThresholdMb?: number
  hotkey?: string | null
  preferredEditor?: string
  preferredTerminal?: string
  persistRecentlyStopped?: boolean
}

export interface KillReport {
  signaled?: number[]
  cancelled?: boolean
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
  hasVolumes?: boolean
  service?: string
  dependsOn?: string[]
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
  onFocusTarget: (callback: (target: FocusTarget) => void) => () => void
  getProjectContext: (path: string) => Promise<Result<ProjectContext>>
  getInstalledApps: () => Promise<Result<InstalledApplication[]>>
  openProjectInEditor: (path: string) => Promise<Result<null>>
  showProjectInFinder: (path: string) => Promise<Result<null>>
  openProjectInTerminal: (path: string) => Promise<Result<null>>
  openLocalUrl: (url: string) => Promise<Result<null>>
  lookupPort: (port: number, project?: string) => Promise<Result<PortOwner[]>>
  signalProcess: (
    action: ProcessSignalAction,
    target: ProcessIdentity
  ) => Promise<Result<KillReport>>
  getProcessEnvironment: (pid: number, startTime: string) => Promise<Result<EnvironmentEntry[]>>
  getProcessDetails: (pid: number, startTime: string) => Promise<Result<ProcessDetails>>
  getProcessTree: () => Promise<Result<ProcessTreeNode[]>>
  stopProcessTree: (
    root: ProcessIdentity,
    targets: ProcessIdentity[]
  ) => Promise<Result<KillReport>>
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
  getDockerApps: () => Promise<Result<DockerDesktopApp[]>>
  launchDockerApp: (app: 'desktop' | 'orbstack') => Promise<Result<null>>
  removeContainer: (id: string) => Promise<Result<null>>
  composeAction: (
    project: string,
    action: 'start' | 'stop' | 'restart',
    ids: string[]
  ) => Promise<Result<ContainerActionReport[]>>
  listContainers: () => Promise<Result<Container[]>>
  containerAction: (id: string, action: 'start' | 'stop' | 'restart') => Promise<Result<null>>
  stopAllContainers: () => Promise<Result<null>>
  startContainerLogs: (id: string) => Promise<Result<null>>
  stopContainerLogs: (id: string) => Promise<Result<null>>
  onDockerLog: (callback: (msg: DockerLogMessage) => void) => () => void
  onDockerChanged: (callback: () => void) => () => void
}

export interface ListeningSocket {
  protocol?: 'TCP' | 'UDP'
  family?: 'IPv4' | 'IPv6'
  state?: 'LISTEN' | 'ESTABLISHED'
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

export interface NotificationPreferences {
  serverStopped: boolean
  memory: boolean
  actionResults: boolean
  networkExposure: boolean
}
export const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  serverStopped: false,
  memory: false,
  actionResults: true,
  networkExposure: false
}
export interface FocusTarget {
  pid?: number
  project?: string
  port?: number
}

export interface ContainerActionReport {
  id: string
  name: string
  ok: boolean
  message?: string
}

export interface DockerDesktopApp {
  id: 'desktop' | 'orbstack'
  name: string
  path: string
}

export interface ProcessTreeNode {
  process: Proc
  children: ProcessTreeNode[]
}

export interface ProcessDetails {
  canViewEnvironment?: boolean
  process: Proc
  user: string
  parentName: string
  runtime?: string[]
}

export interface EnvironmentEntry {
  key: string
  value: string
  sensitive: boolean
}

export type ProcessSignalAction = 'pause' | 'resume' | 'reload' | 'group' | 'stop'

export interface ProjectContext {
  branch?: string
  dirty?: boolean
  runtime?: string[]
}
