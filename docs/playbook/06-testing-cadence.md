# 06 — Testing Cadence

**Status:** 🟡 outlined
**Reference impl:** `chorz/docs/architecture/testing.md`, `chorz/functions/src/__tests__-integration/helpers/seedPermutations.ts`, `chorz/e2e/`, `chorz/shared/test-fixtures/`, `chorz/apple/scripts/check-coverage-floors.sh`, `chorz/docs/coverage-exclusions.md`

## Why this exists

Tests at the wrong layer give false confidence. A multi-tier model gives you fast feedback locally and real-world confidence before deploy. Two structural mandates close the gap that lets defects ship despite high test counts: **permutation seed extension** (every new state shape extends the seed grid) and **cross-page E2E coverage** (every new user-facing feature spec-covers all rendering surfaces). A third mandate locks deploys behind the Tier 3 wall.

## The full testing surface

| # | Layer | Tool | When | Cost |
|---|-------|------|------|------|
| 1 | **Mock unit** | vitest (no I/O) | pre-commit | ~10s |
| 2a | **Web wire-symmetry emulator suite** | vitest + Firebase emulators (Auth + Firestore + Functions) via `vi.mock` redirection to production wrappers | pre-push + CI | ~30s |
| 2b | **CF emulator integration** | `firebase emulators:exec` + vitest, per CF codebase | pre-push + CI | 30–90s per codebase |
| 2c | **iOS host-bundle suite** | xcodebuild + `ChorzCoreHostTests` against running emulators | optional pre-push (path-filtered) + `npm run test:ios` | 2–5 min |
| 3 | **Staging system** | opt-in via `STAGING_TEST_PROJECT_ID`; subclass `StagingTestCase` for cleanup | Tier 3 wall (gates `deploy:prod`) | 3–10 min |
| 4 | **E2E** | Playwright against emulator-seeded UI | pre-push (`scripts/ci-local.sh`) + CI + before merge | 3–8 min |
| — | **Snapshot tests** | iOS `swift-snapshot-testing`; web RTL snapshots | Tier 1 (run with mock units) | folded into Tier 1 cost |
| — | **Cross-platform contract tests** | Shared JSON fixtures + TS + Swift runners | Tier 1 + iOS host-bundle | folded |
| — | **Helpers tests** | vitest, not in pre-commit ratchet list | regular vitest discovery + pre-push | seconds |
| — | **Screenshot-harness mode** | Playwright `e2e/screenshot-harness/` writing PNGs to sibling repo | on-demand for PR review | 1–3 min |

## What you must satisfy — Mandate 1 (permutation seed extension)

Every new feature/state that affects data shape (new field, new status, new recurrence variant) MUST extend `functions/src/__tests__-integration/helpers/seedPermutations.ts` AND update `docs/architecture/testing.md § "Permutation cell count"` in the same commit. Drift enforced by `permutation-seed-count-locked.test.ts`.

The seed generator emits a flat array of canonical fixtures spanning every meaningful (state × actor × recurrence × scheduling × locale × …) cell. Tier 2 integration tests seed the whole grid into the emulator once, then exercise queries against it. Adding a state without a cell hides regressions in that combination.

## What you must satisfy — Mandate 2 (cross-page E2E coverage)

Every new user-facing feature on a rendering surface MUST land at least one Playwright spec under `e2e/cross-page/` that exercises the flow on EACH applicable page (e.g., `/dashboard`, `/my-tasks`, `/calendar`, `/<user-profile>`). Where an affordance is intentionally absent on a variant, the spec asserts ABSENCE (positive test), not skip.

Two ratchets defend the cross-page surface:
- `global-features-have-cross-page-spec` — every PascalCase symbol imported into `AppLayout.tsx` (i.e., globally mounted) must appear in at least one `e2e/cross-page/*.spec.ts`.
- `no-stale-e2e-selectors` — every `data-testid` literal referenced in `e2e/**/*.spec.ts` must exist in production source.

## What you must satisfy — Mandate 3 (pre-release gate is non-negotiable)

`deploy:staging` and `deploy:prod` are structurally gated by `npm run test:pre-release` (Tier 3 wall). Defended by `deploy-scripts-gated-by-pre-release` ratchet. **No `--skip-tests` flag.** A failing test means fix the test before deploying, not bypass the gate.

## Sub-pattern: cross-platform contract fixtures

For any logic that MUST produce identical output across platforms (CF wire shape, presentation projectors, hash algorithms, state machines):

- One JSON fixture per scenario at `shared/test-fixtures/<system>/<scenario>/{input,expected}.json` (or `{request,expected}.json` for CFs).
- A TS runner asserts byte-equality after generated-field normalization.
- A Swift (or Kotlin) runner decodes the same `expected.json` into the matching Codable and asserts equality.
- Drift on either side fails the corresponding suite.

Two ratchets defend this:
- `no-cf-without-contract-fixture` — every onCall CF has at least one fixture pair (or appears in a documented deferral list).
- `cf-contract.test.ts` (TS) + `CFContractTests.swift` — fixture replay assertions.

## Sub-pattern: web wire-symmetry suite

Tests under `src/lib/firebase/__tests__-emulator/` use `vi.mock` to redirect the **production `callables.ts` wrappers** (e.g., `callMyCf()`) to emulator-bound `httpsCallable` instances. NOT a parallel factory — you test the exact production code path, with only the transport endpoint swapped. Counterpart to the iOS host-bundle suite. Excluded from default `npm test` discovery so it doesn't slow Tier 1.

## Sub-pattern: iOS host-bundle pattern

The Firebase SDK initializers and Keychain integrations require a real host app. Live `Live*` SDK wrappers (e.g., `LiveAuthService`, `LiveFirestoreReader`, `LiveCallableClient`) are extracted into their own files and excluded from coverage via `apple/scripts/excluded-files.json` with `[SDK boundary]` rationale. The actual logic against those protocols is tested in `ChorzCoreHostTests/` against running emulators.

## Sub-pattern: per-target iOS coverage floors

`apple/scripts/check-coverage-floors.sh` enforces per-target line-coverage floors, but only when the primary contributing schemes ALL ran. Each target carries a `*_MIN` (e.g., `CHORZ_APP_MIN`, `CHORZ_UI_MIN`, `CHORZ_CORE_MIN`, `CHORZ_TV_MIN`) and a primary-schemes map. Partial runs SKIP the floor for the missing-scheme target with a clear `SKIP: <target> floor — requires schemes [...], ran [...]` log line. Full sweeps via `npm run test:ios` enforce all floors.

## Sub-pattern: coverage exclusions ledger

Files genuinely outside the testable surface (SDK initializers, code-generated outputs, `#Preview { ... }` blocks, `_pb.swift` protobuf, host-bundle entry points) are subtracted from coverage numerator+denominator via per-target `excluded-files.json`. Every exclusion is enumerated in `docs/coverage-exclusions.md` with a one-line rationale. New exclusions need a rationale entry in the same commit.

## Sub-pattern: chained-buckets coverage gate

`npm run check:coverage` runs vitest with `--coverage` chained across all workspaces sequentially:
```
./node_modules/.bin/vitest run --coverage \
  && (cd shared-cf-utils && ./node_modules/.bin/vitest run --coverage) \
  && (cd functions && ./node_modules/.bin/vitest run --coverage) \
  && (cd functions-<external> && ./node_modules/.bin/vitest run --coverage)
```
Each workspace holds its own 100% threshold (or the appropriate per-workspace floor). Drift between this script and the CI workflow's coverage jobs is locked by `ci-local-mirrors-workflow.test.ts`.

**CRITICAL:** Always use `npm run check:coverage`, NOT `npx vitest --coverage`. The latter can be exit-code-masked by tooling that rewrites `npx` invocations (see chorz's RTK note). `check:coverage` invokes vitest via the direct binary path `./node_modules/.bin/vitest` to preserve the real exit code.

## Sub-pattern: screenshot-harness mode

A separate Playwright spec set under `e2e/screenshot-harness/` runs against emulators with seed data, navigates to harness routes, captures PNGs, and pushes them to the sibling private repo (`<org>/<app>-screenshots/pr-<NNN>/`). Used on demand for PR review. NOT in pre-push (would slow every push for visual-proof generation). See [10-screenshot-workflow.md](10-screenshot-workflow.md).

## Sub-pattern: helpers tests

Ratchet regex helpers (e.g., `stripTsLineAndBlockComments`) get their own test files (e.g., `no-bare-error-text-in-features.helpers.test.ts`). These ARE NOT in the pre-commit ratchet list but ARE picked up by regular vitest discovery and `scripts/ci-local.sh` STEP 2. They lock the regex shape against silent refactor breakage.

## Sections (TODO when drafted)

1. The full testing surface with cost calibration per tier
2. Tier 1 in depth — mock unit, snapshot, contract test, helpers
3. Tier 2 split — web wire-symmetry vs CF emulator integration vs iOS host-bundle
4. Tier 3 staging discipline (`StagingTestCase` subclass + opt-in env var + cleanup)
5. Tier 4 E2E — cross-page specs + screenshot-harness mode + per-phase bundles
6. The three mandates with examples
7. Cross-platform contract-fixture pattern in depth
8. iOS per-target coverage floors + partial-mode SKIP semantics
9. Coverage exclusions ledger discipline
10. Chained-buckets gate + the canonical `check:coverage` invocation

## Reference reading

- `chorz/docs/architecture/testing.md` — full architecture doc with 4-tier model + ratchet enumeration + permutation cell count
- `chorz/functions/src/__tests__-integration/helpers/seedPermutations.ts` — permutation grid generator
- `chorz/src/lib/firebase/__tests__-emulator/` — web wire-symmetry suite
- `chorz/functions/src/__tests__-integration/*.integration.test.ts` — CF Tier 2 integration suites
- `chorz/functions-calendar/src/__tests__-integration/*.integration.test.ts` — second-codebase Tier 2 suites
- `chorz/apple/Chorz/ChorzCoreHostTests/` — iOS host-bundle suite
- `chorz/apple/scripts/check-coverage-floors.sh` — per-target floor enforcement
- `chorz/docs/coverage-exclusions.md` — exclusion ledger
- `chorz/e2e/cross-page/` — cross-page coverage specs (Mandate 2)
- `chorz/e2e/screenshot-harness/` — visual-proof capture mode
- `chorz/shared/test-fixtures/cf/` — CF contract fixtures
- `chorz/packages/ChorzCore/Tests/ChorzCoreTests/CFContractTests.swift` — Swift contract runner
- `chorz/src/__tests__/no-stale-e2e-selectors.test.ts` + `global-features-have-cross-page-spec.test.ts` — Mandate 2 defenders
- `chorz/src/__tests__/permutation-seed-count-locked.test.ts` — Mandate 1 defender
- `chorz/src/__tests__/deploy-scripts-gated-by-pre-release.test.ts` — Mandate 3 defender
- `chorz/.claude/skills/cross-platform-contract-test/` — the skill that documents the cross-platform pattern
