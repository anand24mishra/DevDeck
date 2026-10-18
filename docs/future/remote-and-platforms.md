# P4-5: Remote hosts and additional platforms

Design only. Keep provider interfaces independent from UI: inventory, sockets, identity verification and permitted actions. Add Linux and Windows providers with explicit capability flags and native process identity semantics. A PID alone is never sufficient; record creation time and executable identity. Preserve current-user scope, ignore priority and protection of DevDeck and its helpers.

Remote hosts need a separate trust model, credentials in an OS credential store, pinned host identity, explicit connection consent and per-host permissions. Start with read-only SSH inventory through a fixed executable and argument arrays. Do not send credentials, command arguments or environment to telemetry or diagnostics. A disconnected or changed host must invalidate every captured action target.

Use separate local fixtures and disposable remote hosts. Test reconnects, PID reuse, privilege changes, cancellation and partial failures before enabling remote mutations. Packaging, updater and signing support require their own platform release matrices. No remote, Windows or Linux provider implementation is included.
