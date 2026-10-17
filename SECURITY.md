# Security

DevDeck can stop processes and control Docker on your machine, so security is a core feature.

## Reporting a vulnerability
Open a private security advisory on the GitHub repository, or email the maintainer address listed there.
Please include steps to reproduce. Expect an acknowledgement within 7 days.

## What DevDeck promises
- No telemetry or process-data uploads. Packaged copies may contact GitHub for update metadata
  and artifacts; source builds do not check the feed.
- Only your own user's processes; never sudo, never system processes.
- Command lines may contain secrets: they are never written to logs or sent anywhere.
- Signed/notarized release infrastructure is prepared, but signing and clean-Mac verification
  are pending maintainer credentials. Do not treat a source or unsigned development build as a
  verified release. The updater checks checksums; Squirrel.Mac enforces signing before installation.
- Stops compare the confirmed PID, start time, and command before both normal and force signals.
  The ignore list and DevDeck parent/descendant protection cannot be overridden by the renderer.
- Optional recently stopped persistence is encrypted through macOS safeStorage; it is off by default.

Design details: `docs/04-safety-model.md`.
