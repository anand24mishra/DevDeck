# DevDeck: Missing Features Implementation Spec

> **Audience:** Claude Code (or any coding agent) working inside the DevDeck repository.
> **Goal:** Implement every feature below, in the order given, without breaking the safety model.
> **Baseline:** Branch `fix/review-gate-hardening` @ `5e40723`. Electron 39, React 19, TypeScript 5.9, electron-vite, electron-builder, `dockerode`, Vitest.

---

## Tasks

Implement P0-1 through P3-9 in the specified order, with a separate branch and commit for each ID.
For each ID: update the contract first when needed, implement main/preload then UI, exercise safety
and error paths, run typecheck/lint/tests/build, and record evidence in PROJECT.md. P4 is design only.
Checkboxes below represent **merged** work and remain unchecked until the maintainer merges.
Signed release, clean-Mac installation, hardware/provider QA and update verification require external
credentials or systems; record those as pending rather than claiming verification.

## Local implementation status — 2026-10-19

P0-1 through P3-9 are implemented locally in separate feature commits, followed by integration,
safety and UX fixes. P4 has the requested design notes in `docs/future/`; no P4 runtime code was added.
The UX pass covers navigation, structured profile forms, filtered empty states, settings, process
and Docker details, logs, keyboard focus, themes, large lists and accessible zoom.

Signing, notarization, clean-Mac installation, signed updates, Intel hardware and real Docker
provider checks remain external acceptance work. The maintainer requested continuing features
with signed-release verification deferred. See `docs/testing/release-matrix.md` for local evidence
and pending checks. Checkboxes remain unchecked because local changes have not been merged.

## 0. How to work on this file

1. Work **one feature ID at a time** (for example `P0-1`). Finish, test, and commit before starting the next.
2. For each feature: read the listed existing files first, then implement, then add tests, then run:
   ```
   npm run typecheck && npm run lint && npm test && npm run build
   ```
3. All four must pass before moving on. Never leave the branch red.
4. Update `PROJECT.md` (implementation log) and tick the feature's checkbox in this file when it is merged.
5. If a requirement here conflicts with `docs/04-safety-model.md`, **the safety model wins**. Raise the conflict in `PROJECT.md` and pick the safer option.
6. Do not add telemetry, accounts, cloud sync, or any outbound network call (except the signed updater feed in P0-8).
7. Keep the renderer sandboxed. All privileged work stays in the main process. Every new IPC channel must:
   - be declared in `src/shared/types.ts` and documented in `docs/03-ipc-contract.md`,
   - validate the sender and every input in `src/main/ipc.ts`,
   - be exposed through the small typed `window.api` surface in `src/preload/index.ts`.
8. UI copy uses plain labels ("Stop", "Restart", "Show logs"). Technical terms (PID, SIGTERM) stay behind disclosures. Follow `docs/08-copywriting-guide.md` and `DESIGN.md`.
9. Add keyboard access, visible focus, reduced-motion support, and status text (never color alone) to every new UI element.

### Definition of done (applies to every feature)

- [ ] Behavior matches the acceptance criteria.
- [ ] Unit tests added; integration test added where real processes or Docker are involved.
- [ ] Safety rules respected (see section 1).
- [ ] IPC contract and docs updated.
- [ ] No new lint, type, or build warnings.
- [ ] Light and dark theme checked.
- [ ] `PROJECT.md` updated.

---

## 1. Non-negotiable safety rules

These apply to **all** features, especially anything that stops, signals, or removes something.

1. Operate only on the **current user's** processes that pass the allowlist. Never use `sudo`. Never target system processes.
2. The ignore list overrides every allowlist entry.
3. Recheck identity (**PID + start time + command**) before every signal. PIDs get reused.
4. Always try a normal stop first, wait 3 seconds, re-verify identity, then force-stop only verified survivors.
5. Every destructive action needs a confirmation that names exactly what will be affected. This includes tray actions and any new bulk action.
6. Never signal DevDeck itself, its parent, or any of its children.
7. Command arguments, environment variables, and logs can contain secrets: mask by default, never log them, never send them anywhere.
8. Return structured reports: `stopped`, `forced`, `refused` (with reason), `still-running`.
9. Root-owned or other-user processes may be **displayed read-only** (new feature P2-12) but never signaled.

---

## 2. Phase overview

| Phase | Theme | Features |
|---|---|---|
| **P0** | Release gate: safety and shipping | P0-1 to P0-9 |
| **P1** | Everyday developer loop (v1.0 polish) | P1-1 to P1-14 |
| **P2** | Power features (v1.1) | P2-1 to P2-14 |
| **P3** | Automation and ecosystem (v1.2) | P3-1 to P3-9 |
| **P4** | Later (v2, design only) | P4-1 to P4-5 |

---

# PHASE P0: Release gate

## P0-1 Tray "Stop All" confirmation
- [ ] **Problem:** The menu bar "Stop All Dev Processes" calls the stop flow with no confirmation.
- **Do:** Route the tray action through the same confirmation used by the window. Show a native dialog listing the count and the project names. Default button is **Cancel**.
- **Files:** `src/main/` tray module, `src/main/ipc.ts`, `src/main/services/kill.ts`.
- **Accept:** Cancel does nothing; Confirm runs the stop flow and shows the report (notification or window).
- **Tests:** Unit test that the stop flow is not invoked without confirmation.

## P0-2 Bind stop to the identity the user confirmed
- [ ] **Problem:** Identity is recorded just before the first signal, not when the user saw the row.
- **Do:** The renderer sends `{pid, startTime, command}` taken from the row. Main process re-reads the process and **refuses** if any field differs. Keep the second check before force-stop.
- **Files:** `src/shared/types.ts`, `src/main/services/kill.ts`, `src/main/ipc.ts`, renderer stop call sites.
- **Accept:** If the PID was reused between display and click, the result is `refused: identity-changed` and nothing is signaled.
- **Tests:** Unit test with a fake process table where the PID changes; integration test with a real child process that exits and is replaced.

## P0-3 Full self-tree protection
- [ ] **Do:** Compute DevDeck's own tree (current PID, parent PID, all descendants) and block it in the allowlist layer. Refresh the set on each scan.
- **Files:** allowlist code under `src/main/`, `src/main/providers/process.darwin.ts`.
- **Accept:** DevDeck's parent terminal or shell and child helpers never appear as stoppable and are refused if sent directly.
- **Tests:** Unit tests for parent, child, and grandchild.

## P0-4 Remove starter metadata and unused permissions
- [ ] **Do:** Set the window title to "DevDeck" in `src/renderer/index.html`. Replace example values in `package.json` and electron-builder config. Remove camera and microphone usage descriptions.
- **Accept:** No "Electron" title, no example strings, no unused permission keys.

## P0-5 CI runs lint
- [ ] **Do:** Add `npm run lint` to `.github/workflows/ci.yml` before tests.

## P0-6 Playwright Electron end-to-end smoke test
- [ ] **Do:** Add Playwright with the Electron launcher. Cover: app launches, a spawned test server appears under its project, search finds it, Stop shows confirmation, Cancel leaves it running, Confirm stops it, tray Stop All asks for confirmation.
- **Files:** new `e2e/` folder, `package.json` script `test:e2e`, CI job.
- **Accept:** Runs on macOS CI and locally.

## P0-7 Docker real-daemon integration test
- [ ] **Do:** Add an opt-in test (skipped when no daemon) that starts a tiny container, lists it, stops, restarts, reads logs, and removes it.

## P0-8 Signed, notarized release pipeline
- [ ] **Do (follow `docs/10-release-and-signing.md`):**
  - correct app ID and name, hardened runtime, entitlements file,
  - Electron fuses configured (disable `RunAsNode`, `NODE_OPTIONS`, and inspect arguments; enable cookie encryption and ASAR integrity where supported),
  - code signing and notarization in a GitHub Actions release workflow using repository secrets,
  - electron-updater with verified updates and a real publish target,
  - universal (Apple Silicon and Intel) build,
  - Homebrew cask template.
- **Accept:** A tagged build produces a notarized, stapled DMG and ZIP; the app opens on a clean Mac with no Gatekeeper warning.
- **Note:** Do not invent secrets. Document the required secret names in the README for the maintainer.

## P0-9 Documentation reconciliation
- [ ] **Do:** Update `docs/02-architecture.md` (polling lives in renderer hooks, or move it to main), `docs/03-ipc-contract.md` (`recent:*` implemented), `SECURITY.md` (state what is actually shipped), feature checklists, and `README` (install, screenshots, security boundaries, feature status).

---

# PHASE P1: Everyday developer loop

## P1-1 Free-port quick action
- [ ] **What:** A box (also reachable by hotkey) where the user types a port number, sees the owner, and can stop it.
- **IPC:** `ports:lookup(port: number) -> PortOwner[]`.
- **UI:** Input at the top of the window, accepts `3000`, `:3000`, or `localhost:3000`. Shows process, project, bind address, and a Stop button that uses the normal confirmation and identity flow.
- **Accept:** Typing `3000` while a server runs on it shows it in under one refresh interval; if nothing listens, shows "Nothing is using port 3000."
- **Tests:** Parsing of input forms, lookup of a real listening socket, not-found state.

## P1-2 Plain-English process labels
- [ ] **What:** Replace `node`, `python3.12`, `java` with labels such as "Vite dev server", "Next.js", "Django", "Postgres".
- **Do:** Add `src/main/services/labeler.ts`. Rules combine executable name, command-line tokens (for example `vite`, `next dev`, `manage.py runserver`, `uvicorn`, `rails s`), and `package.json` scripts or dependencies at the project root. Ship a data table (`labels.json`) so entries are easy to extend. Always keep the raw command available behind a disclosure.
- **Accept:** At least 30 common tools labeled (Vite, Next, Nuxt, Remix, Astro, Webpack, Metro, Storybook, Jest, Vitest, Django, Flask, FastAPI/Uvicorn, Rails, Spring Boot, Gradle daemon, Postgres, MySQL, Redis, MongoDB, Kafka, Elasticsearch, ngrok, cloudflared, and similar). Unknown processes fall back to the executable name.
- **Tests:** Table-driven tests for each rule.

## P1-3 Clickable URLs
- [ ] **What:** For each listening port, show `localhost:PORT` as a link: open in default browser, copy URL.
- **Do:** Open only `http://localhost:PORT` or `http://127.0.0.1:PORT` through Electron `shell.openExternal` after the main process validates scheme and host. Never open arbitrary strings from the renderer.
- **Accept:** One click opens the browser; right-click or button copies.
- **Tests:** URL validation rejects non-local hosts and non-http schemes.

## P1-4 Open project in editor, Finder, or Terminal
- [ ] **What:** Row actions: "Open in editor", "Show in Finder", "Open Terminal here".
- **Do:** Settings gets a preferred editor (auto-detect VS Code, Cursor, Zed, Sublime, JetBrains via `/Applications` and CLI shims) and preferred terminal (Terminal, iTerm2, Warp, Ghostty). Use `execFile` with fixed arguments (never a shell string). The path must be a verified project root.
- **Accept:** Works for each detected app; disabled with a tooltip if none is found.
- **Tests:** Path validation, argument construction (no shell injection with spaces or quotes).

## P1-5 Port conflict explanation
- [ ] **What:** When a port is held by something unexpected, say who and why.
- **Do:** Classify owners: your project's dev server, another project, Docker container (name and image), SSH tunnel, `kubectl port-forward`, system or non-user process (read-only). Show a one-line sentence: "Port 5432 is used by Docker container `db`, not your app."
- **Accept:** Each class produces a distinct message and suggested action (Stop container, Stop process, or None).
- **Tests:** Classifier unit tests.

## P1-6 Global hotkey
- [ ] **What:** A configurable shortcut (default `Control+Option+D`) toggles the window.
- **Do:** Use Electron `globalShortcut`. Settings page captures a new shortcut, detects conflicts, and can disable it.
- **Accept:** Works when the app is hidden; unregistered on quit.

## P1-7 Undo stop
- [ ] **What:** After a stop, show a toast "Stopped `vite`. Undo" for 10 seconds.
- **Do:** Reuse the Recently Stopped store and restart path. Undo restarts with the original command and working directory.
- **Accept:** Undo restores the process; toast disappears after the timeout or on dismiss; keyboard reachable.
- **Tests:** Restart with real child process.

## P1-8 "Heavy processes" view
- [ ] **What:** A sort and filter that answers "why is my Mac slow?": top CPU and memory processes among DevDeck-visible items, with totals per project.
- **UI:** Sort menu (Name, Memory, CPU, Uptime, Port). A banner when total dev memory exceeds a configurable threshold with a "Review" button.
- **Accept:** Sorting is stable; totals match the sum of rows.

## P1-9 Notifications
- [ ] **What:** Optional native notifications: a watched server stopped unexpectedly, a process crossed a memory threshold, a stop-all finished.
- **Do:** Per-type toggles in settings, off by default except action results. No sound by default. Respect system Do Not Disturb.
- **Accept:** Notification click focuses the relevant row.

## P1-10 Idle and forgotten process hints
- [ ] **What:** Mark rows "Running 3 days, no connections" when a listening process has no established connections and long uptime.
- **Do:** Use `lsof` established-connection counts. This is a hint only, never auto-stop.
- **Accept:** Hint appears with an info disclosure explaining the rule; can be disabled in settings.

## P1-11 Docker basics
- [ ] **What:** Remove container (with confirmation), copy container ID, copy published `localhost:PORT` URL and open it in browser, start/stop/restart a **whole Compose project**.
- **Do:** Extend `src/main/services/docker.ts` (use `dockerode`, no shell). Compose actions iterate containers carrying the `com.docker.compose.project` label, ordered by `depends_on` if labels are present, otherwise by name.
- **Accept:** Remove asks for confirmation and warns when volumes are attached; Compose project stop reports per-container results.
- **Tests:** Mocked-dockerode unit tests plus the opt-in daemon test from P0-7.

## P1-12 Docker "not running" and error states
- [ ] **What:** Clear states: Docker not installed, daemon stopped, permission denied on socket, socket override invalid.
- **Do:** Each state has plain text, a one-line fix, and a "Check again" button. Include a "Start Docker Desktop / OrbStack" button when the app is detected (launch via `shell.openPath`).
- **Accept:** No raw error strings shown by default.

## P1-13 First-run onboarding and empty states
- [ ] **What:** A three-step first-run card: what DevDeck shows, what it never touches, how to customize (ignore list, allowlist). Helpful empty states: "No dev processes running", "Nothing matches your search".
- **Accept:** Shown once; replayable from Settings or Help.

## P1-14 Distribution basics
- [ ] **Do:** Verify auto-update flow end to end, add "Check for updates" to the tray, add Homebrew cask instructions to the README.

---

# PHASE P2: Power features

## P2-1 Process tree
- [ ] **What:** Expandable parent and child view (`npm → node → esbuild`), with stop-the-whole-tree.
- **Do:** Build the tree from `ps` PPID data. Tree stop signals children first, then parents, with the same identity checks per process.
- **Accept:** Stopping a parent that has children shows the full list in the confirmation.
- **Tests:** Tree construction, ordering, partial-failure report.

## P2-2 Bind address, IPv6, and LAN exposure warning
- [ ] **What:** Show the bind address (`127.0.0.1`, `::1`, `0.0.0.0`, `*`) per listening socket. Warn when a dev server listens on all interfaces.
- **UI:** A "Visible on your network" badge with a plain explanation and a link to the docs. Optional setting to notify on new exposed ports.
- **Accept:** IPv4 and IPv6 sockets are distinguished; the badge appears only for non-loopback binds.

## P2-3 UDP and connection-state filters
- [ ] **What:** Include UDP listeners; filter by Listening or Established; show connection counts.
- **Do:** Extend the `lsof` parser (`-iUDP`, `-iTCP -sTCP:LISTEN|ESTABLISHED`).

## P2-4 Process details panel
- [ ] **What:** A right-hand or inline panel with: full command (masked arguments by default, reveal button), working directory, start time, user, parent, open files count, listening ports, established connections.
- **Do:** `proc:details(pid, startTime)` verifies identity before returning anything.
- **Accept:** Copy buttons for each field; masked values stay masked when copied unless the user chose reveal.

## P2-5 Environment variables viewer
- [ ] **What:** Read-only view of the process environment with values hidden by default.
- **Do:** Use `ps eww` or `/usr/bin/env`-style reading through `ps -E` where permitted for the user's own processes. Mask values for keys matching `/(KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|AUTH)/i`, and mask **all** values until the user clicks reveal. Never write env data to disk or logs. Auto-hide again when the panel closes.
- **Accept:** No env data persists after the panel closes.
- **Tests:** Masking rules and non-persistence.

## P2-6 Extra signals
- [ ] **What:** Menu items: Pause (`SIGSTOP`), Resume (`SIGCONT`), Reload (`SIGHUP`), Stop process group.
- **Do:** Same identity checks and confirmation for Pause and Stop group. Show a "Paused" status badge. Never auto-force.
- **Tests:** Pause and resume a real child; reload on a child that handles `SIGHUP`.

## P2-7 Orphan and zombie detection
- [ ] **What:** Flag processes whose parent is `launchd` while their project directory is deleted or whose parent terminal closed, and zombie states.
- **UI:** "Possibly leftover" badge with a filter and a "Stop leftovers" bulk action that goes through confirmation.

## P2-8 Git context per project
- [ ] **What:** Show current branch and a dirty indicator on each project row.
- **Do:** Read `.git/HEAD` directly; get dirty status with `git status --porcelain` run via `execFile` with a timeout, cached for 10 seconds. If Git is missing, skip silently.
- **Accept:** Never blocks the UI; failure hides the badge.

## P2-9 Runtime awareness
- [ ] **What:** Show Node version (`.nvmrc`, `.node-version`, `engines`), Python virtualenv, Go, Rust, Java where cheaply detectable.
- **Accept:** Appears in the details panel, not on every row.

## P2-10 Expanded dev-tool coverage
- [ ] **What:** Add default allowlist entries and labels for: Metro, Storybook, Jest and Vitest watchers, `tsserver`, Gradle and Kotlin daemons, Watchman, Android emulator and Xcode simulators (opt-in because they are `.app`-like), Redis, Postgres, MySQL, MongoDB, Kafka, RabbitMQ, Elasticsearch, MinIO, Mailpit/MailHog, `air`, `cargo watch`, `uvicorn`, `gunicorn`, `php artisan serve`.
- **Do:** Keep the `.app/Contents/` exclusion unless the user explicitly allows. Each addition needs a test case.

## P2-11 Tunnel and port-forward detection
- [ ] **What:** Recognize and label SSH tunnels (`ssh -L`), `kubectl port-forward`, ngrok, cloudflared, and Tailscale funnel. Show the remote target if present.
- **Accept:** Tunnels appear in a "Tunnels" section and the conflict explainer (P1-5) uses them.

## P2-12 Read-only visibility of unmanageable processes
- [ ] **What:** Optional toggle "Show processes DevDeck can't stop" that lists ports held by root or other users, clearly marked read-only with a reason.
- **Do:** Display only what `lsof` returns for the user. No privileged escalation. No Stop button.
- **Accept:** Never signaled; the IPC layer rejects them.

## P2-13 Docker stats
- [ ] **What:** Per-container CPU, memory, and network with a small sparkline (last 60 samples).
- **Do:** `dockerode` `container.stats({stream: true})`, one stream per visible container, batched over IPC at 1 Hz, closed when the window is hidden.
- **Accept:** No streams remain after the window is hidden or the container stops.

## P2-14 Docker exec and inspect
- [ ] **What:** "Open shell" launches the user's preferred terminal running `docker exec -it <id> sh` (try `bash` first when present). An Inspect panel shows environment (masked), mounts, networks, health, restart count, exit code, and OOM-killed flag.
- **Do:** Validate container IDs with the existing validator; launch terminals using fixed argument arrays.
- **Accept:** Works with Docker Desktop, OrbStack, and Colima sockets.

---

# PHASE P3: Automation and ecosystem

## P3-1 Stack profiles
- [ ] **What:** Save a named group (for example "storefront": web, API, Postgres container) with start commands, working directories, ports, and Docker services. Start, stop, restart as one unit.
- **Do:** Store in settings (validated schema). Start commands run through a fixed launcher (see P3-4), not a shell string from the renderer. Stop uses the normal safe flow.
- **UI:** "Profiles" tab; "Save as profile" from a project group; status per member.
- **Accept:** Starting a profile reports per-member results; failures don't hide successes.

## P3-2 Per-repo config file
- [ ] **What:** `.devdeck.json` at a project root declares display name, expected ports, start commands, and profile membership.
- **Do:** JSON schema with strict validation, a size limit, and no code execution. **Start commands from a repo file require one-time per-repo user approval** (show the exact commands) and re-approval if they change (store a hash).
- **Accept:** Unapproved commands never run.

## P3-3 Reserved and watched ports
- [ ] **What:** Mark ports as reserved for a project; alert when something else takes them.
- **UI:** Star a port, shown at the top even when free ("5173 is free").
- **Accept:** Conflict notification explains who took it (P1-5).

## P3-4 Launch through DevDeck (log capture)
- [ ] **What:** Start a process from DevDeck so its stdout and stderr can be shown and filtered like Docker logs. macOS does not allow attaching to another process's output afterward, so this is the only supported way.
- **Do:** `child_process.spawn` with `shell: false`, parsed argument arrays, working directory validated, ring buffer (default 5,000 lines) per process, ANSI color support, search, copy, clear. Spawned processes are tracked and still follow all stop rules.
- **Accept:** Logs persist only in memory unless the user opts in; secrets in arguments are masked in the UI.

## P3-5 Resource history and thresholds
- [ ] **What:** One-hour in-memory history of CPU and memory per project with a sparkline; per-project thresholds that trigger a notification.
- **Accept:** No disk writes unless the user opts in.

## P3-6 CLI companion
- [ ] **What:** `devdeck ls [--json]`, `devdeck port 3000`, `devdeck stop <port|pid>`, `devdeck logs <name>`.
- **Do:** A tiny Node CLI talks to the running app over a user-only Unix domain socket (permissions `0600`, token check). The CLI **cannot bypass confirmation**: stop requests from the CLI require `--yes`, otherwise the app shows its normal dialog. Same identity checks apply.
- **Accept:** Works without the window open (menu bar running); fails clearly if the app is not running.

## P3-7 URL scheme
- [ ] **What:** `devdeck://port/3000` and `devdeck://project/<name>` focus the relevant row. **No destructive actions through URLs.**

## P3-8 Raycast and Alfred extensions
- [ ] **What:** Raycast extension (list, search, open URL, stop with confirmation) built on the CLI. Alfred workflow as a stretch goal.

## P3-9 Export and diagnostics
- [ ] **What:** "Copy snapshot" (JSON or text) with masked arguments and no environment data. "Copy diagnostics" for bug reports (app version, macOS version, Docker provider, counts).
- **Accept:** Reviewable before copy; contains no secrets.

---

# PHASE P4: Later (design docs only, do not implement yet)

Write a short design note under `docs/future/` for each and stop.

- **P4-1** Local Kubernetes (kind, minikube) pods and port-forwards.
- **P4-2** Devcontainer awareness.
- **P4-3** Docker images, volumes, networks, and prune with a size preview.
- **P4-4** Mobile testing helper: LAN URL and QR code for a dev server.
- **P4-5** Remote hosts, and Windows and Linux providers behind the existing provider interface.

---

## 3. Cross-cutting requirements

### Settings additions
Add to `src/main/services/settings.ts` with schema validation and defaults:
`hotkey`, `preferredEditor`, `preferredTerminal`, `notifications` (per type), `memoryThresholdMb`, `showUnmanageable`, `hintsEnabled`, `showEnvViewer`, `profiles[]`, `reservedPorts[]`, `approvedRepoConfigs{path: hash}`.

### New IPC channels (document each in `docs/03-ipc-contract.md`)
`ports:lookup`, `proc:details`, `proc:tree`, `proc:signal` (stop, pause, resume, reload, group), `url:open`, `project:openEditor`, `project:openFinder`, `project:openTerminal`, `docker:remove`, `docker:composeAction`, `docker:stats`, `docker:exec`, `docker:inspect`, `profiles:*`, `repoConfig:*`, `launch:start`, `launch:logs`, `cli:*`.

### Performance
- Process polling stays paused while the window is hidden; so do Docker stats streams.
- `lsof` calls are batched into one invocation per refresh.
- Git and runtime detection are cached and never block rendering.
- UI list virtualization if more than 200 rows.

### Accessibility
- Full keyboard navigation (arrow keys, `Enter` for details, `Delete` for Stop with confirmation).
- Visible focus rings, ARIA labels for icon buttons, `prefers-reduced-motion` respected, text readable at 200%.

### Testing matrix to record in `docs/testing/`
Docker Desktop, OrbStack, Colima, custom socket; keyboard-only run; reduced motion; 200% text; clean-Mac install; Apple Silicon and Intel.

---

## 4. Suggested commit order

1. P0-1 to P0-5 (safety and housekeeping)
2. P0-6, P0-7 (end-to-end and Docker tests)
3. P0-8, P0-9 (release pipeline and docs)
4. P1-1 to P1-14
5. P2-1 to P2-14
6. P3-1 to P3-9
7. P4 design notes

Stop and ask the maintainer if a feature needs a secret, an Apple Developer account, or a design decision that this document does not settle.