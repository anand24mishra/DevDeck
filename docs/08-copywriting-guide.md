# 08 — Copywriting guide (plain language)

Write for a smart person who has never opened a terminal.

| Technical | Say in the UI | Details line (mono) |
|---|---|---|
| SIGTERM | Stop | `SIGTERM` |
| SIGKILL | Force stop | `SIGKILL` |
| PID | Process | `pid 4821` |
| listening port | Port 3000 | `TCP :3000` |
| cwd / project root | Project | `~/code/api-server` |
| container exited | Stopped | `exited (0)` |
| ENOENT / EACCES | Couldn't find it / Not allowed | `EACCES` |

## Rules
- Buttons are verbs: Stop, Restart, Force stop, Show logs. Never "OK/Submit".
- Confirmations: "Stop 4 processes in api-server?" then buttons "Stop" and "Cancel".
- Errors say what happened, what it means, what to do: "Docker isn't running. Start Docker Desktop, then refresh."
- Empty states invite an action: "Nothing running for your projects."
- Sentence case. No exclamation marks. No jokes in errors.
- Avoid: "seamless", "powerful", "supercharge", "unlock", "effortless". Say the specific thing.
