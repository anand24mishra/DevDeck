# 09 — Testing strategy

## Unit (Vitest) — mandatory for safety code
- `parsePs`: real fixture output → rows. Fixtures live in `tests/fixtures/`.
- Allowlist, `.app/Contents/` filter, ignore list, protected self-tree.
- PID-reuse guard (same pid, different start time → refused).
- IPC validators: pids, container ids, unknown fields, oversized arrays.
- Kill escalation with fake timers: SIGTERM first, SIGKILL only if still alive.

## Integration
- Spawn a real `python3 -m http.server` on a random port; assert it appears with the right project and port; stop it; assert gone.
- Docker tests run only if a socket exists; otherwise skipped with a clear message.

## End-to-end (Playwright for Electron)
Launch the built app; assert window title, Processes tab, search, confirm dialog text, and that Cancel does nothing.

## Manual matrix (before every release)
Docker Desktop / OrbStack / Colima / no Docker · light / dark · 100% and 200% text size · keyboard only ·
reduced motion on · clean-Mac install from the downloaded DMG · update from previous version.

## Design checks
Run the Impeccable detector on changed UI; fix P0/P1. Run Vercel `web-design-guidelines` review on components.

## Test budget (rule 80)
Few, meaningful tests. Each must protect a safety rule or a bug a real user would hit.
- Unit tests live next to their module's topic in `tests/unit/`, one file per logic module (parser, allowlist, kill guard, IPC validators). Add cases to the existing file.
- One integration file, one Playwright smoke spec.
- No snapshot tests, no tests for presentational components, no mock-only assertions, no placeholder tests, no coverage targets.
- Fixtures are real captured output, kept small. Test output folders (`coverage/`, `playwright-report/`, `test-results/`) are gitignored.
