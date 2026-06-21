# 03 — CI/CD Philosophy

**Status:** 🟢 drafted

---

## The principle

**Local-first gates.** Every CI check has a local equivalent that runs in the same order, with the same exit semantics. The local script is the source of truth; CI inherits it. Three properties earn this discipline its keep:

1. **Pre-push runs `scripts/ci-local.sh` — pass locally ≈ pass on CI.** No surprises after pushing.
2. **CI never grows a check that's invisible locally.** Drift is caught by a ratchet (`ci-local-mirrors-workflow.test.ts`) that fails fast when CI gets a step the local script doesn't mirror.
3. **When CI dies, local gates still work.** A hosted CI provider's free-tier quota cliff is a recurring event for any busy project. A `scripts/post-local-ci-status.cjs` posts green statuses directly via the provider's Status API so the PR doesn't look red for purely infrastructural reasons.

The corollary: **never use `git push --no-verify` while CI is offline.** Pre-push is the only safety gate during quota-cliff windows. Lock this with an operational rule.

---

## What you must satisfy

- `scripts/ci-local.sh` — parametrized via `STEPS=(...)` at top of file; orders steps the same as `.github/workflows/test-coverage.yml`. Accepts `--skip-native` flag for non-native pushes.
- `.githooks/pre-commit` — ratchet suite + `tokens:check` + `strings:check` + `tsc --noEmit` (per workspace).
- `.githooks/pre-push` — full `ci-local.sh` mirror; path-filtered for expensive native (iOS/Android) builds.
- `npm install` postinstall sets `git config core.hooksPath .githooks` so a fresh clone gets hooks automatically. No husky / lint-staged dependency.
- A drift-gate ratchet (`ci-local-mirrors-workflow.test.ts`) parses both files and fails on step-name mismatch.
- `npm run check:coverage` invokes vitest via the **direct binary path** `./node_modules/.bin/vitest`, NOT `npx vitest --coverage`. The latter can be exit-code-masked by tooling that rewrites `npx` invocations (some shell-proxy tools silently swallow the non-zero exit on a threshold-violation run). The direct binary path preserves the real exit code.

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

The path-filter on pre-push native mirrors the CI workflow's `paths-filter` job exactly. Same regex, same intent. Non-native pushes pay 0 cost for iOS work; native pushes pay it once locally instead of waiting for CI.

---

## 4. Coverage gates

`npm run check:coverage` — the canonical pre-PR coverage command. Chains vitest across all workspaces sequentially:

```
./node_modules/.bin/vitest run --coverage \
  && (cd packages/cf-utils && ./node_modules/.bin/vitest run --coverage) \
  && (cd functions && ./node_modules/.bin/vitest run --coverage) \
  && (cd functions-<extra-codebase> && ./node_modules/.bin/vitest run --coverage)
```

Each workspace holds its own floor (a strict project can run 100% on each CF workspace; tune per project). Drift between local script and CI workflow's coverage jobs is locked by `ci-local-mirrors-workflow.test.ts`.

**iOS per-target floors** are enforced by `apple/scripts/check-coverage-floors.sh` (template at `templates/scripts/check-coverage-floors.sh`) with partial-mode SKIP semantics — see [06-testing-cadence.md § "Sub-pattern: per-target iOS coverage floors"](06-testing-cadence.md).

---

## 5. CI-quota-cliff fallback

Hosted CI providers cap free-tier build minutes (a common cap is ~2000 minutes/month). A busy project blows past it. When it does, every workflow run dies in a few seconds with empty runner metadata and a "the job was not started because recent account payments have failed" message in the logs — the failure mode is distinctive (empty `runner_name`, 4–7s job duration) so you can recognize it on sight.

Two layers of defense:

1. **`scripts/post-local-ci-status.cjs`** — best-effort script invoked by pre-push after successful `ci-local.sh`. Posts per-step green statuses to the PR via the provider's Status API. Bypasses the red-checks PR noise (Coverage / Functions Integration / Local Test State Preflight / Paths Filter) that purely infrastructural quota-cliff failures produce.
2. **Operator discipline** — don't bypass pre-push with `--no-verify` to "ship around" the quota cliff. Lock this with an operational rule. Fix the underlying test if pre-push fails.

When quota recovers (~30-day reset), the workflows re-enable themselves automatically; nothing to clean up.

---

## 6. The `paths-filter` shallow-clone trap

A typical changed-files filter action (e.g. `dorny/paths-filter`) diffs `<before>..<head>` to detect changed files. If the checkout step uses its default `fetch-depth: 1`, the `before` SHA is unreachable and the filter silently falls back to "no changes" — every job is skipped, the workflow reports "success", and **nothing ships**.

This is a real failure mode: a project's release-cut once silently no-op'd because a large multi-commit jump from a shallow clone made the base SHA unreachable, so the paths-filter saw zero changes and skipped every deploy job while reporting success.

Two defenses:

1. **Checkout with `fetch-depth: 0`** on every job that uses a paths-filter action. Defended by the strict-zero ratchet `no-paths-filter-without-fetch-depth-zero`, which fails any workflow whose paths-filter job lacks a full-history checkout.
2. **`workflow_dispatch:` + `always_deploy: true`** on the prod workflow for cumulative-state release cuts (see [11-staging-prod-environments.md](11-staging-prod-environments.md)).

---

## 7. The drift gate

`ci-local-mirrors-workflow.test.ts` — parses `scripts/ci-local.sh`'s `STEPS=(...)` array AND `.github/workflows/test-coverage.yml`'s job/step names, then asserts every local step has a CI mirror with matching name. Fails fast when CI grows a step the local script doesn't have (or vice versa).

This is the load-bearing invariant — without it, "local mirrors CI" decays over months as one side or the other accumulates steps.

---

## 8. The pre-release wall

`deploy:staging` and `deploy:prod` are structurally gated by `npm run test:pre-release`. The script chains all four tiers (mock unit + emulator integration + staging system + e2e). Locked by the ratchet `deploy-scripts-gated-by-pre-release` (no `--skip-tests` flag).

A failing test means fix the test before deploying. Mandate 3 of the testing-cadence playbook. See [06-testing-cadence.md § Mandate 3](06-testing-cadence.md) and [11-staging-prod-environments.md](11-staging-prod-environments.md).

---

## 9. Adopting this playbook

- [ ] `scripts/ci-local.sh` skeleton in place (mirrors every CI step locally).
- [ ] `.githooks/pre-commit` + `pre-push` from templates; `postinstall` script wires `core.hooksPath`.
- [ ] `ci-local-mirrors-workflow.test.ts` ratchet wired in pre-commit list.
- [ ] `npm run check:coverage` defined in `package.json` with direct-binary-path invocation.
- [ ] `.github/workflows/test-coverage.yml` mirrors the local script step-for-step.
- [ ] `paths-filter` callers use a full-history checkout (`fetch-depth: 0`).
- [ ] `scripts/post-local-ci-status.cjs` wired into pre-push for quota-cliff days.
- [ ] An operational rule forbidding `--no-verify` pushes while CI is offline is in place.

---

**Last updated:** 2026-06-21
