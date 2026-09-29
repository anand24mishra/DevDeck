# v2 — Command palette and global hotkey

## Acceptance criteria
- [ ] Cmd+K palette: stop by name/port/project, start profile, open logs, jump to screen, toggle theme
- [ ] Global hotkey (default configurable) opens the palette from anywhere
- [ ] Fuzzy search with clear ranking; recent items first; fully keyboard driven
- [ ] Hotkey conflicts detected and reported; can be disabled

## Notes
`globalShortcut.register` in main; palette is a small frameless window or the main window focused to the palette. Actions call the same services as the UI (no duplicate logic).
