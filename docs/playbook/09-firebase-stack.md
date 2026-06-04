# 09 — Firebase Stack

**Status:** 🟡 outlined
**Reference impl:** `chorz/docs/architecture/cloud-functions.md`, `chorz/docs/architecture/data-model.md`, `chorz/firebase.json`, `chorz/firestore.rules`, `chorz/shared-cf-utils/`

## Why this exists

Firebase is the default backend for keel-derived projects: Auth (multi-provider OAuth + anonymous + custom-token), Firestore (real-time sync + per-document audit), Cloud Functions (split codebases for cold-start isolation), FCM (notifications). The patterns that earn their keep across projects: **codebase split** for cold-start budget control, **deny-all-then-allowlist** Firestore rules, **`writeWithAudit` atomic mutations**, **typed cross-codebase signals via Firestore fields** (never cross-codebase HTTPS).

## What you must satisfy

- `firebase.json` — declare each codebase as a separate `functions[]` entry (e.g., `default` for app-domain CFs, `<external>` for heavy SDK consumers like `googleapis`).
- `firestore.rules` — deny-all baseline at the top; allowlist per collection with corresponding test coverage in `firestore.rules.test.ts`.
- `firestore.indexes.json` — every `collectionGroup` query has a matching index entry; every `fieldOverride` that disables COLLECTION-scope keeps you out of unindexed `.where()` chains. Defended by `no-unindexed-collectiongroup-query` ratchet.
- `@camelburrito/cf-utils` workspace package providing:
  - `writeWithAudit` / `writeWithAuditBatch` — atomic mutation + audit doc in one transaction (D-01).
  - `checkRateLimit` — per-CF per-caller quota with documented per-CF tier (defended by `no-oncall-without-explicit-invoker` + `arch-doc-cf-claims` ratchets).
  - `claimIdempotency` — at-most-once semantics for retry-safe CFs.
  - `validateString` / `validateEmail` / `validateUrl` — input validation primitives with consistent HttpsError codes.
  - `logger` — see [05-observability-pii.md](05-observability-pii.md).
  - `wrapHandler` — Proxy-based unhandled-error catch routing to logger.
- Cross-codebase coordination via **Firestore field signals only** — never `httpsCallable` from one codebase to another. Defended by `no-cross-codebase-https-call` ratchet.
- Heavy SDKs (e.g., `googleapis`) live in **one codebase only** — defended by `no-<heavy-sdk>-in-default-codebase` ratchet.

## Sections (TODO when drafted)

1. Codebase split philosophy (cold-start budget, SDK isolation, blast radius)
2. The `writeWithAudit` pattern + the `no-audit-bypass-in-functions` ratchet
3. Deny-all-then-allowlist rules + the `no-firestore-collection-without-rule-test` ratchet
4. Index discipline + the `no-unindexed-collectiongroup-query` ratchet (covers both `collectionGroup` queries AND `fieldOverride`-disables-COLLECTION-scope class)
5. Rate limit + invoker discipline (`no-oncall-without-explicit-invoker`)
6. Contract fixtures per CF (`no-cf-without-contract-fixture`)
7. The emulator harness — `firebase emulators:start` + Tier 2 integration tests
8. Cross-codebase signals via typed `SCHEDULING_SIGNALS` registry (or equivalent for your domain)
9. Recipe: adding a new CF — see [recipes/add-a-cloud-function.md](../../recipes/add-a-cloud-function.md)

## Reference reading

- `chorz/docs/architecture/cloud-functions.md` — full architecture doc (codebase split, rate limits, signals)
- `chorz/docs/architecture/data-model.md` — schema + collection inventory
- `chorz/docs/architecture/audit-trail.md` — D-01 atomic-write pattern
- `chorz/shared-cf-utils/` — workspace package (the agnostic primitives become `@camelburrito/cf-utils`)
- `chorz/functions/src/index.ts` + `chorz/functions-calendar/src/index.ts` — split codebases
- `chorz/firestore.rules` — deny-all baseline + allowlist
