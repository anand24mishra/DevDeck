# P4-3: Docker cleanup with preview

Design only. Add an inventory of unused images, stopped containers, networks and volumes with last-used information when available. Preview individual object names, IDs, reclaimable sizes and exclusions before offering cleanup. Estimates must be labeled; shared image layers make totals non-additive.

Exclude everything attached to a running container and re-check attachment state immediately before every removal. Never translate “clean project” into a blanket prune. Require an explicit second confirmation for volumes, explaining that persistent application data is deleted. Changed membership invalidates the preview; new objects are never swept in.

Use dockerode on the selected local socket. Return per-object success, refusal and failure without hiding partial results. No unattended cleanup, force removal, registry calls or volume deletion is part of this change. Test against pre-created disposable resources on each provider, including a resource becoming attached after preview. No cleanup implementation is included.
