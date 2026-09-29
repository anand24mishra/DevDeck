# 01 — Vision

## One sentence
DevDeck shows what is running for your projects and lets you stop or restart it safely, in one click.

## The problem
Developers lose time to `lsof -i :3000`, forgotten servers, zombie node processes and containers that
keep eating memory. Activity Monitor shows everything except which project a thing belongs to.

## The wedge
Project-first, not process-first. "Stop everything for *api-server*" beats a flat list of PIDs.

## What "minimal" means here
- 3 areas only: Processes, Docker, Settings (v2 adds Terminal).
- Every screen has one primary action.
- If a control needs a paragraph to explain, redesign it.

## What "understandable by everyone" means
- Labels a beginner can read: "Stop", "Force stop", "Restart", "In use by".
- Technical values (PID, signal names) appear in a "Details" line, in monospace.
- Every destructive action says what will happen first.

## Non-goals
Replacing Activity Monitor or Docker Desktop; cloud features; accounts; analytics.
