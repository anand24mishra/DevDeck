# 10 — Release and signing

Distribution: GitHub Releases + Homebrew cask. Not the Mac App Store (sandbox blocks the core feature).

## One-time
Apple Developer Program → **Developer ID Application** certificate → export `.p12`.
Repository secrets: `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

## electron-builder (mac)
hardened runtime on, entitlements plist, `notarize` enabled, target dmg (+zip for updater), universal or
per-arch (if `ssh2`/native modules block universal, ship arm64 and x64 separately), `publish: github`.

## Fuses
Disable `runAsNode`, `NODE_OPTIONS`, and inspect args; enable ASAR integrity and only-load-from-ASAR.

## CI (tag `v*`)
checkout → setup-node 20 → `npm ci` → typecheck → test → build → `electron-builder --mac --publish always`
→ draft release. Human downloads the DMG from the draft on a clean Mac, verifies `spctl -a -vv`, tests update
from the previous version, then publishes.

## Updates
`electron-updater` checks GitHub Releases; only works for signed, notarized builds.

## Homebrew cask
Separate `homebrew-tap` repo; update `version` and `sha256` per release.

## Release checklist
See `.agents/skills/release/SKILL.md` (`/release`).
