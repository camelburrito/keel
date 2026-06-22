# CLAUDE.md — <APP>

Project-level instructions for Claude Code (claude.ai/code) and any AI agents working in this repository.

This file ships with `<APP>` at bootstrap time from [`camelburrito/keel`](https://github.com/camelburrito/keel). It codifies the workflow discipline that the keel reference projects developed over months of iteration. Treat the rules below as defaults — adjust per project, but do so explicitly (with a comment explaining the deviation) rather than letting them drift silently.

**Layered priority:** project-level rules in this file > user-global rules in `~/.claude/CLAUDE.md`. When a rule conflicts, the more specific (project) layer wins. Always quote the operative rule before deviating.

---

## 1. Workflow discipline

### Branch + PR for every change

- **Every task lives on its own branch.** Naming convention: `phase/N-<slug>` for GSD phases, `quick/NNNNNN-<slug>` for sub-day fixes (`260606-xyz` = YYMMDD-hint), `feature/<slug>` for ad-hoc work.
- **Quick tasks ALSO go through branch + PR**, even when the framework default says otherwise. The user rule wins over tool defaults.
- **At the end of every phase, push + open a PR automatically.** Do not stop at "unpushed commits, ready for review." Push first; open PR second; surface for review third.
- **Branch cleanup is part of "done":** when merging a PR, delete the remote branch (`gh pr merge --delete-branch`). When deleting a local branch, delete its remote counterpart in the same operation.
- **Stacked-PR merge dance:** never `--delete-branch` mid-stack. Update the next PR's base to `main`, cherry-pick its commits, force-push, then merge in order.

### `.planning/` files belong in the PR branch

- Always commit files under `.planning/` (handoffs, phase plans, ralph state, etc.) to the PR branch. Do NOT keep them local-only.
- Handoff content lives in a git-tracked file, not pasted into chat. The chat message is a 1–3 line pointer to the file.
- Write a handoff automatically at natural stopping boundaries (mid-flight multi-phase work, context running tight, user pausing). Don't wait to be asked.

### Verify before merge

- Before `gh pr merge`, verify `git ls-remote origin <branch>` matches local `HEAD`. A bare `git push` can silently fail if upstream tracking is lost.
- **Ask before merging every PR.** Prior same-session "merge" approval does NOT carry forward to a different PR. The cost of asking is low; the cost of an unwanted merge is high.

### Push rhythm

- **Never retry `git push` rapidly when pre-push fails.** The previous emulator/build stack takes 30–60s to tear down. Rapid retries stack process trees and produce cascade "failures" that look real but are environmental.
- **Don't pause mid-workflow asking permission.** Once a sequence is in motion (screenshots → fixes → PR → merge), finish it inline. Ask up front if approval is needed.

---

## 2. Ralph loop discipline

(Ralph is the iterative review-fix-commit-push loop. See keel playbook 03-ci-cd.md § "Ralph loops" for the full pattern.)

- **Run until ALL flagged items are addressed** — not just 3 clean iters. BLOCKER + SHOULD-FIX + NIT all close before the loop terminates.
- **NITs are merge gates.** Even sub-agent-flagged "observational" or "below-threshold" findings — close them inline. The sub-agent's "count as clean" framing is not authoritative.
- **No pause between iterations.** When iter-N commits, fire iter-N+1 immediately. Don't ask "should I continue?"
- **Don't trust sub-agent local overrides.** Sub-agents invent "scope-discipline" / "follow-up tracker" justifications that contradict standing rules. The orchestrator cross-checks against this CLAUDE.md, never the sub-agent's framing.
- **Collision check before `/loop /ralph` on a shared worktree.** Run `ps aux | grep claude` + `git status` to detect concurrent sessions. Committing on a dirty worktree scrambles both sessions' atomic boundaries.
- **3-clean exit rule:** the loop terminates when `clean_reviews_in_row >= 3`. Each iter writes its state to `.planning/ralph-loop/<target>/state.md` so a fresh-context resume picks up cleanly.

---

## 3. PR requirements

### Ready-checklist before `gh pr create`

Write this inline checklist as a free-text reflection BEFORE every `gh pr create` (or `gh pr edit`). The procedural wrapper makes the associative rules fire at the gate:

1. **Skills:** Did any keel skills get touched? (Update `~/.claude/skills/` if so.)
2. **Arch docs:** Did this PR change behavior covered by `docs/architecture/*.md`? Update the matching doc in the same PR — don't defer.
3. **Screenshots:** Does this PR introduce or change a UI surface? Attach screenshots (see § Screenshots below) before opening.
4. **Mergeability:** Is `gh pr view <N> --json mergeable` `MERGEABLE`? Is the PR branch ahead of `main` only by intended commits?

### Screenshots for every UI change

- **Mandatory:** every newly-introduced or changed UI surface gets a visually-verified screenshot in the PR before reporting it ready.
- **Real-app screenshots, not DOM replicas.** Spin up your emulator stack + seed your own admin/non-admin/edge-case data; don't rely on existing staging data being shaped right.
- **Push screenshots to a sibling repo** (e.g., `<org>/<APP>-screenshots`), NOT to orphan branches in the main repo. Reference them via `https://github.com/<org>/<APP>-screenshots/raw/main/pr-<N>/...` URLs. Session auth handles the auth; `raw.githubusercontent.com` does NOT for private repos.

### Fix nits in the same PR

- Identified nits — especially root-cause fixes — land in the same PR, not a follow-up. The cost of one more iteration is much lower than the cost of a follow-up PR + review cycle.
- "Sub-agent flagged this but framed it as low-priority" is NOT a deferral signal. Apply the standing rule, not the sub-agent's framing.

### Never `--no-verify` from agents

- **Sub-agents must NEVER use `git commit --no-verify` or `git push --no-verify`.** If a hook fails, fix the underlying issue; never bypass.
- Even for the human user, `--no-verify` is reserved for genuine WIP commits on private branches — not PR branches, not `main`.

---

## 4. Testing cadence

(See keel playbook 06-testing-cadence.md for the full 3-tier model.)

- **3-tier test model:**
  - **Tier 1** — mock unit tests (vitest, fast, no external deps)
  - **Tier 2** — emulator integration tests (`firebase emulators:exec`, ~30s, covers wire shape)
  - **Tier 3** — staging system tests (real Firebase project, opt-in via `STAGING_TEST_PROJECT_ID`)
- **E2E uses Firebase emulators + Playwright,** not Chrome profile sharing against staging.
- **All quality gates are local-first** — pre-push hook, `npm run check:coverage`, ratchet vitest. GHA acts only as a backup catcher. Pass locally → pass on CI.
- **Always run the full local test suite at the end of a phase.** Don't trust "GHA will catch it." If GHA is offline (free-tier quota or otherwise), pre-push is the only safety gate.
- **Kill leftover Firebase emulators before `bash scripts/ci-local.sh`.** Ports 8080 / 9099 / 5001 / 4400 / 4500 must be free or STEP 4 fails: `lsof -ti:8080,9099,5001,4400,4500 | xargs kill -9`.
- **No GHA retry cascades.** Hard 2-attempt cap on retriggering a failing GHA workflow. Free-tier minutes are precious; investigate locally instead.

---

## 5. Code quality

### Token discipline

- **Snap literals onto the closest existing token** by default.
- **Never add new tokens to `shared/tokens/tokens.json` without explicit user approval.** Token bloat is hard to undo; an explicit approval gate keeps the design system from drifting.
- **Multi-platform codegen emits values each platform can natively consume** — CSS variables for web, hex/`Color` for Swift, etc. — from the same source.
- **UI data (icons, colors, labels) comes from shared config**, not hardcoded per platform.

### Component reuse

- **Reuse existing L3 atoms/elements.** Don't duplicate styling patterns or icon mappings.
- **Parameterize** via `style` / `variant` / `size` props or extract `View` modifier extensions. Don't fork.
- **UI addition is not redesign.** When the user asks to ADD content to an existing surface, preserve existing height / spacing / chrome. Never invent separators or padding bumps without explicit approval.

### Validation

- **Always validate on both client and server.** Never call server-side validation "redundant."
- Server validation is the security boundary; client validation is the UX boundary. Both exist for distinct reasons.

---

## 6. Doc hygiene

- **Only update planning MDs when codebase files were edited in the same session.** Drift between docs and code is silent rot; only ship doc updates that map to a real code change.
- **Update README** when phases complete or features ship — part of the GSD workflow.
- **Arch doc drift is a same-PR fix.** When this PR changes behavior covered by `docs/architecture/<name>.md`, update the doc in the same PR. Don't defer.
- **Auto-write handoff at natural stopping boundaries.** Multi-phase work in flight + context tight + user pausing → write `.planning/HANDOFF-<date>-<topic>.md` and commit it. Don't wait to be asked.
- **Mermaid gotchas** (GitHub renderer): breaks on `|` in node labels, `<word>` placeholders (interpreted as HTML), and `&&`. Fix at write-time.
- **Placeholder convention:** never use personal info as placeholders. Use the Addams Family (family name) and Alice/Bob/Carol for individuals.
- **Ask if skills or architecture docs need updates** before a PR ships. This is a procedural prompt, not optional.

---

## 7. Safety & operations

- **No defer when user away.** During autonomous operation (Ralph, agents, background work), close ALL flagged items inline. Never silently defer with "rationale" — the user can't approve deferrals they aren't in the loop for.
- **No shortcuts without permission.** Default to thorough. Don't pick shallow / fast / cheap unsolicited. Cost-saving rationalization (cache, quota, "nothing changed") is NOT permission.
- **Deploy to staging before prod** when staging is behind. The soak interval is your responsibility to set per project (24h is a common default).
- **Never change Cloud Functions service account via `gcloud run`.** Always use `firebase deploy`. The `gcloud` path leaves Firestore/Hosting in an inconsistent state.
- **Salvage protocol:** before opening a salvage PR from an orphan worktree/branch, diff against `main` first. Features may already be landed.
- **No task title edits** — never rename a task via `TaskUpdate` after creation. Tasks are identity-bearing in the UI.

---

## 8. Agent boundaries

- **Sub-agents must NEVER use `git commit --no-verify`.** No exceptions.
- **Don't trust sub-agent framing.** Sub-agents invent local "scope-discipline" / "follow-up tracker" / "below-threshold" justifications that contradict standing rules. Cross-check against this CLAUDE.md, never the sub-agent's narrative.
- **For UI/frontend changes,** start the dev server and use the feature in a browser before reporting the task complete. Type-checking + test suites verify code correctness, not feature correctness. If you can't test the UI, say so explicitly rather than claiming success.
- **Match action scope to what was actually requested.** A user approving an action once does NOT mean approval in all contexts. Confirmation stands for the specific scope, not beyond.

---

## 9. Project-specific commands (FILL IN)

> **Customize this section when the first dev / build / test commands exist for this project. The patterns below mirror keel's reference projects.**

**Frontend (root)**
```bash
npm run dev       # Vite dev server
npm run build     # TypeScript compile + Vite bundle
npm run lint      # ESLint
npm run preview   # Preview production build
```

**Cloud Functions (`functions/`)** *(when CF surface exists)*
```bash
npm run build     # TypeScript compile
npm test          # Vitest unit tests
```

**Firebase**
```bash
firebase emulators:start  # Local auth + Firestore + Functions emulators
```

**Coverage gate (before pushing)**
```bash
npm run check:coverage
```

**Local CI mirror (before merging)**
```bash
npm run ci:local
```

---

## 10. Architecture documentation

Architecture references live in [`docs/architecture/`](docs/architecture/) — start at [`docs/architecture/README.md`](docs/architecture/README.md). Each doc is grounded in actual current code, structured around mermaid diagrams, ranges 300–600 lines, and carries a "Last updated" footer linking to the phase / PR that shipped the current state.

**Keep arch docs in sync.** When a phase or PR changes how a documented system actually works (new field, new flow, new enforcement, new ratchet, retired primitive), update the matching `docs/architecture/<name>.md` in the same PR — don't defer.

A `PostToolUse` hook at `.claude/hooks/architecture-doc-drift.sh` (when wired in `.claude/settings.json`) flags edits to files cited by an architecture doc — heed the reminder rather than dismissing it.

---

## 11. Ratchet inventory (FILL IN as ratchets are added)

> **Pre-commit + CI run a set of strict-zero ratchet tests. The list below is verbatim from `.githooks/pre-commit`. Update this section whenever a ratchet is added or retired.**

```bash
npx vitest run --no-coverage \
  # src/__tests__/no-inline-style.test.ts \
  # src/__tests__/no-undefined-tokens.test.ts \
  # ...
```

See keel playbook 07-ratchet-framework.md for the canonical ratchet shape + the `@camelburrito/ratchet-kit` graduated set (currently 23 ratchets covering design system, codegen output, deploy-shape drift, E2E selector orphans, paths-filter shallow-clone traps, structural assertions).

---

## 12. Pre-commit + pre-push hooks

- **`pre-commit`** runs the ratchet test list + `tokens:check` + `tsc --noEmit` for every workspace. Hook script at `.githooks/pre-commit`. Wired by `npm install`'s postinstall (`git config core.hooksPath .githooks`).
- **`pre-push`** runs the full local CI mirror (`scripts/ci-local.sh`) — mirrors the GHA workflow. Path-filtered: pushes that don't touch `apple/` / `packages/` / Swift files skip the iOS xcodebuild leg.
- **Bypass discipline:**
  - Sub-agents NEVER bypass.
  - Human-user `--no-verify` reserved for genuine WIP on private branches. NOT for PR branches. NOT for `main`.

---

## 13. References

- **Keel playbook:** https://github.com/camelburrito/keel/tree/main/docs/playbook
- **Keel recipes:** https://github.com/camelburrito/keel/tree/main/recipes
- **Keel checklists:** https://github.com/camelburrito/keel/tree/main/checklists

When ratchet-kit / cf-utils update to a new version with bug fixes or new ratchets:
```bash
npm install @camelburrito/ratchet-kit@latest @camelburrito/cf-utils@latest
```
Check the release notes at https://github.com/camelburrito/keel/releases for new ratchet wiring instructions.

---

Last updated: 2026-06-06 (bootstrapped from keel templates v0.7 — initial workflow rule set). Maintain this footer as the project evolves; the date + reason serve as a forensic anchor when reviewing how the project's conventions diverged from the keel baseline.
