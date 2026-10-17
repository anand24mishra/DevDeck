# DevDeck

A small macOS app that shows your dev processes, ports and Docker containers, grouped by project, and lets you stop a whole stack in one click.

## Run it
```bash
npm ci
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

## Current feature status

| Area | Implementation | Verification |
|---|---|---|
| Process/project list, search, CPU, memory and ports | Implemented | Unit tests and real-server Electron smoke |
| Confirmed safe stop, self-tree protection | Implemented | Identity/refusal tests and real-child tests |
| Docker lifecycle and live logs | Implemented | Parser tests; real daemon matrix pending |
| Tray, settings and recently stopped restart | Implemented | Unit/integration tests; manual visual matrix pending |
| Signed universal release and updates | Prepared | Credentials, clean-Mac and signed update chain pending |
| Additional P1–P3 capabilities | In progress | See `features/missing-features.md` |

Download a verified DMG from the repository's published Releases when available, drag DevDeck into
Applications, then open it. No published release or Homebrew tap is asserted by this source checkout.
For a local development copy, use the source commands above. Requires macOS and Node 22 or later.

The window is a compact project table with Processes and Docker tabs, a search field, Stop actions,
and expandable details. Release screenshots will be captured from a verified build; test captures
are kept out of Git. For test evidence and outstanding provider/accessibility/hardware checks, see
[the release matrix](docs/testing/release-matrix.md).

DevDeck never uses sudo. Only allowlisted processes belonging to your user can be stopped; app
bundles and DevDeck's own tree are protected. Command arguments are masked by default. All process
and Docker work stays in Electron's main process behind strict IPC validation; the renderer cannot
run commands. See [SECURITY.md](SECURITY.md) for the actual shipped boundaries and release caveats.

## Distribution verification

The tray's **Check for updates** action checks installed releases. Downloading and restarting each
require consent. Native signature failures are reported and do not install an unverified copy.

Before distributing a draft, run:

```bash
npm run verify:release -- release/mac-universal/DevDeck.app
```

This rejects unsigned/ad-hoc packages, missing Intel or Apple Silicon slices, incorrect fuses and
an unexpected update feed. CI also validates the notarization ticket and stapled DMG. To verify
updating end to end: install the previous signed release, publish the reviewed next release, choose
Check for updates, download, restart, and verify the new version. Repeat with a deliberately invalid
signature in an isolated QA environment to confirm refusal. This signed update-chain check is pending.

For Homebrew, use `packaging/devdeck.rb` only after replacing VERSION and SHA256 with the published
universal DMG values (calculate with `shasum -a 256 <downloaded-dmg>`), validating the cask, and
placing it in a maintained tap. Follow that tap's installation command. No placeholder cask should
be installed or published. A working public tap is still maintainer-owned distribution work.
