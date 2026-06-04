# 06 — Testing Cadence

**Status:** 🟡 outlined
**Reference impl:** `chorz/docs/architecture/testing.md`, `chorz/functions/src/__tests__-integration/helpers/seedPermutations.ts`, `chorz/e2e/`, `chorz/shared/test-fixtures/`

## Why this exists

Tests at the wrong layer give false confidence. A 4-tier model — mock unit / emulator integration / staging system / e2e — gives you fast feedback locally and real-world confidence before deploy. Two structural mandates close the gap that lets defects ship despite high test counts: **permutation seed extension** (every new state shape extends the seed grid) and **cross-page E2E coverage** (every new user-facing feature spec-covers all rendering surfaces).

## What you must satisfy — the 4-tier cadence

1. **Tier 1: mock unit** — `vitest run`, no I/O, runs in pre-commit. Fast (~10s).
2. **Tier 2: emulator integration** — `firebase emulators:exec` + `vitest`. Hits real Firestore/Auth/Functions emulators. Runs in pre-push + CI.
3. **Tier 3: staging system** — opt-in via `STAGING_TEST_PROJECT_ID`. Hits real Firebase staging. Gates the deploy:prod script. Subclasses `StagingTestCase` for cleanup.
4. **Tier 4: e2e** — Playwright against emulator-seeded UI. Cross-page specs under `e2e/cross-page/` cover globally-mounted components on every page they appear.

## What you must satisfy — the two mandates

**Mandate 1 — Permutation seed extension.** Every new feature/state that affects data shape (new field, new status, new recurrence variant) MUST extend `functions/src/__tests__-integration/helpers/seedPermutations.ts` AND update `docs/architecture/testing.md § "Permutation cell count"` in the same commit. Drift enforced by `permutation-seed-count-locked.test.ts`.

**Mandate 2 — Cross-page E2E coverage.** Every new user-facing feature on a rendering surface MUST land at least one Playwright spec under `e2e/cross-page/` that exercises the flow on EACH applicable page. Where an affordance is intentionally absent, the spec asserts ABSENCE (positive test), not skip.

**Mandate 3 — Pre-release gate is non-negotiable.** `deploy:staging` and `deploy:prod` are structurally gated by `npm run test:pre-release` (Tier 3 wall). No `--skip-tests` flag.

## Sections (TODO when drafted)

1. The 4-tier model with examples per tier
2. The cross-platform contract-fixture pattern (one fixture, two runners — TS + Swift/Kotlin)
3. Permutation seed extension recipe
4. Cross-page E2E pattern + the orphan-selector ratchet (`no-stale-e2e-selectors`)
5. The pre-release wall + the `deploy-scripts-gated-by-pre-release` ratchet
6. CF contract-fixture mandate + the `no-cf-without-contract-fixture` ratchet
7. Coverage floors per workspace + the `check:coverage` chained-buckets pattern

## Reference reading

- `chorz/docs/architecture/testing.md` — full architecture doc with 4-tier model + ratchet enumeration
- `chorz/functions/src/__tests__-integration/helpers/seedPermutations.ts` — permutation grid generator
- `chorz/e2e/cross-page/` — exemplar cross-page specs
- `chorz/shared/test-fixtures/cf/` — CF contract fixtures (one folder per CF, `{request,expected}.json` per scenario)
- `chorz/packages/ChorzCore/Tests/ChorzCoreTests/CFContractTests.swift` — Swift contract runner consuming the same fixtures
- `chorz/.claude/skills/cross-platform-contract-test/` — the skill that documents the pattern
