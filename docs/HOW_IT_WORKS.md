# How DevDeck works

A plain-English guide to Electron and to this project. Read it top to bottom once and you will know
what the app does, how it is built, and why each choice was made.

## 1. The problem DevDeck solves

When you build software you end up with many things running at once: a web server on port 3000, a
database, a Docker container, a file watcher. Finding them means running `ps`, `lsof` and `docker ps`,
then killing the right ones by hand. Kill the wrong one and you lose work.

DevDeck shows all of them in one window, **grouped by project**, and lets you stop a whole project
in one click. It is built to be **safe by default**: it only stops things it is sure are yours.

## 2. What is Electron?

Electron lets you build a desktop app with web technology (HTML, CSS, JavaScript). It bundles two
things into one app:

- **Chromium**, the browser engine, which draws the window.
- **Node.js**, which can talk to the operating system (files, processes, network).

A normal website cannot list your processes. An Electron app can, because it also has Node.js.
VS Code, Slack and Discord are Electron apps.

### The two-process rule (the most important idea)

An Electron app is really **two kinds of process**:

| Part | What it is | Can it touch your computer? |
|---|---|---|
| **Main process** | One Node.js process. Starts the app, makes windows, runs commands. | Yes, fully |
| **Renderer process** | One per window. Runs the web page (our React UI). | No, by design |

A third small piece, the **preload script**, sits between them. It is the only door the page can use.

**Why split them?** The renderer shows web content and runs a lot of JavaScript. If a bug or a
malicious script got into it and it could run commands, it could damage your computer. So the
renderer is locked in a box and must *ask* the main process to do anything risky.

### How they talk: IPC

IPC means inter-process communication. It works like a waiter in a restaurant:

```
Renderer (React UI)          Preload (the only door)          Main (the kitchen)
 "stop project foo"  ──►  window.api.stopProject(...)  ──►  checks it, then does it
                     ◄──  result {ok:true, ...}        ◄──  
```

1. The UI calls `window.api.something()`.
2. The preload forwards that to the main process with `ipcRenderer.invoke('channel', data)`.
3. The main process handles it with `ipcMain.handle('channel', ...)`, then sends a result back.

DevDeck's rule: **the renderer never runs commands.** Every privileged action lives in the main
process behind a validated IPC channel.

## 3. How DevDeck is wired

```
src/
  main/       Node.js side: all privileged work
    index.ts        app start, window, tray, single-instance lock, 30 s heartbeat
    ipc.ts          registers every IPC channel through one safe wrapper
    providers/      reads the system's processes (ps + lsof)
    security/       the allowlist and the input validators
    services/       kill, docker, settings, profiles, launcher, notifications, tray...
  preload/    the bridge: exposes a fixed list of functions as window.api
  renderer/   React user interface (components, hooks, styles)
  shared/     TypeScript types used by both sides (the IPC "contract")
```

### Building and running
`electron-vite` bundles the three parts (main, preload, renderer) with Vite. `npm run dev` starts
the app with hot reload. `electron-builder` packages it into a macOS app (DMG/ZIP).

## 4. What happens when you open the app

1. `main/index.ts` asks for a **single-instance lock** so only one DevDeck runs.
2. It creates the window with strict settings (section 6) and a **menu-bar tray icon**.
3. It registers the IPC handlers.
4. The React UI loads and calls `window.api.listProcesses()` on a timer.
5. The main process scans the machine and sends back a list. The UI groups it by project.

### How the process list is built
- `ps` lists every process with its PID, parent, user, CPU, memory, start time and command.
- `lsof` finds which process is listening on which **port**.
- Both are run with `execFile` (no shell), so nothing can be injected through a command string.
- The result is **filtered** to developer tools (node, python, docker...) owned by you.
- Processes are **grouped into projects** by the folder they run in.
- A short **scan cache** (about 1 second) means several requests share one `ps`+`lsof` run, which
  keeps the app light. Anything that kills or changes something always does a fresh scan.
- A **30-second heartbeat** keeps notifications ("server stopped") and the menu-bar count working
  even when the window is hidden.

## 5. How a safe stop works

This is the heart of the app. When you click **Stop project**:

1. The UI shows a **confirmation** saying what will stop.
2. The renderer sends only *what* to stop. The main process **recomputes the real targets itself**
   and runs them through the allowlist again. The UI is never trusted.
3. For every target it re-reads the process and checks the **PID, start time and command still match**
   what you confirmed. (Operating systems reuse PIDs. Without this check you could kill an
   unrelated program that took over the number.)
4. It sends **SIGTERM**, a polite "please quit".
5. It waits **3 seconds**, checks again, and only then sends **SIGKILL** to survivors. The UI calls
   this "Force stop".
6. It returns a report: stopped, needed force, or refused. You get a toast with **Undo** available
   from "Recently stopped".

### The safety rules (never broken)
- Only your own processes. Never root, never `sudo`.
- Only an **allowlist** of developer tools (you can add more in Settings).
- Anything inside a `.app/Contents/` bundle (editors, browsers, Xcode) is skipped.
- DevDeck never stops itself or its own child processes.
- Your **ignore list** always wins.
- Command arguments are **masked** in the UI, since they can contain secrets.

## 6. How the window is locked down

| Setting | Meaning |
|---|---|
| `sandbox: true` | The renderer runs in the operating system's sandbox |
| `contextIsolation: true` | The page's JavaScript cannot reach the preload's internals |
| `nodeIntegration: false` | The page has no `require` or Node.js |
| Content Security Policy | Blocks inline scripts, `eval`, plugins, and outside content |
| Navigation and `window.open` blocked | The window cannot be sent to another site |
| IPC wrapper | Every channel checks **who is calling** and **validates the input** |
| Electron fuses | Build-time switches that disable risky Electron features |

## 7. The main features

- **Processes tab**: project groups, search, sort, ports, CPU and memory, a process tree, port
  lookup, "who is using port 3000?", reserved ports, and details with environment view.
- **Docker tab**: containers grouped by Compose project, start, stop, restart, live logs, stats.
  It talks to Docker through its API socket using `dockerode`, never by typing shell commands.
- **Profiles tab**: save a stack (commands plus containers) and start it again in one click, after
  you review the exact commands.
- **Menu-bar tray**: quick count and actions without opening the window.
- **Notifications**: tells you when a watched server stops.
- **Recently stopped**: restart something you just stopped, after a native confirmation.
- **CLI** (`cli/devdeck.cjs`): talks to the running app over a local authenticated socket (not a
  network port). Raycast and Alfred extensions use it.
- **Settings**: theme (System, Light, Dark), refresh interval, allowlist, ignore list.

## 8. The user interface

- **React 19 + TypeScript**. State lives in hooks such as `useProcesses` and `useDocker`, which poll
  through IPC with guards so two requests never overlap. Polling pauses when the window is hidden.
- **Design**: a "quiet instrument panel", with design tokens (colors, type scale, spacing) in
  `styles/tokens.css`, light and dark themes, no shadows or glow.
- **Plain language**: technical terms such as PID live behind a "Details" section.
- **Accessibility**: real tabs with arrow-key navigation, dialog roles, keyboard focus, reduced
  motion, works at 200% zoom.
- Long lists are **virtualized**, so only visible rows are drawn.

## 9. How it is tested

| Check | Command | What it proves |
|---|---|---|
| Typecheck | `npm run typecheck` | Types are consistent across main, renderer and tests |
| Lint | `npm run lint` | Code style and common mistakes |
| Format | `npm run format:check` | Consistent formatting |
| Unit and integration | `npm test` | Logic works, including killing real child processes |
| Coverage | `npm run test:coverage` | Tests cover a minimum share of the code |
| End to end | `npm run test:e2e` | Playwright drives the real Electron window |

GitHub Actions runs these on every push and pull request.

## 10. Honest limits

- macOS only for now (the process reader is written for macOS behind an interface, so Windows and
  Linux can be added later).
- No signed and notarized release has been published yet. That needs Apple developer credentials.
- Real Docker behavior was not verified on every setup.

## 11. Quick answers to "why did you...?"

- **Why Electron?** One TypeScript codebase, easy access to the system, fast to build a good UI.
- **Why a main/renderer split?** Security. The part that shows content cannot run commands.
- **Why re-check the PID and start time?** PIDs get reused, so a stale number could hit the wrong program.
- **Why SIGTERM before SIGKILL?** It lets programs save and clean up first. Force is the last resort.
- **Why an allowlist and not a blocklist?** A blocklist misses things. An allowlist can only ever
  touch what we named on purpose.
- **Why `execFile` and not `exec`?** No shell means no command injection.
- **Why a cache?** Scanning the whole machine is costly, so close requests share one scan.
