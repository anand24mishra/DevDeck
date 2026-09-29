# 15 — Git, GitHub remote and pull requests

## First push (once)
1. On GitHub create an **empty** repo `DevDeck` (no README, no license, no .gitignore, or the first push is rejected).
2. In the project folder:
```bash
git init                                  # skip if the scaffold already did
git add .
git status                                # check: no node_modules, dist, .env
git commit -m "chore: scaffold DevDeck and agent pack"
git branch -M main
git remote add origin https://github.com/anand24mishra/DevDeck.git
git push -u origin main
```
3. Sign-in: GitHub no longer accepts account passwords for HTTPS pushes. Easiest: `brew install gh && gh auth login` (choose HTTPS, sign in with browser), then `gh auth setup-git`. Alternative: a fine-grained personal access token with Contents + Pull requests (read/write) on this repo only.

## Protect main (GitHub → Settings → Branches → Add rule for `main`)
Require a pull request before merging; require status check `ci`; block force pushes. For a solo repo do **not** require approvals (you cannot approve your own PR). Optional: require linear history.

## Daily flow
```
git switch main && git pull
git switch -c feat/PROC-001-process-list      # the orchestrator does this for you
... agents work, lanes merge into this branch ...
/open-pr                                       # push + PR, agent never merges
```
You review the PR on GitHub (Files changed, CI, the `PROJECT.md` entry), then click **Squash and merge** and delete the branch. Locally: `git switch main && git pull`.

## PR checklist (also in the template)
Summary · spec link · `PROJECT.md` entry ID · DoD boxes with evidence · screenshots for UI · safety notes · risks · how to test.

## Manual PR without GitHub CLI
`git push -u origin <branch>`, open `https://github.com/anand24mishra/DevDeck/compare/main...<branch>?expand=1`, paste the PR body.

## Commands agents may run without asking / must ask first
Without asking: `git status`, `git diff`, `git log`, `git switch -c`, `git add`, `git commit`.
Ask first: `git push`, `gh pr create`, `git merge`, `git worktree remove`, anything destructive. Keep Antigravity's terminal policy on "request review" for these.
