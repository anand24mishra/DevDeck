# v2 — Embedded terminal ("GUI for your terminal")

## Acceptance criteria
- [ ] Tabs with real PTY shells (login shell of the user), resize, copy/paste, scrollback, search
- [ ] Open a terminal in a project folder or inside a container from any row
- [ ] Handles heavy output without freezing (flow control / batching)
- [ ] Theme follows `DESIGN.md` tokens; font = mono token; ligatures off by default
- [ ] All PTYs are closed on quit; no orphaned shells

## Notes
`node-pty` (native module: rebuild for Electron, `asarUnpack` it, test the universal/arch builds) + `@xterm/xterm` with fit and search addons.
PTY lives in main; renderer only sends keystrokes/resizes and receives data via validated IPC channels `term:*`.
Security: the terminal is a full shell by design — never expose `term:*` to any remote content; keep CSP strict.
