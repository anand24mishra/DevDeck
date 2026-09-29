# 13 — Definition of done (every feature)

- [ ] All acceptance criteria in the feature spec are checked, with evidence (test name or steps)
- [ ] Safety model respected; new risky paths have unit tests
- [ ] IPC contract updated and validated on both sides
- [ ] UI matches `DESIGN.md`; Impeccable detector shows no P0/P1; keyboard and focus work
- [ ] Copy follows `docs/08-copywriting-guide.md` (plain language)
- [ ] Empty, loading and error states exist
- [ ] Reduced motion honored; no animation on poll ticks
- [ ] `npm run typecheck` and `npm test` pass; no `any` added without a comment
- [ ] Code review and security review findings: no open P0/P1
- [ ] No unnecessary files or tests added (rule 80); every new file is listed under "Files added" in the `PROJECT.md` entry
- [ ] `PROJECT.md` entry added with real code, decisions and how to test
- [ ] `CHANGELOG.md` line added under Unreleased
- [ ] Human ran the app and approved
