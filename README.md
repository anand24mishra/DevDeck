# DevDeck

A small macOS app that shows your dev processes, ports and Docker containers, grouped by project, and lets you stop a whole stack in one click.

## Run it
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Release preparation

The release workflow creates **drafts only** on version tags matching `package.json`.
No signed/notarized release has been verified by this implementation work.

Maintainer steps:

1. Join the Apple Developer Program and export a **Developer ID Application** certificate as `.p12`.
2. Set these GitHub Actions repository secrets (never commit or paste their values):
   `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD`, `APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
   The workflow maps the certificate secrets to electron-builder's `CSC_LINK` and `CSC_KEY_PASSWORD`.
   `GH_TOKEN` uses the workflow token with `contents: write`.
3. After reviewing and merging, push the matching version tag. The workflow checks the app signature,
   notarization and stapling, then attaches universal DMG/ZIP files and update metadata to a draft.
4. Install that draft on a clean Mac, verify Gatekeeper, and test an update from a previous signed version.
   Test both Intel and Apple Silicon before publishing the draft manually.

`npm run build:unpack` creates a local unsigned Apple Silicon package for inspection; it cannot
prove signing, notarization, or update behavior. Production builds enable hardened runtime,
ASAR integrity and restricted Electron fuses. Only packaged builds check the GitHub update feed;
download and restart require confirmation. The separately stapled DMG is excluded from updater
metadata; the ZIP is the update payload. Squirrel.Mac enforces the application's code-signing
requirement when installing an update; checksum verification is supplied by electron-updater.

`packaging/devdeck.rb` is a cask template. After publishing a verified release, replace its
version and SHA-256 with the release values and submit it to the maintainer's Homebrew tap.
No tap or working `brew install` command is claimed yet.

References: [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses),
[electron-builder macOS packaging](https://www.electron.build/v26/docs/mac/).
