# P4-2: Devcontainer awareness

Design only. Recognize containers using standard devcontainer labels and a bounded, non-executing read of devcontainer metadata. Associate a container with a verified local workspace; show “Workspace container” and its status beside that project.

Config files may contain substitutions, lifecycle commands and remote paths. Do not evaluate them, run lifecycle hooks, or trust labels as local filesystem authorization. Environment remains masked and opt-in; copied snapshots exclude it. Use an exact container ID for inspections and actions, with normal Docker confirmations.

Start with read-only association for Docker Desktop, OrbStack and Colima. Handle multiple workspaces, stale labels, a missing workspace and several containers per project. Opening an editor session requires a separate allowlisted integration and explicit action. Test label fixtures and a disposable devcontainer before adding any launch flow. No devcontainer implementation is included.
