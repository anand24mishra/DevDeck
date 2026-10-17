# Changelog
Format: Keep a Changelog. Versions follow semver. Update on every release (docs-writer role).

## [Unreleased]
- P1-8: Added stable name, CPU, memory, uptime and port sorts, Heavy-only filter, per-project totals, and a configurable total-memory warning with Review action.
- P1-7: Successful stops return opaque restart records and a keyboard-accessible 10-second Undo action that reuses the checked restart path and reports partial restart results.
- P1-6: Registered Control+Alt+D by default, added shortcut capture and disabling in Settings, conflict rollback, and quit cleanup.
- P1-5: Classified project owners, other projects, Docker published ports, SSH and Kubernetes forwards, tunnels, and protected read-only owners with plain explanations and confirmed suggested actions.
- P1-4: Added editor, Finder and terminal actions with fixed argv, application detection and preferences, verified active project roots, and disabled unavailable actions.
- P1-3: Added browser and copy actions for listening ports with strict main-process validation of local HTTP URLs.
- P1-2: Added extensible labels for 39 common tools and cached project npm scripts, with executable-name fallback and masked raw-command details preserved.
- P1-1: Added validated port lookup, IPv4 and IPv6 bind addresses, read-only owners, keyboard focus shortcut, automatic refresh, and the existing identity-confirmed Stop flow.
- P0-9: Documented renderer-scheduled IPC polling, recently stopped behavior, actual safety boundaries, feature status, and deferred signed-release verification.
- P0-8: Prepared a draft-only universal signing/notarization workflow, hardened packaging and Electron fuses, a consent-based updater, Homebrew cask template, and strict IPC validation with redacted errors.
- P0-7: An opt-in integration test creates one isolated container, lists it through DevDeck, stops and restarts it, reads batched logs, then removes only that fixture.
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
