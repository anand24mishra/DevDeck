# 04 — Safety model (non-negotiable)

DevDeck can stop processes. These rules protect the user's machine and data.

## Scope
1. Only processes owned by the current user. Never root, never system processes, never sudo.
2. Allowlist by executable name (node, npm, npx, yarn, pnpm, bun, deno, python*, ruby, go, java, php,
   uvicorn, gunicorn, puma, cargo, vite, next, webpack, esbuild; user can add more in settings).
3. Skip anything whose executable path contains `.app/Contents/` (editors, Electron apps, Xcode tools,
   language servers) unless the user explicitly adds it.
4. Never touch DevDeck itself or its parent/children.
5. User ignore list always wins.

## Stopping
1. Confirmation dialog states the count and project name; "Stop all" lists the projects.
2. Send SIGTERM. Wait 3 s. Re-check. Only then SIGKILL survivors ("Force stop" in UI language).
3. Before each signal, re-read the process: same pid **and** same start time/command as when listed
   (PIDs get reused). If it changed, skip and report as `refused`.
4. Main process recomputes targets. The renderer only names *what* (a project or pids), and main
   filters them through the allowlist again.
5. Return a `KillReport`; the UI shows what stopped, what needed force, and what refused.

## Docker
Stop/restart only via Docker's API on the local socket. "Stop all containers" needs confirmation.
Cleanup (v1.1) always previews sizes and requires an explicit second confirmation.

## Data handling
Command lines can contain tokens. Never log them, never send them anywhere, never put them in crash text.
Logs record events (`stopped pid 123 name node`) not arguments.

## Electron hardening
sandbox on, contextIsolation on, nodeIntegration off, CSP with no unsafe-eval, navigation and window.open
blocked, IPC sender + input validation, Electron fuses set (see `docs/10-release-and-signing.md`).

## Testing this model
Unit tests for allowlist, `.app` filter, PID-reuse guard, and validators are mandatory (`docs/09`).
