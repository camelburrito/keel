# 07 — Ratchet Framework

**Status:** 🟢 drafted

The reference implementation lives in [`@camelburrito/ratchet-kit`](https://www.npmjs.com/package/@camelburrito/ratchet-kit) — its `helpers` module provides the shared utilities (comment-stripping, brand-aware matching, deferral verification) and its `no-*.test.ts` exemplars show the strict-zero and count-tracked patterns in action.

---

## The principle

A ratchet is a strict-zero test that locks an invariant in place: once you fix a bug class, the ratchet ensures it never returns. Unlike linters, ratchets carry **count-tracked deferral baselines** (`{ count, rationale }` per file) — both adding new violations AND silently migrating existing ones break the gate, so deferrals stay honest over time.

Strict-zero from day 1 is the default. Baselines are an escape valve for legacy-only files that get drained over time (one phase at a time, with the count decremented as files are migrated).

Three properties earn the discipline its keep:

1. **Defense at the structural layer** — ESLint catches at write-time; ratchets catch at pre-commit (and at pre-push/CI if `--no-verify` was used). Two layers, same invariant.
2. **Failure messages are repair recipes**, not just "violation found." A ratchet that says "migrate to `t()` via `shared/strings/catalogs/en-US.json`" earns its keep over one that says "1 site detected."
3. **Mutation-tested at write-time** — temporarily breaking the invariant and confirming the ratchet catches it, before committing. Proves the regex actually defends what you think it does.

---

## What you must satisfy

- A shared helpers module (use `@camelburrito/ratchet-kit`'s `helpers`, or a vendored copy) providing: `stripTsLineAndBlockComments`, `stripSwiftCommentsAndDebugBlocks`, `stripSwiftPreviewBlocks`, `countMatchesIgnoringBrands`, `DeferralEntry` shape, `checkDeferralCount` verifier.
- Every ratchet test file follows the `no-<pattern>.test.ts` naming convention and lives at `src/__tests__/` (web) or `<workspace>/src/__tests__/` (per-workspace).
- Each ratchet holds `EXPECTED_COUNTS = {}` (strict zero) OR `<PREFIX>_DEFERRED: Record<path, { count: number; rationale: string }>` (count-tracked).
- Failure messages emit a **repair recipe**, not just a violation count.
- Pre-commit hook's ratchet array AND `.github/workflows/test-coverage.yml § "Design System Ratchets"` are kept in sync, locked by the drift-gate ratchet `ratchet-list-precommit-vs-workflow.test.ts`.
- New ratchets are mutation-tested at write-time before committing.

---

## 2. The anatomy of a ratchet test

```ts
// src/__tests__/no-<pattern>.test.ts
import { describe, it, expect } from 'vitest';
import { stripTsLineAndBlockComments } from '@camelburrito/ratchet-kit';
import { readFileSync } from 'node:fs';
import { glob } from 'glob';

// Strict zero: empty map. Add path entries only for grandfathered legacy
// that you commit to draining over a known number of phases.
const EXPECTED_COUNTS: Record<string, number> = {};

describe('no-<pattern>', () => {
  it('does not appear in src/', async () => {
    const files = await glob('src/**/*.{ts,tsx}', { ignore: ['src/__tests__/**'] });
    const violations: Record<string, number> = {};

    for (const file of files) {
      const src = stripTsLineAndBlockComments(readFileSync(file, 'utf8'));
      const matches = src.match(/your-regex-here/g) ?? [];
      if (matches.length > 0) violations[file] = matches.length;
    }

    // Both adding new sites AND silently migrating without updating count fail.
    const msg = `
no-<pattern>: found ${Object.values(violations).reduce((a,b)=>a+b,0)} site(s).
Migrate to <correct primitive> per <playbook reference>.
If grandfathered, add to EXPECTED_COUNTS with rationale.
`;
    expect(violations, msg).toEqual(EXPECTED_COUNTS);
  });
});
```

---

## 3. Strict-zero vs. count-tracked deferrals

**Strict zero (default)** — `EXPECTED_COUNTS = {}`. Any violation, anywhere, fails the gate. Use when:
- You're adding the ratchet on a clean baseline (no pre-existing violations).
- You've drained the legacy sites in a prior phase.
- The cost of a hard cutover is acceptable (typical for new bug-class ratchets).

**Count-tracked deferrals** — `WEB_DEFERRED: Record<path, { count, rationale }>` (or `SWIFT_DEFERRED`, etc.). Use when:
- The ratchet defends an invariant you want enforced, but you can't drain to zero in one PR.
- You commit to draining over N phases (the deferral rationale should name the migration plan).

The deferral shape's load-bearing property: both **adding new sites** AND **migrating an existing site without decrementing the count** fail the gate. The count must always equal reality. This prevents the silent migration failure mode (someone migrates one site of three, doesn't update count, the count of 3 lies about reality).

`@camelburrito/ratchet-kit`'s `checkDeferralCount(actual, deferred)` does this verification.

---

## 4. Mutation testing at write-time

Before committing a new ratchet:
1. Temporarily inject a violation into one of the scanned files.
2. Run the ratchet — it must fail with your repair recipe message.
3. Restore the file.
4. Run the ratchet — it must pass.
5. Commit the ratchet + the test injection-and-restore cycle proves it works.

A structural ratchet can carry several independent assertions — e.g. one that locks a logging-redaction pipeline might assert that a redaction regex is exported, that it's composed into the redact function, and that a breadcrumb is emitted. Each assertion is individually mutation-tested at write time: break one, confirm only that one's assertion fails, restore. A ratchet that hasn't been mutation-tested has unknown effective coverage.

---

## 5. The drift gate

`ratchet-list-precommit-vs-workflow.test.ts` — parses `.githooks/pre-commit`'s ratchet array AND `.github/workflows/test-coverage.yml § "Design System Ratchets"`'s `npx vitest run` arguments, then asserts both lists carry the same set of test files. Fails fast when one side grows or shrinks without the other.

This is the load-bearing invariant — without it, "pre-commit and CI run the same ratchets" decays as one side or the other accumulates tests.

---

## 6. Cross-platform ratchets (text-scanning Swift via vitest)

Swift-side ratchets (`no-bare-hex-in-swift`, `no-bare-size-in-swift`, etc.) scan `apple/**/*.swift` + `packages/**/*.swift` as text via vitest. **No SwiftLint, no SwiftSyntax, no Xcode-coupled tooling.**

The trade-off: text-scanning misses some structural cases SwiftLint would catch. The win: same vitest infrastructure, same pre-commit hook, same drift-gate, same CI run. Cross-platform parity by *runner*, not by *language toolchain*.

A typical Swift ratchet set covers design-token discipline as text scans — for example `no-bare-hex-in-swift`, `no-bare-size-in-swift`, `no-bare-duration-in-swift`, `no-bare-font-size-in-swift`, `no-bare-color-constructor-in-swift`, all strict-zero. Helpers (`stripSwiftCommentsAndDebugBlocks`, `stripSwiftPreviewBlocks`) handle Swift-specific syntax forms (`//` comments, `#if DEBUG` blocks, `#Preview { ... }` canvas blocks) so they don't produce false positives.

---

## 7. Ratchet categories

A mature ratchet set tends to fall into roughly five categories:

| Category | Examples | What they defend |
|----------|----------|------------------|
| **Design system** | `no-inline-style`, `no-bare-hex-in-{css,tsx,swift}`, `no-bare-px-in-css`, `no-undefined-tokens` | Token-first, hierarchy mandate (mandate 1+2 of [02-design-system.md](02-design-system.md)) |
| **PII / observability** | `no-console-in-source`, `no-bare-id-in-logger`, `no-untrusted-logger-import` | The redact pipeline + console-bypass defense ([05-observability-pii.md](05-observability-pii.md)) |
| **Backend discipline** | `no-audit-bypass-in-functions`, `no-write-without-required-field`, `no-handler-without-explicit-invoker`, `no-handler-without-contract-fixture`, `no-banned-dep-in-codebase`, `no-cross-codebase-call`, `no-unindexed-query` | Backend / serverless invariants ([09-firebase-stack.md](09-firebase-stack.md)) |
| **Test discipline** | `permutation-seed-count-locked`, `test-e2e-covers-all-specs`, `global-features-have-cross-page-spec`, `no-stale-e2e-selectors`, `deploy-scripts-gated-by-pre-release`, `handler-has-emulator-integration` | The three testing mandates ([06-testing-cadence.md](06-testing-cadence.md)) |
| **Drift gates** | `ratchet-list-precommit-vs-workflow`, `ci-local-mirrors-workflow`, `arch-doc-claims-match-source`, `lockfile-sync-with-package-json`, `vendored-artifacts-committed`, `no-paths-filter-without-fetch-depth-zero` | Meta-invariants — the gates protecting the gates ([03-ci-cd.md](03-ci-cd.md), [04-architecture-docs.md](04-architecture-docs.md)) |

A project doesn't need dozens of ratchets on day 1. It needs the ones defending its actual invariants. Add ratchets as bug classes get fixed (the recipe pattern). Don't over-add — every ratchet has a maintenance cost.

---

## 8. When to add a new ratchet vs. extend an existing one

**Add new** when:
- A new bug class fires that no existing ratchet would have caught.
- The new invariant has a distinct regex / scope from existing ratchets.
- The new ratchet has a distinct repair recipe.

**Extend existing** when:
- The bug fits within an existing ratchet's scan scope (e.g., a new bare-hex pattern variant).
- The existing ratchet's regex can be widened with a clean test addition.

For example, a `no-bare-error-text-in-features` ratchet would be added new if it didn't fit an existing `no-bare-primitive-in-features` ratchet (different regex shape). By contrast, a query-indexing ratchet can be widened in place from class A (one query form) to also catch class B (a related index-disabling form) without a new test file. Both are valid; the choice is whether the regex / scope is genuinely distinct.

---

## 9. The repair-recipe failure message

A ratchet that says "1 violation found" forces the reader to dig through the failure to understand what to do. A ratchet that says "migrate to `t()` via shared/strings/catalogs/en-US.json — see playbook 08-string-catalog-i18n.md" tells them. The latter takes 30 seconds longer to write and saves 5 minutes per failure for every future reader.

Pattern:
```ts
const msg = `
no-<pattern>: found ${count} site(s) in ${Object.keys(violations).length} file(s).

What to do:
  - Migrate each match to <correct primitive>.
  - <Optional: playbook/recipe reference>.
  - If grandfathered, add to EXPECTED_COUNTS with a rationale entry.

Files:
${Object.entries(violations).map(([f, n]) => `  ${f}: ${n}`).join('\n')}
`;
```

---

## 10. Adopting this playbook

- [ ] Pull in `@camelburrito/ratchet-kit`'s `helpers` (or vendor a copy).
- [ ] First ratchet when first bug class is fixed (don't pre-write ratchets for hypothetical bugs).
- [ ] Each new ratchet wired in BOTH `.githooks/pre-commit` ratchet array AND `.github/workflows/test-coverage.yml`.
- [ ] `ratchet-list-precommit-vs-workflow.test.ts` ratchet wired from day 1 (the drift gate).
- [ ] Recipe: [recipes/add-a-ratchet.md](../../recipes/add-a-ratchet.md).
- [ ] When the count crosses ~10, narrate the full ratchet list in `CLAUDE.md § Audit rules for AI agents` so agent sessions have the canonical reference inline.

---

## Reference reading

- `@camelburrito/ratchet-kit` — the shared `helpers` module + exemplar `no-*.test.ts` ratchets (simple strict-zero, count-tracked deferral, multi-assertion structural, and the drift gate).
- Your own `.githooks/pre-commit` ratchet array — the canonical list in action.
- Your own `CLAUDE.md § Audit rules for AI agents` — per-ratchet narration with reasoning.

---

**Last updated:** 2026-06-21
