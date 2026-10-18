# DevDeck for Alfred

Optional local workflow for Alfred with Powerpack and Node.js on PATH. DevDeck must be running. Set the workflow environment variable `DEVDECK_CLI` to your absolute linked CLI path (default `~/.local/bin/devdeck`). Alfred's PATH may need your Node installation directory added.

Zip this folder's **contents** (info.plist, icon.png, list.cjs, action.cjs) into `DevDeck.alfredworkflow` and open that archive to import. No system installation or workflow import is performed by this repository.

Type `devdeck` and search by name, port, project or PID. Enter focuses the project; Command-Enter opens its first localhost port; Option-Enter requests a stop. Stops omit `--yes` and therefore require DevDeck's native confirmation of the current owner. No shell command is built from search input. Node scripts invoke the CLI with argument arrays. Interactive import and modifier-key behavior need a local Alfred QA run.
