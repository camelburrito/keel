# 06 — Testing Cadence

**Status:** 🟢 drafted

---

## The principle

Tests at the wrong layer give false confidence. A 4-tier model gives you fast feedback locally and real-world confidence before deploy. Three mandates close the gap that lets defects ship despite high test counts:

1. **Permutation seed extension** — every new state shape extends the seed grid in the same commit.
2. **Cross-page E2E coverage** — every new user-facing feature spec-covers all rendering surfaces, with positive-absence assertions on intentional exclusions.
3. **Pre-release gate** — `deploy:*` scripts are structurally locked behind the Tier 3 wall. No `--skip-tests` flag exists.

The lesson the mandates come from: a batch of defects was fixed and locked by E2E specs on one primary page, yet still surfaced as user-reported breaks because most of the other rendering pages had zero E2E coverage. Tests existed; coverage shape was wrong. The mandates make coverage shape structural.

---

## 1. The full testing surface

| # | Layer | Tool | When | Cost |
|---|-------|------|------|------|
| 1 | **Mock unit** | vitest (no I/O) | pre-commit | ~10s |
| 2a | **Web wire-symmetry emulator suite** | vitest + Firebase emulators via `vi.mock` redirection to production wrappers | pre-push + CI | ~30s |
| 2b | **CF emulator integration** | `firebase emulators:exec` + vitest, per CF codebase | pre-push + CI | 30–90s per codebase |
| 2c | **iOS host-bundle suite** | xcodebuild + a host-test target against running emulators | optional pre-push (path-filtered) + `npm run test:ios` | 2–5 min |
| 3 | **Staging system** | opt-in via `STAGING_TEST_PROJECT_ID`; subclass `StagingTestCase` for cleanup | Tier 3 wall (gates `deploy:prod`) | 3–10 min |
| 4 | **E2E** | Playwright against emulator-seeded UI | pre-push (`scripts/ci-local.sh`) + CI + before merge | 3–8 min |
| — | **Snapshot tests** | iOS `swift-snapshot-testing`; web RTL snapshots | Tier 1 (folded into mock unit run) | folded |
| — | **Cross-platform contract tests** | Shared JSON fixtures + TS + Swift runners | Tier 1 + iOS host-bundle | folded |
| — | **Helpers tests** | vitest; NOT in pre-commit ratchet list but in regular vitest discovery | regular vitest + pre-push | seconds |
| — | **Screenshot-harness mode** | Playwright `e2e/screenshot-harness/` writing PNGs to sibling repo | on-demand for PR review | 1–3 min |

---

## 2. Mandate 1 — permutation seed extension

Every new feature/state that affects data shape (new field, new status, new variant) MUST extend `functions/src/__tests__-integration/helpers/seedPermutations.ts` AND update the corresponding "Permutation cell count" section in your testing architecture doc in the same commit. Drift enforced by `permutation-seed-count-locked.test.ts`.

The seed generator emits a flat array of canonical fixtures spanning every meaningful (state × actor × variant × scheduling × locale × …) cell. Tier 2 integration tests seed the whole grid into the emulator once, then exercise queries against it. Adding a state without a cell hides regressions in that combination.

Keep the `EXPECTED_TOTAL_SEEDED` count narrow on purpose. For example, adding a single new opt-in capability gated on a permission flag might add just two cells (capability-on × permission-granted, capability-on × permission-denied). The narrowness is intentional — each cell is a load-bearing dimension, not a generic data point.

---

## 3. Mandate 2 — cross-page E2E coverage

Every new user-facing feature on a rendering surface MUST land at least one Playwright spec under `e2e/cross-page/` that exercises the flow on EACH applicable page (`/home`, `/list`, `/calendar`, `/<user-profile>`, etc.). Where an affordance is intentionally absent on a variant (e.g., a kebab menu hidden on a compact shell), the spec asserts ABSENCE (positive test), not skip.

Two ratchets defend the surface:
- `global-features-have-cross-page-spec` — every PascalCase symbol imported into `AppLayout.tsx` (i.e., globally mounted) must appear in at least one `e2e/cross-page/*.spec.ts`.
- `no-stale-e2e-selectors` — every `data-testid` literal referenced in any spec must exist in production source (`src/`, `apple/`, `packages/`).

Recipe: [recipes/add-an-e2e-spec.md](../../recipes/add-an-e2e-spec.md).

---

## 4. Mandate 3 — pre-release gate non-negotiable

`deploy:staging` and `deploy:prod` are structurally gated by `npm run test:pre-release` (Tier 3 wall). Defended by `deploy-scripts-gated-by-pre-release` ratchet. **No `--skip-tests` flag.** A failing test means fix the test before deploying, not bypass the gate.

The explicit rejection that informs this: a proposed `--skip-tests` flag was discussed and refused, on the grounds that any escape valve becomes the new default during incidents. Better to fix the test under pressure than to ship around it.

---

## 5. Sub-pattern: cross-platform contract fixtures

For logic that MUST produce identical output across platforms (CF wire shape, presentation projectors, hash algorithms, state machines):

- One JSON fixture per scenario at `shared/test-fixtures/<system>/<scenario>/{input,expected}.json` (or `{request,expected}.json` for CFs).
- A TS runner asserts byte-equality after generated-field normalization (`<generated:id>`, `<generated:timestamp>`, etc.).
- A Swift (or Kotlin) runner decodes the same `expected.json` into the matching Codable and asserts equality.
- Drift on either side fails the corresponding suite.

Two ratchets defend this:
- `no-cf-without-contract-fixture` — every onCall CF has at least one fixture pair (or appears in a documented `EXPECTED_DEFERRED` list with rationale).
- `cf-contract.test.ts` (TS) + `CFContractTests.swift` (Swift) — fixture replay assertions.

The pattern is canonical and lives in the `cross-platform-contract-test` Claude Code skill.

---

## 6. Sub-pattern: web wire-symmetry suite

Tests under `src/lib/firebase/__tests__-emulator/` use `vi.mock` to redirect the **production `callables.ts` wrappers** (e.g., `callMyCf()`) to emulator-bound `httpsCallable` instances. **NOT a parallel factory** — you test the exact production code path, with only the transport endpoint swapped. Counterpart to the iOS host-bundle suite. Excluded from default `npm test` discovery so it doesn't slow Tier 1.

The anti-pattern this avoids: a parallel `httpsCallable` factory used only in tests, which leaves the production wrappers untested. The wire-symmetry pattern catches the bug class where production-only wrapper logic (auth header injection, error normalization, retry policies) silently breaks.

---

## 7. Sub-pattern: iOS host-bundle pattern

The Firebase SDK initializers and Keychain integrations require a real host app — you can't unit-test `Auth.auth().signInAnonymously()` without an iOS app context. Pattern:

- Extract `Live*` SDK wrappers (`LiveAuthService`, `LiveFirestoreReader`, `LiveCallableClient`) into their own files.
- Mark those files `[SDK boundary]` in `apple/scripts/excluded-files.json` (subtracted from coverage numerator + denominator).
- Test the protocol-shaped logic against `Mock*` implementations in regular unit tests.
- Test the actual `Live*` integrations in a dedicated host-test target against running emulators (host-bundle suite).

The pattern was established with the original `Live*`/`Mock*` split and later extended to additional app targets (e.g., a tvOS target) with the same architectural shape — protocol declarations + `Mock*` contract tests stay in the testable surface; only the SDK-touching `Live*` impls are subtracted. See your test-layers architecture doc for the canonical write-up.

---

## 8. Sub-pattern: per-target iOS coverage floors

`apple/scripts/check-coverage-floors.sh` enforces per-target line-coverage floors (e.g., `APP_MIN=62`, `UI_MIN=97`, `CORE_MIN=93`, `TV_MIN=94`), but only when the primary contributing schemes ALL ran. Each target carries a `*_MIN` env var + a primary-schemes map.

Partial runs SKIP the floor for the missing-scheme target with a clear `SKIP: <target> floor — requires schemes [...], ran [...]` log line. Full sweeps via `npm run test:ios` enforce all floors.

The split matters: pre-push path-filters skip schemes whose directories didn't change, so most pushes don't run the full sweep. The floor enforcement adapts — SKIP is honest, not silent. `npm run test:ios` is the only invocation that enforces every floor — so make it a standing rule to run the full sweep before merging any change to a core-module implementation, since pre-push only partially enforces the core-module floor.

Templates at `templates/scripts/check-coverage-floors.sh` + `templates/scripts/merge-coverage.py`.

---

## 9. Sub-pattern: coverage exclusions ledger

Files genuinely outside the testable surface (SDK initializers, code-generated outputs, `#Preview { ... }` SwiftUI canvas blocks, `_pb.swift` protobuf, host-bundle entry points) are subtracted from coverage numerator+denominator via per-target `excluded-files.json`. Every exclusion is enumerated in `docs/coverage-exclusions.md` with a one-line rationale.

New exclusions need a rationale entry in the same commit. The ledger doubles as a review checkpoint — every entry should answer "why is this not testable?" and "what would change to make it testable?"

---

## 10. Sub-pattern: chained-buckets coverage gate

`npm run check:coverage` runs vitest with `--coverage` chained across all workspaces sequentially. Each workspace holds its own 100% threshold (or the appropriate per-workspace floor). Drift between this script and the CI workflow's coverage jobs is locked by `ci-local-mirrors-workflow.test.ts`.

**CRITICAL:** always use `npm run check:coverage`, NOT `npx vitest --coverage`. The latter can be exit-code-masked by tooling that rewrites `npx` invocations (e.g., a token-optimizing CLI proxy). `check:coverage` invokes vitest via the direct binary path `./node_modules/.bin/vitest` to preserve the real exit code. See [03-ci-cd.md](03-ci-cd.md).

---

## 11. Sub-pattern: screenshot-harness mode

A separate Playwright spec set under `e2e/screenshot-harness/` runs against emulators with seed data, navigates to harness routes, captures PNGs, and pushes them to the sibling private repo (`<org>/<app>-screenshots/pr-<NNN>/`). Used on demand for PR review. **NOT in pre-push** (would slow every push for visual-proof generation). See [10-screenshot-workflow.md](10-screenshot-workflow.md).

---

## 12. Sub-pattern: helpers tests

Ratchet regex helpers (e.g., `stripTsLineAndBlockComments`, `countMatchesIgnoringBrands`, `stripSwiftPreviewBlocks`) get their own test files (e.g., `no-bare-error-text-in-features.helpers.test.ts`). These are NOT in the pre-commit ratchet list but ARE picked up by regular vitest discovery and `scripts/ci-local.sh` STEP 2. They lock the regex shape against silent refactor breakage.

---

## 13. Adopting this playbook

- [ ] Vitest set up with coverage thresholds per workspace (`vitest.config.ts` template).
- [ ] `seedPermutations.ts` skeleton — one cell per domain-entity state shape.
- [ ] `EXPECTED_TOTAL_SEEDED` + `permutation-seed-count-locked.test.ts` ratchet wired.
- [ ] `firebase emulators:exec` invocation in `scripts/ci-local.sh` STEP 4.
- [ ] `e2e/cross-page/` directory with at least one cross-page spec when the first user-facing feature ships.
- [ ] `global-features-have-cross-page-spec` + `no-stale-e2e-selectors` ratchets wired.
- [ ] `npm run test:pre-release` script chaining the Tier 3 wall; `deploy-scripts-gated-by-pre-release` ratchet wired.
- [ ] For iOS: per-target floors in `check-coverage-floors.sh`; `merge-coverage.py` for cross-scheme merge.
- [ ] `docs/coverage-exclusions.md` ledger seeded with the SDK-boundary exclusions.

---

**Last updated:** 2026-06-21
