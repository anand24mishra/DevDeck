# v2 — Remote hosts over SSH

## Acceptance criteria
- [ ] Add a host from `~/.ssh/config` entries or manually; list processes/containers remotely (read-only first)
- [ ] Stop/restart on remote requires an extra confirmation naming the host
- [ ] Uses the system `ssh` binary and the user's agent/keys; DevDeck never stores passwords or private keys
- [ ] Connection reuse (ControlMaster), timeouts, clear errors for host-key or auth failures
- [ ] Remote commands come from a fixed set; no arbitrary command box in this feature

## Notes
Prefer spawning `ssh` with arg arrays over bundling an SSH library. Host key checking stays strict. Redact hostnames in logs by default.
