# Changelog
Format: Keep a Changelog. Versions follow semver. Update on every release (docs-writer role).

## [Unreleased]
- Menu bar tray with template icon, running process count, window focus on click, and quick stop-all action.
- Settings modal with single-page layout for poll intervals, theme switching, launch at login, process ignore list, custom allowlist, and Docker socket override.
- Single-instance lock and window position/size persistence across restarts.
- Docker container list, Compose grouping, start/stop/restart actions, and demuxed live log streaming with auto-scroll and filtering.
- Safe process termination with grace period (SIGTERM -> SIGKILL) and accessible confirmation dialogs for single processes, project stacks, and all running dev processes.
- Process list grouped by project, listening ports, CPU %, memory usage, uptime, and real-time search filtering.
- Project scaffolded from the DevDeck agent pack.
