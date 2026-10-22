# DevDeck — AI-assisted development history

Prepared for the mid-semester project evaluation. Updated **23 October 2026**.

This is a professional, curated record of the development requests available in this project session,
the work recorded in Git, and the resulting verification. Requests have been corrected for spelling
and clarity; they are **summaries, not a verbatim chat transcript**. Informal conversation and
repeated messages have been omitted. Earlier project work is identified from repository history
rather than reconstructed as an invented conversation.

The project owner supplied the requirements, requested feature implementation and UX improvements,
and directed documentation and GitHub consolidation. AI assistance was used for implementation,
review, testing and documentation. This record does not claim that AI-assisted code was written
without assistance.

## Project objective

Build a macOS application that helps developers understand which local programs, ports and Docker
containers belong to their projects, and safely stop or restart development stacks. The interface
should be simple enough to use without knowing operating-system signal names or process identifiers.

The application uses Electron, React and TypeScript. Privileged operations remain in Electron's main
process. The screen communicates through validated IPC rather than running shell commands directly.

## Starting point: the existing application

Before the missing-features request, the repository already contained the application scaffold,
process list, safe-stop flow, Docker basics, menu-bar/settings support and recently stopped history.
These are existing development milestones, not newly invented requests in this log.

| Existing milestone | Git evidence | Contribution to the project |
|---|---|---|
| Project scaffold | `9a1a12b` | Initial application and project structure |
| Process list and project grouping | `8b77d2e` | Display local processes, ports and projects |
| Safe process termination | `5e1c7b7` | Confirmation and controlled process termination |
| Docker container support | `76d2633` | Container listing, lifecycle actions and log viewing |
| Menu bar and settings | `b8e2f06` | Tray integration, window behavior and preferences |
| Recently stopped history | `f054f68` | Remember stopped development programs and provide restart behavior |
| Additional safety hardening | `5e40723` | Strengthen identity, input and directory checks |

## Step 1 — Define and implement the missing features

**Cleaned request:** “Implement all missing features in the supplied DevDeck specification.”

**Development approach:** Use the supplied P0–P3 feature order, update the IPC contract before changes
on either side, implement main/preload behavior before connecting the UI, and keep the safety model
active throughout. Complete P4 as design notes, as requested by the specification.

**Work recorded:**

- P0 strengthened tray confirmation, confirmed identities, self-tree protection, application metadata,
  lint/CI, Electron smoke tests, the opt-in Docker test and release preparation.
- P1 added port lookup and conflict explanations, friendly labels, local URL and project-tool actions,
  shortcuts, Undo, resource views, notifications, idle hints, Docker lifecycle/recovery and onboarding.
- P2 added process trees, bind visibility, socket filters, details, opt-in environment inspection,
  additional signals, leftover hints, Git/runtime context, broader development-tool recognition,
  tunnel detection, read-only owners, Docker stats, inspection and interactive shell preparation.
- P3 added stack profiles, explicitly approved repository configuration, watched ports, independent
  launches and captured output, resource history/thresholds, an authenticated local CLI, focus-only
  links, launcher integrations and previewed exports.
- P4 produced five bounded future-design documents. It did not add the proposed runtime integrations.

**Representative evidence:** `f3c6148` (tray confirmation), `5066c00` (port lookup), `6ea0dcb` (process
trees), `0dc6430` (repository approval), `57bf268` (CLI) and `71d8f8b` (future design notes).
The complete feature definitions remain in [the implementation spec](../features/missing-features.md).

## Step 2 — Improve the interface and review the complete UX

**Cleaned requests:** “Improve the UI.” “Review all features from a UX engineer's perspective and
make the relevant improvements.”

**Development approach:** Preserve the existing quiet instrument-panel design. Review navigation,
information hierarchy, forms, keyboard access, error recovery, disclosure of sensitive information,
light/dark themes and large-text layouts across the new features.

**Changes made:**

- Scope header controls to Processes, Docker or Profiles so unrelated actions do not appear together.
- Replace raw profile JSON editing with named process/container members and field-level validation.
- Group secondary project/container actions into disclosures while retaining common lifecycle actions.
- Add meaningful filtered empty states and reset controls.
- Organize settings into General, Processes, Notifications and Docker sections.
- Share dialog focus containment/restoration, preserve Cancel defaults and allow keyboard escape paths.
- Keep action errors visible after refresh, prevent repeated submissions and expose Resume after Pause.
- Wrap long details without overlaps, improve muted-text contrast, and verify measured list windowing.
- Mask commands and environment values initially; remask commands after leaving Profiles while keeping
  draft input intact.

**Evidence:** `2bd8352` and `6c34e69`; [the design reference](../DESIGN.md); Electron accessibility and
feature-UX scenarios. The source walkthrough is in [the codebase audit](CODEBASE_AUDIT.md).

## Step 3 — Review safety and test real behavior

**Context:** Verification was part of the implementation specification and the request to complete
all features. The following items are development responses, not additional invented user messages.

**Review focus:** Prevent signals from reaching a reused PID, another user's process, an ignored
program or DevDeck's own process tree. Keep renderer input constrained, repository commands explicitly
approved, environment access opt-in, and exports limited to reviewed fields.

**Important findings and resolutions:**

| Finding | Resolution | Evidence |
|---|---|---|
| A confirmed process may exit and its PID may be reused | Verify PID, start time and observed command before every signal | Kill/IPC tests and real disposable-process integration tests |
| A repository config can change after review | Bind approval to the root and exact bytes; reread after confirmation | Repository-config/approval tests |
| Editing a profile could leave an older saved target | Bind saved launch identity to the configured command and folder | `0741d13` and profile identity tests |
| Detached launch identity could be read before reparenting completed | Snapshot the live direct child, then retry unchanged normal identity validation briefly | `6c34e69`, launcher/kill tests and profile restart E2E |
| Settings/history parser errors could expose command excerpts in diagnostics | Use fixed recovery messages and assert that only those messages are logged | Publication privacy fix and existing-topic regression tests |

Testing uses newly created disposable servers. It does not stop the developer's unrelated running
programs. Synthetic UI fixtures exercise interface states; they are not evidence that a real Docker
provider has been accepted.

## Step 4 — Prepare the codebase for evaluation and maintenance

**Cleaned request:** “Create a detailed audit file in simple language so I can understand the whole
codebase, including its functions.”

**Documentation produced:**

- [CODEBASE_AUDIT.md](CODEBASE_AUDIT.md): architecture, folders, startup/shutdown, feature flows,
  function reference, IPC/types, storage, security boundaries, tests, release process and known limits.
- [AI_DEVELOPMENT_HISTORY.md](AI_DEVELOPMENT_HISTORY.md): this curated development record.
- Updated README links and verification information so a reviewer can start from one place.

The audit distinguishes implemented behavior, tested behavior and pending external acceptance. For
example, private file permissions do not mean all settings are encrypted, and pattern-based log
redaction does not guarantee that arbitrary service output contains no secrets.

## Step 5 — Consolidate the relevant work into GitHub main

**Cleaned request:** “Push all relevant code to GitHub, exclude unrelated files, and consolidate the
project into main.”

**Preparation recorded:**

1. Fetch current GitHub branch information rather than relying on the number of local branches.
2. Verify that the completed implementation contains both remote branch tips and the feature work.
3. Exclude an abandoned local snapshot-token API draft that has no matching implementation.
4. Inspect tracked paths and unpublished commit contents for credentials, generated output, local
   agent notes and unrelated artifacts.
5. Correct the primary CI job from Node 20 to Node 22 and align package/lockfile engine requirements
   with the locked test toolchain.
6. Run local validation, commit the publication documents/fixes, and move `main` forward without a
   force push or history rewrite. The repository's commit history is the record of publication.

Local dependency folders, build packages, QA captures, logs, certificates, environment files and
agent scratch notes are excluded from publication. Source, meaningful tests, required assets,
configuration, extension source and project documentation are relevant repository content.

## Verification available for the evaluation

Latest local publication verification: **178 unit/integration tests passed, one real-Docker test
skipped, and all four Electron scenarios passed**. Type checking, strict linting and the production
build also passed. Earlier unsigned package inspection checked its production file scope and Electron
fuses. GitHub-hosted CI results are separate evidence from these local checks.

The four Electron scenarios cover process discovery and stop/cancel, independent profile launch and
restart/CLI/capture, large-list keyboard/reduced-motion/200% zoom behavior, and feature UX/privacy.

Signing/notarization, signed update verification, real Docker-provider and interactive shell checks,
clean-Mac installation, Intel hardware, VoiceOver and interactive launcher-host imports remain
external acceptance work. See [the release matrix](testing/release-matrix.md). No public signed release
or completed external acceptance is claimed by this log.

## Suggested presentation order

1. Explain the problem: identifying and safely managing local development stacks.
2. Show the three tabs and one small end-to-end example using a server created for the demonstration.
3. Trace a screen request through preload, validated IPC and a main-process service.
4. Explain why process identity needs more than a PID and why Cancel is the default.
5. Demonstrate one profile, a recoverable error and the masked export preview.
6. Present test evidence, the AI-assisted development process and the remaining release limitations.

Use the function reference to answer implementation questions. Describe verified work precisely;
do not present design-only proposals or pending hardware/provider checks as completed features.
