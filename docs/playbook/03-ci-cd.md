# 03 — CI/CD Philosophy

**Status:** 🟡 outlined
**Reference impl:** `chorz/scripts/ci-local.sh`, `chorz/.githooks/`, `chorz/.github/workflows/test-coverage.yml`

## Why this exists

**Local-first gates.** Every CI check has a local equivalent that runs in the same order, with the same exit semantics. The local script is the source of truth; CI inherits it. This means:
- Pre-push runs `scripts/ci-local.sh` — pass locally ≈ pass on CI.
- CI never has a check that's invisible locally — drift is caught by a ratchet (`ci-local-mirrors-workflow.test.ts`) that fails fast when CI grows a new step the local script doesn't mirror.
- When GHA quota dies (free-tier 2000-min/month cap blows recurring), local gates still work; a `scripts/post-local-ci-status.cjs` posts green statuses to the PR via the Status API.

## What you must satisfy

- `scripts/ci-local.sh` — parametrized via `STEPS=(...)` at top of file; orders steps the same as `.github/workflows/test-coverage.yml`.
- `.githooks/pre-commit` — ratchet suite + `tokens:check` + `tsc --noEmit` (per workspace).
- `.githooks/pre-push` — full `ci-local.sh` mirror; path-filtered for expensive native (iOS/Android) builds.
- `npm install` postinstall sets `git config core.hooksPath .githooks` so a fresh clone gets hooks automatically.
- A drift-gate ratchet (`ci-local-mirrors-workflow.test.ts`) parses both files and fails on step-name mismatch.
- `npm run check:coverage` — the canonical dev coverage gate (NOT `npx vitest --coverage`, which can hit exit-code masking under RTK).

## Sections (TODO when drafted)

1. The local-first invariant + its drift gate
2. `scripts/ci-local.sh` shape + how to add a step
3. Pre-commit vs pre-push split (cost calibration)
4. Coverage gates: per-workspace 100% buckets, chained
5. GHA-quota-cliff fallback (`post-local-ci-status.cjs`)
6. Path-filter pattern + the `fetch-depth: 0` ratchet that defends it
7. How CI/CD interacts with [11-staging-prod-environments.md](11-staging-prod-environments.md)

## Reference reading

- `chorz/scripts/ci-local.sh` — full local mirror
- `chorz/.githooks/pre-commit` + `pre-push` — POSIX bash, readable in-repo
- `chorz/src/__tests__/ci-local-mirrors-workflow.test.ts` — drift gate
- `chorz/scripts/post-local-ci-status.cjs` — GHA-down fallback
