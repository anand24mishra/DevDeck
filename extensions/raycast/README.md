# DevDeck for Raycast

Local extension; no store upload or automatic installation. Requires DevDeck running, the CLI linked on disk, Raycast, and Node 22.22.2 or newer (the pinned Raycast API requirement).

Run `npm ci --ignore-scripts --legacy-peer-deps`, `npm run typecheck`, and `npm run build` in this folder. Import the folder using Raycast's **Import Extension** command, then set **DevDeck CLI path** to the absolute executable path you linked. For development use `npm run dev`.

Search by process, project or port. The primary action focuses DevDeck; localhost actions open the browser. **Stop…** sends a request without `--yes`, so DevDeck shows its native Cancel-default confirmation with the current owner before signaling. A stale list cannot silently authorize a replacement process. Refresh reloads the list; commands and environments are never included.

Uses Raycast's documented [manifest](https://developers.raycast.com/information/manifest), [preferences](https://developers.raycast.com/api-reference/preferences) and [actions](https://developers.raycast.com/api-reference/user-interface/actions). Interactive import and keyboard checks need Raycast on the maintainer's Mac.
