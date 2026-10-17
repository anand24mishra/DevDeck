# Changelog
Format: Keep a Changelog. Versions follow semver. Update on every release (docs-writer role).

## [Unreleased]
- P0-6: A Playwright Electron smoke test verifies launch, project discovery, port search, tray confirmation, window Cancel, and confirmed stop against a disposable real server.
- P0-5: The macOS CI job now runs npm run lint before tests and build.
- P0-4: The window and packaged app use DevDeck identity and repository metadata. Unused camera, microphone, Documents, and Downloads permission descriptions are removed.
- P0-3: DevDeck excludes its own process, parent, children, and grandchildren from both scans and direct stop requests, rebuilding the protected set for every scan and signal check.
- P0-2: Every window and tray stop checks the captured PID, start time, and command before each signal. Project and stop-all requests cannot add processes that started after confirmation.
- P0-1: Tray Stop All now names the process count and projects, defaults to Cancel, records successful stops, and shows a structured result summary.
- Menu bar tray with template icon, running process count, window focus on click, and quick stop-all action.
- Settings modal with single-page layout for poll intervals, theme switching, launch at login, process ignore list, custom allowlist, and Docker socket override.
- Single-instance lock and window position/size persistence across restarts.
- Docker container list, Compose grouping, start/stop/restart actions, and demuxed live log streaming with auto-scroll and filtering.
- Safe process termination with grace period (SIGTERM -> SIGKILL) and accessible confirmation dialogs for single processes, project stacks, and all running dev processes.
- Process list grouped by project, listening ports, CPU %, memory usage, uptime, and real-time search filtering.
- Project scaffolded from the DevDeck agent pack.
