# 03 — CI/CD Philosophy

**Status:** 🟢 drafted
**Reference impl:** `chorz/scripts/ci-local.sh`, `chorz/.githooks/`, `chorz/.github/workflows/test-coverage.yml`, `chorz/src/__tests__/ci-local-mirrors-workflow.test.ts`

---

## The principle

**Local-first gates.** Every CI check has a local equivalent that runs in the same order, with the same exit semantics. The local script is the source of truth; CI inherits it. Three properties earn this discipline its keep:

1. **Pre-push runs `scripts/ci-local.sh` — pass locally ≈ pass on CI.** No surprises after pushing.
2. **CI never grows a check that's invisible locally.** Drift is caught by a ratchet (`ci-local-mirrors-workflow.test.ts`) that fails fast when CI gets a step the local script doesn't mirror.
3. **When CI dies, local gates still work.** GHA's free-tier quota cliff is a recurring event (chorz hit it 3+ times in one quarter; the user-memory rule `project_gha_disabled` documents it). A `scripts/post-local-ci-status.cjs` posts green statuses directly via the GitHub Status API so the PR doesn't look red for purely infrastructural reasons.

The corollary: **never use `git push --no-verify` while GHA is offline.** Pre-push is the only safety gate during quota-cliff windows. The CLAUDE.md operational rule and user-memory rule `feedback_no_verify_during_gha_outage` both lock this.

---

## What you must satisfy

- `scripts/ci-local.sh` — parametrized via `STEPS=(...)` at top of file; orders steps the same as `.github/workflows/test-coverage.yml`. Accepts `--skip-native` flag for non-native pushes.
- `.githooks/pre-commit` — ratchet suite + `tokens:check` + `strings:check` + `tsc --noEmit` (per workspace).
- `.githooks/pre-push` — full `ci-local.sh` mirror; path-filtered for expensive native (iOS/Android) builds.
- `npm install` postinstall sets `git config core.hooksPath .githooks` so a fresh clone gets hooks automatically. No husky / lint-staged dependency.
- A drift-gate ratchet (`ci-local-mirrors-workflow.test.ts`) parses both files and fails on step-name mismatch.
- `npm run check:coverage` invokes vitest via the **direct binary path** `./node_modules/.bin/vitest`, NOT `npx vitest --coverage`. The latter can be exit-code-masked by tooling that rewrites `npx` invocations (chorz hit this with RTK). The direct binary path preserves the real exit code.

---

## 2. `scripts/ci-local.sh` shape

```bash
STEPS=(
  "STEP 1: Design System Ratchets"      # ratchets + tokens:check + strings:check + tsc x N workspaces
  "STEP 1.5: ESLint (CF workspaces)"    # paired with no-console-in-source ratchet
  "STEP 2: Frontend Coverage"            # vitest --coverage on root
  "STEP 3: CF Coverage (chained buckets)" # per-workspace 100% floors
  "STEP 3.5: Deploy-Shape Verification"   # verify-deploy-shape.sh
  "STEP 4: Functions Integration (emulator)"
  "STEP 4.5: Functions Integration (second codebase, if any)"
  "STEP 5: Native Coverage (iOS / Android, path-filtered)"
  "STEP 6: Summary"
)
```

Each step is a self-contained block in the script body. Adding a step:
1. Append to `STEPS=(...)`.
2. Add the step body lower in the script.
3. Add the matching CI job in `.github/workflows/test-coverage.yml`.
4. The drift-gate ratchet (`ci-local-mirrors-workflow.test.ts`) confirms both lists carry the new step name.

---

## 3. Pre-commit vs. pre-push split (cost calibration)

| Gate | What runs | Cost | Why here |
|------|-----------|------|----------|
| **Pre-commit** | ratchets + `tokens:check` + `strings:check` + tsc | ~10–20s | Cheap; catches structural drift at write time. Skipped during merge/rebase/cherry-pick. |
| **Pre-push (non-native)** | full `ci-local.sh --skip-native` | ~75–90s | Web + CF coverage + emulator integration. Catches behavioral regressions before PR. |
| **Pre-push (native-touching)** | full `ci-local.sh` | ~5–8 min on Mac | Adds iOS xcodebuild + per-target floors. Path-filtered, so only native-touching pushes pay. |
| **CI** | mirrors local script step-for-step | varies | Backup catcher. With local-first discipline, "pass on CI when local already passed" is the expectation, not a hope. |

The path-filter on pre-push native mirrors the GHA workflow's `paths-filter` job exactly. Same regex, same intent. Non-native pushes pay 0 cost for iOS work; native pushes pay it once locally instead of waiting for CI.

---

## 4. Coverage gates

`npm run check:coverage` — the canonical pre-PR coverage command. Chains vitest across all workspaces sequentially:

```
./node_modules/.bin/vitest run --coverage \
  && (cd shared-cf-utils && ./node_modules/.bin/vitest run --coverage) \
  && (cd functions && ./node_modules/.bin/vitest run --coverage) \
  && (cd functions-<extra-codebase> && ./node_modules/.bin/vitest run --coverage)
```

Each workspace holds its own floor (chorz uses 100% on each CF workspace; tune per project). Drift between local script and CI workflow's coverage jobs is locked by `ci-local-mirrors-workflow.test.ts`.

**iOS per-target floors** are enforced by `apple/scripts/check-coverage-floors.sh` (template at `templates/scripts/check-coverage-floors.sh`) with partial-mode SKIP semantics — see [06-testing-cadence.md § "Sub-pattern: per-target iOS coverage floors"](06-testing-cadence.md).

---

## 5. GHA-quota-cliff fallback

GitHub Actions has a 2000-minute/month free-tier cap. A busy project blows past it. When it does, every workflow run dies at 4–7s with empty `runner_name` and "The job was not started because recent account payments have failed" in the logs.

Two layers of defense:

1. **`scripts/post-local-ci-status.cjs`** — best-effort script invoked by pre-push after successful `ci-local.sh`. Posts per-step green statuses to the PR via the GitHub Status API. Bypasses the 4–red-checks PR noise (Coverage / Functions Integration / Local Test State Preflight / Paths Filter) that purely infrastructural quota-cliff failures produce.
2. **Operator discipline** — don't bypass pre-push with `--no-verify` to "ship around" the quota cliff. The CLAUDE.md operational rule and memory rule lock this. Fix the underlying test if pre-push fails.

When quota recovers (~30-day reset), the workflows re-enable themselves automatically; nothing to clean up.

---

## 6. The `paths-filter` shallow-clone trap

`dorny/paths-filter@v3` diffs `github.event.before..github.sha` to detect changed files. If `actions/checkout@v4` uses its default `fetch-depth: 1`, the `event.before` SHA is unreachable and paths-filter silently falls back to "no changes" — every job is skipped, the workflow reports "success", and **nothing ships**.

Two defenses:

1. **`actions/checkout@v4` with `fetch-depth: 0`** on every job that uses `dorny/paths-filter`. Defended by the strict-zero ratchet `no-paths-filter-without-fetch-depth-zero` (chorz quick 260602-fpd lesson — caught at release-cut time when a 93-commit jump silently no-op'd).
2. **`workflow_dispatch:` + `always_deploy: true`** on the prod workflow for cumulative-state release cuts (see [11-staging-prod-environments.md](11-staging-prod-environments.md)).

---

## 7. The drift gate

`src/__tests__/ci-local-mirrors-workflow.test.ts` — parses `scripts/ci-local.sh`'s `STEPS=(...)` array AND `.github/workflows/test-coverage.yml`'s job/step names, then asserts every local step has a CI mirror with matching name. Fails fast when CI grows a step the local script doesn't have (or vice versa).

This is the load-bearing invariant — without it, "local mirrors CI" decays over months as one side or the other accumulates steps.

---

## 8. The pre-release wall

`deploy:staging` and `deploy:prod` are structurally gated by `npm run test:pre-release`. The script chains all four tiers (mock unit + emulator integration + staging system + e2e). Locked by the ratchet `deploy-scripts-gated-by-pre-release` (no `--skip-tests` flag).

A failing test means fix the test before deploying. Mandate 3 of the testing-cadence playbook. See [06-testing-cadence.md § Mandate 3](06-testing-cadence.md) and [11-staging-prod-environments.md](11-staging-prod-environments.md).

---

## 9. Adopting this playbook

- [ ] `scripts/ci-local.sh` skeleton in place (template at `templates/scripts/ci-local.sh`).
- [ ] `.githooks/pre-commit` + `pre-push` from templates; `postinstall` script wires `core.hooksPath`.
- [ ] `ci-local-mirrors-workflow.test.ts` ratchet wired in pre-commit list.
- [ ] `npm run check:coverage` defined in `package.json` with direct-binary-path invocation.
- [ ] `.github/workflows/test-coverage.yml` mirrors the local script step-for-step.
- [ ] `paths-filter` callers use `actions/checkout@v4` with `fetch-depth: 0`.
- [ ] `scripts/post-local-ci-status.cjs` wired into pre-push for quota-cliff days.
- [ ] User-memory rule `feedback_no_verify_during_gha_outage` loaded.

---

## Reference reading

- `chorz/scripts/ci-local.sh` — full local mirror (canonical implementation)
- `chorz/.githooks/pre-commit` + `chorz/.githooks/pre-push` — POSIX bash, readable in-repo
- `chorz/.github/workflows/test-coverage.yml` — CI workflow mirroring the local script
- `chorz/src/__tests__/ci-local-mirrors-workflow.test.ts` — drift gate
- `chorz/scripts/post-local-ci-status.cjs` — GHA-down fallback
- `chorz/src/__tests__/no-paths-filter-without-fetch-depth-zero.test.ts` — shallow-clone trap defender
- `chorz/CLAUDE.md § Operational rules while GHA is offline` — narrative of the recurring quota-cliff incident class
