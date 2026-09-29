# 02 — Architecture

## Stack
Electron + electron-vite, React + TypeScript (renderer), Node (main), dockerode, electron-builder,
electron-updater. v2 adds node-pty + xterm.js.

## Processes
```
Renderer (React, sandboxed, no Node)
   │  window.api.*  (contextBridge, fixed list of functions)
Preload (tiny; only forwards validated calls)
   │  ipcRenderer.invoke / on
Main (Node; all privileged work)
   ├─ providers/  ProcessProvider (darwin now; win32/linux later, same interface)
   ├─ services/   killService, projectService, dockerService, settingsStore, notifier
   └─ system/     tray, window, updater, logger
```

## Folder layout
```
src/main/
  index.ts            app lifecycle, single-instance lock, window, tray
  ipc.ts              registers every handler through one validated wrapper
  providers/process.darwin.ts
  services/kill.ts  project.ts  docker.ts  settings.ts
  security/allowlist.ts  validate.ts
src/preload/index.ts  exposes the typed `api`
src/shared/types.ts   types shared by main and renderer (the IPC contract)
src/renderer/src/     components/  screens/  hooks/  styles/tokens.css  motion/
```

## Rules of the road
- Interface first: `ProcessProvider` is defined on day one so Windows/Linux (v2) is an addition, not a rewrite.
- Polling lives in main with an in-flight guard; the renderer subscribes and never polls the OS.
- Polling pauses when the window is hidden (tray keeps a slow heartbeat only if alerts are enabled).
- All errors cross IPC as `{ ok: false, error: { code, message } }`, never as thrown stack traces.
- Settings persisted with a tiny JSON store in `app.getPath('userData')`; validated on load.

## Data flow example: "Stop project"
UI click → confirm dialog → `api.stopProject(root)` → main re-lists processes → filters by allowlist and
project → `kill.terminate(pids)` (SIGTERM, wait, SIGKILL if alive) → returns result → UI shows toast +
refreshes list.
