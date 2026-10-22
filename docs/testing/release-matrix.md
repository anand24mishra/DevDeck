# Publication verification — 2026-10-23

P0-1 through P3-9 are implemented; P4 is design only. The maintainer authorized consolidation
into GitHub main. Feature checkboxes remain acceptance checklists, not release certification.
No signed release has been published by this implementation run. Local suite rerun: 2026-10-22.

| Check | Result | Evidence / remaining work |
|---|---|---|
| Typecheck | Pass | `npm run typecheck`, main/preload/shared and renderer |
| Lint | Pass | `npm run lint -- --max-warnings=0` |
| Unit/integration suite | Pass | 178 passed, 1 real-Docker test skipped; 41 files passed, 1 skipped |
| Production build | Pass | `npm run build`; bundled main, independent launch worker, preload and renderer |
| Electron process smoke | Pass | Disposable real server: discovery/search, native tray Cancel, window Cancel and confirmed stop |
| Independent profile launch | Pass | Native start Cancel, per-member partial failure, quiet server survives app restart, spaced arguments, capture, CLI and verified stop |
| Large-list accessibility | Pass | 240 synthetic rows, measured windowing, row keyboard navigation, notification focus, reduced-motion media, 200% zoom, reachable list and export Cancel |
| Feature UX | Pass | Scoped tabs, filter recovery, structured profile validation, durable action errors, modal focus containment/restoration, hidden container secrets, command remasking on tab changes, logs and Pause/Resume |
| Light and dark themes | Pass locally | Synthetic fixture screens visually inspected; muted text contrast against background and surface exceeds 4.97:1 |
| UI source review | Pass | Independent design, code and security review; actionable findings fixed; detector has three contextual toast-border warnings and no actionable findings |
| IPC boundaries and hostile inputs | Pass | Sender/subframe/unowned-window/lookalike-URL/unknown-field tests, masked errors and main-only settings keys |
| Identity and process safety | Pass | Current-user allowlist, app exclusion, ignores, PID reuse, self-tree, verified escalation and real-child tests |
| Profile/repository trust | Pass | Exact source approval, config reread, source-bound saved identities, live-child handoff proof, bounded exact-identity retries, executable shims, partial results and private settings writes |
| Secret handling and bounded data | Pass | Metadata file boundaries, secret redaction, environment opt-in, bounded log/history buffers, terminal-output sanitation and export whitelists |
| Docker stream/action logic | Pass with fixtures | Stats stream lifecycle, socket change cleanup, parsing, no-volume removal and shell argument construction; not real-provider acceptance |
| CLI and launcher integrations | Pass locally | CLI protocol/authorization tests and real process E2E; Raycast build/typecheck and Alfred plist validation |
| Unsigned Apple Silicon package | Pass | `npm run build:unpack`; unsigned inspection build only |
| Package security and scope | Pass | Actual binary fuse wire and ASAR scope inspected; launch worker included; CLI outside ASAR; no source tests/e2e/docs shipped |
| Signed universal DMG/ZIP | Pending external QA | Requires maintainer Developer ID certificate and repository signing secrets |
| Notarization, stapling and Gatekeeper | Pending external QA | Requires Apple account and a signed artifact |
| Signed update chain | Pending external QA | Install previous signed version, update to next signed version, verify refusal of an invalid signature |
| Docker Desktop / OrbStack / Colima | Pending external QA | No accessible daemon. Run `npm run test:docker` for each provider with an existing fixture image |
| Custom Docker socket | Pending external QA | Set `DEVDECK_DOCKER_SOCKET`; verify provider errors, streams and lifecycle |
| Interactive Docker shell | Pending external QA | Verify Terminal/iTerm launch, bash-to-sh fallback and unavailable CLI/Ruby recovery against a real daemon |
| Native tray/global shortcut | Partial | Automated isolated entry supplies Cancel; real menu-bar interaction and OS shortcut conflict behavior still need manual QA |
| System accessibility / VoiceOver | Partial | Electron keyboard, media and zoom checks pass; full VoiceOver/system-setting manual run remains |
| Raycast / Alfred import | Pending external QA | Source builds validate; interactive host installation/import is unverified |
| Clean-Mac and Intel | Pending external QA | Download signed draft onto clean Mac and run on Intel hardware |
| GitHub CI | Configured | Main-branch publication runs CI; use GitHub Actions for the latest remote execution result |
| Homebrew tap | Pending | Cask is a template requiring published artifact version/hash and maintained tap |
| Main consolidation | Authorized | Maintainer requested main publication; verify the current remote main commit |
| Human visual approval | Pending | Local UI scenarios and theme review pass; maintainer acceptance is separate |

## Reproduce local checks

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run build
npx playwright test
npm run build:unpack
```

The Electron harness uses a temporary settings directory. Destructive process tests create and clean
up their own servers. Docker tests never pull images or modify existing containers. Synthetic UX
fixtures provide read-only data; their IPC stubs are confined to the test harness and excluded from
the packaged app. Screenshots are local test artifacts, not screenshots of a verified release.

## Maintainer handoff

Configure the five signing secrets documented in README.md; never paste their values into chat.
The earlier repository secret-name inspection returned none. Verify the signed universal package,
notarization, clean installation and update chain before distribution. Real Docker provider/hardware
checks must remain pending until run. P4 proposals are in `docs/future/` and have no runtime code.

## Publication corrections and documentation

The CI main job now uses Node 22, matching the newer locked test toolchain; package and root-lock
engine declarations agree. Local checks ran on Node 24.15.0: typecheck, strict lint and build passed,
178 tests passed with one Docker skip, and four Electron scenarios passed in 20.6 seconds.
Settings/history recovery diagnostics use fixed text rather than caught errors that might contain
saved command excerpts. The tests assert this privacy behavior.

[CODEBASE_AUDIT.md](../CODEBASE_AUDIT.md) documents functions, data flows, boundaries and limitations.
[AI_DEVELOPMENT_HISTORY.md](../AI_DEVELOPMENT_HISTORY.md) is a curated, transparent development record
for evaluation, not a verbatim chat archive.
