# ROADMAP

## v1.0 — "See it, stop it" (ship first)
Specs: `features/v1.0-*.md`
- Process list grouped by project, with ports, CPU, memory, uptime
- Safe kill: one process, one project, all dev processes
- Docker: containers, start/stop/restart, live logs with filter
- Menu bar icon, single instance, launch at login, settings (ignore list, refresh rate)
- Signed, notarized, auto-updating release
Exit: Definition of Done met for every v1.0 spec; clean-Mac install test passes; no P0/P1 bugs.

## v1.1 — "Never lose a stack"
Specs: `features/v1.1-*.md`
- Recently stopped + restart
- Profiles: start/stop a whole project stack
- Port-conflict fixer
- Zombie detection and resource alerts
- Docker extras: exec, Compose actions, cleanup with size preview
Exit: profiles survive app restart; alerts never spam; cleanup always previews before deleting.

## v2 — "The GUI for your terminal"
Specs: `features/v2-*.md`
- Embedded terminal
- Unified log viewer (containers + local processes)
- Command palette + global hotkey
- Integrations: Homebrew services, Kubernetes port-forward, tunnels
- Remote hosts over SSH
- Windows and Linux
Exit: terminal is stable under heavy output; remote actions require explicit confirmation.

## Not planned
Mac App Store (sandbox blocks the core feature), Android, telemetry, root/sudo actions.
