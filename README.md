# DevDeck

A small macOS app that shows your dev processes, ports and Docker containers, grouped by project,
and lets you stop a whole stack in one click.

## Features

- **Processes** grouped by project, with ports, CPU and memory, search and a process tree
- **Safe stop**: asks first, only touches your own developer tools, and re-checks before every kill
- **Docker** containers with start, stop, restart, live logs and stats
- **Profiles** to save a stack and start it again later
- **Menu-bar tray**, notifications for stopped servers, and a recently stopped list with restart
- **CLI**, plus Raycast and Alfred extensions
- Light and dark themes, keyboard navigation, reduced motion

## Run it

Requires macOS and Node 22.

```bash
npm ci
npm run dev
```

## Build and test

```bash
npm run build        # typecheck and bundle
npm run build:unpack # local unsigned app
npm test             # unit and integration tests
npm run test:e2e     # Electron end-to-end tests
npm run lint
```

## Tech stack

Electron, React, TypeScript, Vite, Vitest, Playwright, dockerode.

## Safety

DevDeck never uses sudo. It only stops allowlisted processes owned by you, skips app bundles and its
own processes, and masks command arguments. All commands run in Electron's main process behind
validated IPC; the UI cannot run anything itself. Details in [SECURITY.md](SECURITY.md).

## Learn more

[How DevDeck works](docs/HOW_IT_WORKS.md) explains Electron and the architecture in plain English.

## Status

Version 1.0.0. No signed or notarized release has been published yet.
