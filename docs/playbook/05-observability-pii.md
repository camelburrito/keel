# 05 — Observability & PII Handling

**Status:** 🟡 outlined — **PILOT entry for first full draft**
**Reference impl:** `chorz/docs/architecture/pii-handling.md`, `chorz/shared-cf-utils/src/utils/logger.ts`, `chorz/scripts/audit-cloud-logging-pii.mjs`, `chorz/src/__tests__/no-console-in-source.test.ts`, `chorz/src/__tests__/no-bare-firebase-uid-in-logger.test.ts`

## Why this exists

User PII (emails, phone numbers, auth UIDs, FCM tokens, OAuth refresh tokens, Calendar/Contacts payloads) can leak into Cloud Logging, Sentry, browser DevTools, and audit trails. Each of those surfaces has different controls and different export risks (BigQuery sink, Sentry retention, DevTools persistence, Firestore query exposure). The defense is a **7-layer redact pipeline in the logger** + a **structural ban on `console.*` in source** (web bypasses Sentry's `beforeSend`, CF bypasses the logger entirely) + a **weekly read-only audit scout** that grep-checks production Cloud Logging for the patterns that should never appear.

## What you must satisfy

- A logger module that runs **every** object-arg through a redact pipeline before emit. The pipeline must include:
  1. Gaxios-style error scrubbing (OAuth `refresh_token` / `access_token` / `id_token` / `client_secret`)
  2. Domain-PII scrubbers (your equivalent of `scrubCalendarFields` — calendar/contacts/health/whatever your product touches)
  3. Email regex
  4. Phone (E.164) regex
  5. FCM token regex
  6. Firestore-path embedded-ID regex (`/users/<28-char>/...` → `/users/[REDACTED_ID]/...`)
  7. Bare 28-char Firebase UID regex (width-pinned to avoid 20-char Firestore auto-ID false positives)
- A structural ban on `console.*` in `src/`, `functions/`, `shared-*/` enforced by:
  - ESLint `no-console: error` (write-time)
  - A ratchet (`no-console-in-source`) that catches `git commit --no-verify` bypasses at pre-push/CI
  - Disable directives **require** `-- <rationale>` segments
- A `wrapHandler` Proxy on every Cloud Function that routes thrown errors through the logger before rethrow (defense in depth for unhandled paths).
- A `docs/architecture/pii-handling.md` inventory enumerating every log surface + the scrubbers that run on it + documented carve-outs (audit trail, FCM tokens to Google, OAuth secrets to Google, i18n fallbacks, React error boundary lifecycle).
- A weekly read-only operator scout (`scripts/audit-cloud-logging-pii.mjs`) that samples last N entries over last M hours and grep-checks for the 7 pattern classes; honors known redaction sentinels in the allowlist; exits 0 if clean, 1 if matches.

## Sections (TODO when drafted)

1. **Surface inventory** — Cloud Logging vs Sentry vs Browser DevTools vs Audit Trail: who sees what, retention, export risks
2. **The 7-layer redact pipeline** — pipeline order matters; URLSearchParams must become plain objects before calendar-field recurse, etc.
3. **`console.*` ban** — why it's structural not advisory; the two-gate model (ESLint + ratchet)
4. **`wrapHandler` unhandled-error path** — the Proxy-based catch-all in `@camelburrito/cf-utils`
5. **Carve-outs** — the legitimate cases where PII is allowed (audit trail D-01, FCM tokens to Google for delivery, OAuth secrets to Google for exchange) and how to document them
6. **The weekly scout** — operator triage flow, allowlist callbacks, false-positive vs true-leak resolution
7. **Bare-UID redaction in depth** — why the 28-char width is load-bearing; the `KNOWN_28CHAR_IDENTIFIERS` allowlist
8. **Sentry `ignoreErrors` discipline** — SDK-internal classes that should never reach the redact pipeline because they carry zero PII (e.g., `send was called before connect`)

## Reference reading

- `chorz/docs/architecture/pii-handling.md` — canonical inventory (§ 1 surfaces, § 2 CF pipeline, § 3 web Sentry pipeline, § 4 enforcement matrix, § 5 carve-outs, § 6 operational tools)
- `chorz/shared-cf-utils/src/utils/logger.ts` — the 7-layer pipeline with `BARE_FIREBASE_UID_RE` exported by name
- `chorz/shared-cf-utils/src/observability/instrument.ts` — `wrapHandler` Proxy + `scrubGaxiosError` + `OAUTH_SECRET_FIELDS`
- `chorz/scripts/audit-cloud-logging-pii.mjs` — operator scout
- `chorz/src/__tests__/no-console-in-source.test.ts` — ratchet #48 enforcing the ban
- `chorz/src/__tests__/no-bare-firebase-uid-in-logger.test.ts` — ratchet #47 enforcing pipeline structure
- `chorz/docs/runbooks/observability.md` — alert wiring + Tier 1/2/3 triage runbook
