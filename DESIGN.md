# DESIGN.md (seed)
Starting point for the designer agent. After the first screens ship, regenerate from real code with
`/impeccable document` and keep the result in sync.

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
