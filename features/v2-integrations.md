# v2 — Integrations: Homebrew services, Kubernetes port-forward, tunnels

## Acceptance criteria
- [ ] Homebrew services list/start/stop/restart via `brew services` (detect brew path on Intel and Apple Silicon)
- [ ] Kubernetes: list active `kubectl port-forward` sessions, start/stop, auto-reconnect option
- [ ] Tunnels: detect running ngrok/cloudflared processes, show public URL when available, stop safely
- [ ] Each integration is optional, detected at runtime, and hidden when the tool isn't installed
- [ ] All commands run with argument arrays (no shell string building), with timeouts

## Notes
We do not bundle kubectl/brew/ngrok. Treat their output as untrusted text; parse defensively; unit-test parsers with fixtures.
