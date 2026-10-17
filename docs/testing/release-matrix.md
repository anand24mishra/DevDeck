# Release verification — 2026-10-18

These results describe the local P0-1–P0-8 implementation, not a shipped release.
Feature checkboxes remain unchecked until merge. No release has been published.

| Check | Result | Evidence / remaining work |
|---|---|---|
| Typecheck, lint, unit/integration suite, build | Pass | 56 tests passed; 1 Docker test skipped |
| Electron smoke on macOS Apple Silicon | Pass | Real disposable server: project/search, tray Cancel, window Cancel and Confirm |
| IPC hostile inputs and sender boundaries | Pass | `tests/unit/ipc.test.ts`, `validate.test.ts`: subframes, unowned windows, lookalike URLs, extra fields, redacted errors |
| Captured process identity and self-tree | Pass | `kill.test.ts`, `allowlist.test.ts`, real-child integration tests |
| Unsigned Apple Silicon package | Pass | electron-builder directory build with explicit unsigned overrides |
| Packaged fuses and file scope | Pass | Actual binary fuse wire inspected; ASAR contains production entry, no tests/docs/e2e |
| Universal signed DMG/ZIP | Pending | Configuration and draft workflow prepared; repository signing secrets absent |
| Notarization, stapling, Gatekeeper | Pending | Requires Apple Developer account and signing secrets |
| Update from previous signed version | Pending | Requires two signed releases and installed-copy verification |
| Docker Desktop | Pending | Opt-in local test skipped: no accessible daemon |
| OrbStack | Pending | Run `npm run test:docker` with provider socket and preloaded image |
| Colima | Pending | Run `npm run test:docker` with provider socket and preloaded image |
| Custom Docker socket | Pending | Set `DEVDECK_DOCKER_SOCKET` and run the opt-in test |
| Native tray dialog visual interaction | Pending | Electron smoke supplies Cancel through an isolated test entry |
| Complete keyboard-only run | Pending | Smoke verifies default Cancel focus; full navigation needs manual QA |
| Reduced motion | Pending | Manual system-setting check |
| 200% text size | Pending | Manual layout and control reachability check |
| Light and dark themes | Pending | Manual visual check; no styling changed in this P0 work |
| Clean-Mac install | Pending | Test a downloaded draft on a clean Mac |
| Intel hardware | Pending | Build target is universal; runtime testing requires an Intel Mac |
| GitHub-hosted CI | Pending | Local changes have not been pushed |

## Maintainer handoff

`gh secret list --repo anand24mishra/DevDeck --json name` returned no secret names.
Configure the five repository secrets documented in README.md. Never paste secret values into chat.
The supplied missing-features spec requires stopping at an Apple account or credential dependency.
P0-9 and phases P1–P4 have not been implemented in this pass.
