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
