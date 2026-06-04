# 07 — Ratchet Framework

**Status:** 🟡 outlined
**Reference impl:** `chorz/src/__tests__/_ratchetHelpers.ts`, `chorz/src/__tests__/no-*.test.ts` (48 ratchets), `@camelburrito/ratchet-kit`

## Why this exists

A ratchet is a strict-zero test that locks an invariant in place — once you fix a bug class, the ratchet ensures it never returns. Unlike linters, ratchets carry **count-tracked deferral baselines** (`{ count, rationale }` per file) — both adding new violations AND silently migrating existing ones break the gate, so deferrals stay honest. Strict-zero from day 1 is the default; baselines are escape valves for legacy-only files that get drained over time.

## What you must satisfy

- A `_ratchetHelpers.ts` module (or vendor `@camelburrito/ratchet-kit`'s) with:
  - `stripTsLineAndBlockComments` — strip comments before regex scan
  - `stripSwiftCommentsAndDebugBlocks` — same for Swift, plus `#if DEBUG` blocks
  - `stripSwiftPreviewBlocks` — drop `#Preview { ... }` canvas blocks
  - `countMatchesIgnoringBrands` — second-pass filter for BRAND_STRINGS allowlist
  - `DeferralEntry` shape + `checkDeferralCount` verifier
- Every ratchet test:
  - Lives at `src/__tests__/no-<pattern>.test.ts` (web-side) or `<project>/src/__tests__/no-<pattern>.test.ts` (per-workspace)
  - Holds `EXPECTED_COUNTS = {}` (strict zero) OR `WEB_DEFERRED: Record<path, { count, rationale }>` (count-tracked)
  - Emits a failure message with a **repair recipe** ("migrate to `t()` via `shared/strings/catalogs/<locale>.json`" — not just "violation found")
  - Is included in the pre-commit hook's ratchet array
  - Is mirrored in `.github/workflows/test-coverage.yml § "Design System Ratchets"`
- A drift gate (`ratchet-list-precommit-vs-workflow.test.ts`) parses both lists and fails on mismatch.

## Sections (TODO when drafted)

1. Strict-zero philosophy + when count-tracked deferrals are justified
2. The anatomy of a ratchet test (helpers, regex, deferral map, failure message)
3. Mutation testing at write-time (temporarily break the invariant to prove the ratchet catches it)
4. The drift gate (pre-commit list vs. workflow list)
5. Cross-platform ratchets (text-scanning Swift via vitest — no SwiftLint/SwiftSyntax/Xcode coupling)
6. Recipe: writing a new ratchet — see [recipes/add-a-ratchet.md](../../recipes/add-a-ratchet.md)

## Reference reading

- `chorz/src/__tests__/_ratchetHelpers.ts` — shared helpers
- `chorz/src/__tests__/no-inline-style.test.ts` — exemplar simple ratchet
- `chorz/src/__tests__/no-bare-user-facing-string-in-features.test.ts` — exemplar count-tracked deferral ratchet
- `chorz/src/__tests__/ratchet-list-precommit-vs-workflow.test.ts` — drift gate
- `chorz/CLAUDE.md § Audit rules for AI agents` — the canonical 48-ratchet list with reasoning
