# DevDeck interface

Implementation reference, updated 2026-10-19 after the missing-features UX review.

## Direction
"Quiet instrument panel." Technical but readable: dense rows, hairlines, monospace for machine values,
one accent color, no decoration that carries no information.

## Color (OKLCH tokens; define as CSS custom properties, light + dark)
| Token | Dark | Light |
|---|---|---|
| --bg | oklch(16% 0.005 250) | oklch(98% 0.003 250) |
| --surface | oklch(20% 0.006 250) | oklch(100% 0 0) |
| --line | oklch(30% 0.008 250) | oklch(90% 0.004 250) |
| --text | oklch(95% 0.005 250) | oklch(20% 0.01 250) |
| --muted-dim | oklch(64% 0.01 250) | oklch(53% 0.01 250) |
| --muted | oklch(70% 0.01 250) | oklch(46% 0.01 250) |
| --accent (running, focus) | oklch(80% 0.17 150) | oklch(48% 0.15 150) |
| --danger (stop, destructive) | oklch(68% 0.2 25) | oklch(50% 0.2 25) |
| --warn | oklch(80% 0.15 85) | oklch(52% 0.14 75) |
Verify every text/background pair reaches 4.5:1 (use the `audit` command). Adjust lightness, not hue.

## Type
- Text: system UI stack (`-apple-system, system-ui`) — native feel, zero font download.
- Machine values (PID, port, command, logs): `ui-monospace, "SF Mono", Menlo, monospace`.
- Scale: 12 / 13 / 15 / 20 / 28. Weights 400 and 600 only. Line-height 1.4 body, 1.2 headings.

## Shape and space
4px base grid. Radius 6px (controls), 10px (panels/popover). 1px hairline borders, no shadows except
the menu-bar popover. Row height 32px (compact) / 40px (comfortable).

## Components (minimum set)
Row, Group header, Button (primary / quiet / danger), Search field, Toggle, Tabs (2–3), Confirm dialog,
Empty state, Inline status dot + label, Toast, Log viewer. Build these once, reuse everywhere.

## Motion
Short (120–200ms), purposeful, GSAP only where CSS cannot do it. See `docs/07-motion-guidelines.md`.

## Do / Don't
- Do show state as dot + word ("Running", "Stopped"). Don't use color alone.
- Do use one primary button per view. Don't add gradients, glows or icon tiles.
- Do put empty and error states on every list. Don't leave blank screens.

## Screen hierarchy

- Processes: search and port lookup first, then project rows. Sort and tree are direct controls;
  protocol, exposure, state and heavy-process filters live in Filters with a count and reset action.
  Filtered empty states offer Clear filters. Project actions collect editor, Finder, Terminal,
  profile save and repository import; resource history expands below the heading.
- Docker: project headings show running/total counts and stack actions. Container rows keep Details,
  Logs and lifecycle actions visible. More contains shell, ID copy and removal. Stopped containers
  say Stopped; raw provider state and machine values stay in details. Stats occupy a separate line.
- Profiles: the header keeps navigation, Share, History and Settings. The screen has a structured
  profile form with named process/container members, field validation, masked commands and running
  status. Imported profiles explain how to edit and reimport their source. Capture is an optional
  disclosure with folder and command fields. Drafts survive tab switches.
- Settings: General, Processes, Notifications and Docker sections. Errors stay adjacent to controls;
  invalid threshold inputs return to the saved value. Environment viewing remains opt-in.
- Share: an exact, redacted export preview precedes clipboard writes. Never copy in the background.

## Interaction and accessibility

Dialogs have accessible names, initial Cancel/Close focus, contained Tab navigation, Escape and
focus restoration. Busy destructive actions disable dismissal and repeat submission. Shortcuts
ignore text fields; Tab and Escape always leave the shortcut recorder. Up/Down navigate rows,
Enter opens details, and Delete opens the normal confirmation. Revealed secret values reset when
panels close. Toasts pause while focused or busy; expired Undo cannot trigger a late action.

Long paths and commands wrap within bounded detail fields. At 200% zoom the shell scrolls so the
list and header remain reachable. Lists over 200 rows use measured windowing with overscan;
expanded details change row height. Polling never animates rows. Loading indicators are static with
visible status text, and reduced motion disables transitions. System, Light and Dark themes share
one token set; muted text contrast was checked against both background and surface (minimum 4.97:1).

## Verification

Electron UX scenarios cover scoped navigation, profile validation, durable error feedback,
Pause/Resume, modal keyboard containment, concealed details and logs. The large-list scenario checks
240 rows, keyboard navigation, notification focus, reduced motion, 200% zoom and export review.
Synthetic fixture screenshots are local QA evidence, not release screenshots. See
`docs/testing/release-matrix.md` for the checks still requiring real providers and signed builds.
