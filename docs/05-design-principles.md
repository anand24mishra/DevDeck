# 05 — Design principles

1. **Show less.** If two elements do the same job, delete one.
2. **One primary action per view.** Everything else is quiet.
3. **State = dot + word.** "● Running" not just a green dot.
4. **Machine values in mono.** PID, ports, commands, logs. Everything else in the system font.
5. **Before every destructive action, say the consequence.** "Stop 4 processes in api-server."
6. **Empty and error states are designed.** "Nothing running. Start a project and it will appear here."
7. **Density with air.** Compact rows, but consistent 4px rhythm and clear group headers.
8. **Keyboard first.** Every action has a shortcut or focus path; focus ring always visible.
9. **Respect the OS.** Light/dark from system, native menu bar behavior, standard window controls.
10. **No decoration without information.** No gradients, glows, emoji icons, side-stripe borders, nested cards.

## Screens (v1.0)
Processes (default) · Docker · Settings · Confirm dialog · Menu-bar popover (quick stop).

## Review test
Show the screen to someone non-technical for 10 seconds. Can they say what it's for and what the
main button does? If not, simplify.
