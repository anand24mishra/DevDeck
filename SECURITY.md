# Security

DevDeck can stop processes and control Docker on your machine, so security is a core feature.

## Reporting a vulnerability
Open a private security advisory on the GitHub repository, or email the maintainer address listed there.
Please include steps to reproduce. Expect an acknowledgement within 7 days.

## What DevDeck promises
- No telemetry; nothing leaves your machine.
- Only your own user's processes; never sudo, never system processes.
- Command lines may contain secrets: they are never written to logs or sent anywhere.
- Signed and notarized releases; updates are verified.

Design details: `docs/04-safety-model.md`.
