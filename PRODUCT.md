# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who run local servers, databases and Docker containers, and lose time asking "what is using port 3000?" or "did I leave something running?". Some are beginners: the UI must be understandable without knowing terms like PID or SIGTERM.

## Product Purpose
Give a calm, single view of everything running for your projects, and make stopping or restarting it safe and one click. Nothing leaves the machine.

## Positioning
Project-first, not process-first ("Stop everything for api-server" beats a flat list of PIDs). A calm instrument panel and safe-by-default kill allowlist without cloud dependencies, accounts, or telemetry.

## Operating Context
macOS desktop application (Apple Silicon and Intel) packaged with Electron. Lives in the macOS menu bar and windowed interface. Integrates locally with the system process table, local listening ports (`lsof`), and Docker daemon socket.

## Capabilities and Constraints
- 3 primary areas: Processes, Docker, Settings (Terminal in v2).
- Safe kill: never kill outside the explicit dev allowlist (node, python, go, rust, docker, postgres, redis, etc.).
- Sandboxed renderer with `contextIsolation`; no direct Node or shell execution in renderer. All privileged work is in the main process behind validated IPC.
- Plain language in UI ("Stop", "Restart", "In use by"); technical values (PID, signal names) behind a "Details" disclosure in monospace.
- Local-only: no telemetry, no cloud sync, no accounts.
- Fast and light: lives in the menu bar; zero resource hogging.

## Brand Commitments
- Name: DevDeck.
- Direction: "Quiet instrument panel" — dense rows, hairlines, monospace machine values, single accent color, no decorative gradients, purple glow, or AI slop.
- Typography: System UI font stack (`-apple-system, system-ui`), zero font downloads. Monospace for machine values (`ui-monospace, "SF Mono", Menlo, monospace`).

## Evidence on Hand
- Product vision and architecture: `docs/01-vision.md`, `docs/02-architecture.md`, `docs/03-ipc-contract.md`, `docs/04-safety-model.md`.
- Visual tokens and principles: `DESIGN.md`, `docs/05-design-principles.md`, `docs/06-design-references.md`.
- Feature specifications: `features/v1.0-process-list.md`, `features/v1.0-safe-kill.md`, `features/v1.0-docker.md`, `features/v1.0-tray-and-settings.md`.

## Product Principles
- Calm by default: few screens, one obvious action each.
- Say what will happen before it happens ("Stop 4 processes in api-server").
- Plain words first, technical detail on demand.
- Safe by default: never a surprise kill; require confirmation for bulk actions.
- Fast and light: it lives in the menu bar; it must not be a resource hog.

## Accessibility & Inclusion
Keyboard reachable everywhere, visible focus states, contrast >= 4.5:1 for text, respects reduced motion (`prefers-reduced-motion`), never relies on color alone (state has text dot + label), works at 200% text size.
