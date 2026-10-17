# 03 — IPC contract (the seam between UI and main)

Change this file first, then both sides. Types live in `src/shared/types.ts`.

## Types
```ts
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }
export type ErrorCode = 'DENIED' | 'NOT_FOUND' | 'DOCKER_UNAVAILABLE' | 'INVALID_INPUT' | 'INTERNAL'

export interface Proc {
  pid: number; startTime: string; ppid: number; name: string; command: string   // command may contain secrets: never log
  cpu: number; memMB: number; uptimeSec: number
  cwd: string | null; project: string; projectPath?: string | null; ports: number[]
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
export interface ProcessIdentity { pid: number; startTime: string; command: string }
export interface KillReport { refusalReasons?: Record<number, 'identity-changed' | 'not-allowed'>; requested: number[]; stopped: number[]; forced: number[]; refused: number[]; stillRunning: number[] }
export interface Container {
  id: string
  name: string
  image: string
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'created' | 'dead'
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
}
```

## Channels (v1.0 & v1.1)
| Channel | Input | Output | Notes |
|---|---|---|---|
| `procs:list` | – | `Result<Proc[]>` | allowlisted processes only |
| `procs:stop` | `{ targets: ProcessIdentity[] }` | `Result<KillReport>` | main re-validates every pid |
| `procs:stopProject` | `{ project: string; targets: ProcessIdentity[] }` | `Result<KillReport>` | main resolves pids itself |
| `recent:list` | – | `Result<RecentlyStoppedItem[]>` | implemented: last 20 stopped dev processes |
| `recent:restart` | `{ id: string }` | `Result<{ pid?: number }>` | implemented: re-validates allowlist and working directory |
| `recent:clear` | – | `Result<null>` | clear stopped memory list |
| `docker:list` | – | `Result<Container[]>` | list all containers |
| `docker:action` | `{ id: string; action: 'start'\|'stop'\|'restart' }` | `Result<null>` | container action |
| `docker:stopAll` | – | `Result<null>` | stop all running containers |
| `docker:logs:start` / `stop` | `{ id: string }` | `Result<null>` | stream via event below |
| `settings:get` / `set` | partial settings | `Result<Settings>` | validated with a schema |
Events main → renderer: `docker:log` `{ id: string; text: string }` (batched every 100 ms), `docker:changed`, `procs:changed`, `recent:changed`.

## Validation rules
- Sender must be our window's own page. PIDs are integers > 1, at most 500 per call.
- Container ids match `^[a-f0-9]{12,64}$`. Actions come from a fixed list.
- Unknown channels and extra fields are rejected.

## v1.1 / v2 additions (reserve names now)
`recent:list`, `recent:restart`, `profiles:*`, `ports:whoUses`, `alerts:*`, `docker:exec`, `docker:cleanup:preview`,
`term:*`, `logs:merged:*`, `hosts:*`, `palette:*`.

### Confirmed process identities (P0-2)
`procs:stopAll` takes `{ targets: ProcessIdentity[] }` as well. All stop inputs reject extra fields,
null, missing identities, empty identities, duplicates, and more than 500 targets. Main recomputes
allowlisted membership, intersects with the confirmed identities, and never adds newly discovered
processes. PID, start time, and command must all match before **each** signal; mismatches return
`refusalReasons[pid] = 'identity-changed'`. Commands are compared in memory and never logged.

### Shared validation (P0-8 hardening)
All handlers use the same pre-dispatch wrapper: the sender must be an application BrowserWindow,
its main frame, and the exact loaded DevDeck page (including the development origin when running
from source). Prefix lookalikes, other file URLs and subframes are rejected. No-input channels
reject payloads; every object channel rejects unknown keys, wrong types and oversized values.
Unknown settings keys and invalid settings edits return `INVALID_INPUT`; corrupt on-disk settings
still recover to defaults. Unexpected handler failures use a fixed error message without OS output.

## P1-1 port lookup
`ports:lookup` takes `{ port: integer 1..65535 }`, returns `Result<PortOwner[]>`.
Each owner has `pid`, executable `name`, `port`, `address`, and `process: Proc | null`.
A null process is read-only (not allowlisted, protected, or owned by another user); it has no Stop
button. Managed owners use the exact same captured-identity stop/confirmation path as process rows.
`window.api.lookupPort(port)` is the only preload entry. Port input accepts a number, `:number`,
or `localhost:number`; command lines and arbitrary hosts are not accepted as input.

## P1-3 local URLs
`url:open` takes `{ url: string }`, returns `Result<null>`. Only explicit HTTP localhost or
127.0.0.1 URLs with a valid port and no credentials, query, path or fragment are accepted.
`window.api.openLocalUrl(url)` calls main, which validates again before `shell.openExternal`.

## P1-4 project applications
`project:apps` has no input and returns `Result<InstalledApplication[]>` (`id`, `name`, `path`,
`kind: editor|terminal`, `cli?`). `project:openEditor`, `project:openFinder`, `project:openTerminal`
take `{ path: absolute string }` and return `Result<null>`. Main recomputes active roots, resolves
real paths, and requires a project marker before opening. Apps come only from fixed detection
candidates; fixed argv arrays never interpolate a shell command. Settings add optional
`preferredEditor`/`preferredTerminal` IDs, default `auto`; unknown IDs are rejected.

## P1-5 port explanations
`ports:lookup` may also take optional `project: string` (display context only). Owners add
`kind`, `explanation`, `suggestedAction: stop-process|stop-container|none`, and optional
`containerId`. Docker matching uses published host ports only. Suggested actions still use
the existing confirmation handlers; classification never grants signal permission.

## P1-6 shortcut setting
`Settings.hotkey?: string|null` defaults to `Control+Alt+D`; null disables it. `settings:set`
validates modifier/key syntax and attempts native registration before persisting. Conflicts return
`DENIED` with a plain message and restore the old shortcut. All shortcuts are removed on quit.

## P1-7 undo
Stop reports may include `undoItems: {id:string;name:string}[]` for successfully recorded stops.
The 10-second Undo toast invokes only `recent:restart` IDs from that report, preserving the
existing allowlist/path checks. Refused processes never receive an Undo ID. No arguments appear
in the toast. History remains available after the Undo timer expires.

## P1-8 memory threshold
`Settings.memoryThresholdMb?: number` defaults to 4096 and accepts finite integer MB from 64
to 1048576. Resource sorting/filtering and project totals run on the existing process snapshot;
no additional privileged requests are needed.

## P1-9 notifications and focus
Settings add `notifications` with exact boolean fields `serverStopped`, `memory`,
`actionResults`, `networkExposure`; only actionResults defaults on. Notifications are silent.
`app:focus` is a main-to-renderer event with `FocusTarget {pid?, project?, port?}` and a fixed
preload `onFocusTarget` subscription; notification clicks show the window and focus that row.
Unexpected-server and threshold detection runs on existing visible-window scans, with crossing
deduplication and expected-stop suppression. No background process polling is added.

## P1-10 connection hints
Proc adds optional `establishedConnections`, `openFilesCount`, and `idleHint`. Main collects
working directories, listeners and TCP connection counts from one batched lsof invocation.
`Settings.hintsEnabled?: boolean` defaults true. A listener running at least three days with zero
established connections receives a hint only; it is never stopped automatically.

## P1-11 Docker projects and removal
Container adds `hasVolumes`, `service?`, `dependsOn?`. `docker:remove` takes `{id}` and stops
normally before removing without volume deletion or force. `docker:composeAction` takes
`{project, action:start|stop|restart, ids:string[]}` (1..500 unique confirmed IDs), recomputes
membership and returns `Result<ContainerActionReport[]>` with id/name/ok/message per member.
Only captured IDs are affected. Dependency order is start-first, reverse for stops; project restart
stops in reverse order and starts in dependency order. Cycles fail safely before any mutation.

## P1-12 Docker recovery
`docker:apps` returns detected desktop providers (`id: desktop|orbstack`, `name`, `path`) with no
input. `docker:launch` takes `{app:desktop|orbstack}` and opens only the matching detected local
app path. Invalid socket overrides are `INVALID_INPUT`; unreadable sockets are `DENIED`; missing
providers or stopped daemons are `DOCKER_UNAVAILABLE`, always with fixed, actionable text.
Docker polling has an in-flight guard and pauses while hidden.

## P1-13 first run
`Settings.onboardingComplete?: boolean` defaults false. Completing the three-step guide saves
true through validated settings IPC. Replay is renderer-only state and does not reset saved
preferences. Empty states distinguish an empty process list, no containers and search misses.

## P2-1 process tree
`proc:tree` has no input and returns `Result<ProcessTreeNode[]>` containing allowlisted processes
and recursive children. `proc:treeStop` takes `{root:ProcessIdentity,targets:ProcessIdentity[]}`;
the root must be in targets. Main verifies the root identity before any signal, recomputes managed
descendants, intersects captured identities, and signals children before parents. New descendants
are excluded. The existing KillReport and Undo recording are preserved.

## P2-2 bind visibility
ListeningSocket includes `protocol:TCP|UDP`, `family:IPv4|IPv6`, and `state:LISTEN|ESTABLISHED`.
Non-loopback listening binds receive a network-visibility badge and in-app guide. Optional
networkExposure notifications are deduplicated by process identity, port and address. A wildcard
is exposed; 127/8, ::1 and IPv4-mapped loopback are local. No network probe or automatic action runs.

## P2-3 UDP and connection states
Proc.sockets includes listening TCP, UDP bound sockets and established TCP sockets; `ports`
contains listening/bound ports only. Protocol and state filters use the existing snapshot. UDP
ports are labeled UDP and do not receive HTTP browser actions. Established counts remain separate.
