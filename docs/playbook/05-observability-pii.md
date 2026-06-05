# 05 — Observability & PII Handling

**Status:** 🟢 drafted
**Reference impl:** `chorz/docs/architecture/pii-handling.md`, `chorz/shared-cf-utils/src/utils/logger.ts`, `chorz/shared-cf-utils/src/observability/instrument.ts`, `chorz/src/lib/sentry.ts`, `chorz/scripts/audit-cloud-logging-pii.mjs`, `chorz/src/__tests__/no-console-in-source.test.ts`, `chorz/src/__tests__/no-bare-firebase-uid-in-logger.test.ts`

---

## The principle

**No PII reaches any log surface unintentionally.** Where PII intentionally reaches a surface (audit trail, transmission to a third party for delivery, etc.), the carve-out is explicit and reviewed.

This is a privacy floor you never lower. Defense in depth is the only way to hold it — every layer has known bypasses, so the next layer catches what the prior missed. The keel pattern is **four layers of defense** plus **a weekly drift scout**:

1. Write-time — ESLint `no-console: error` blocks the most common bypass at the editor.
2. Pre-commit + CI — a strict-zero ratchet catches `git commit --no-verify` escapes.
3. Runtime — every logger path runs a multi-stage redact pipeline; every Cloud Function is wrapped by an unhandled-error catch that routes errors through the same pipeline.
4. Operational — a weekly read-only audit scout greps live production logs for the patterns that should never appear.

Whatever survives all four is a real leak. The history table in § 8 captures the incidents this stack has caught (and the gaps that drove each new layer).

---

## 1. Log surfaces inventory

Every product has at least these surfaces. Inventory them in `docs/architecture/pii-handling.md` § 1 of your downstream project. **You can't defend a surface you haven't named.**

| Surface | Direction | Default scrubber | Default gate |
|---------|-----------|------------------|--------------|
| **Cloud Logging (CF)** | `functions/src/**` → `@camelburrito/cf-utils.logger` → Firebase Functions runtime | 7-layer redact pipeline (§ 2) | ESLint `no-console: error` + strict-zero ratchet |
| **Cloud Logging (CF platform-emitted `jsonPayload.uid`)** | Firebase Functions runtime auto-attach | Bypasses logger (can't intercept) | `wrapHandler` 'callable-invocation' breadcrumb dominates queryability — gives you a redacted hit before the platform line |
| **Sentry events (web)** | `src/**` → `Sentry.captureException/Message` → Sentry | `beforeSend` deep-walk + `SyncRedactor` | ESLint `no-console: error` + strict-zero ratchet |
| **Sentry breadcrumbs** | Auto-captured by Sentry SDK | `beforeSend` walks breadcrumb data too | Same |
| **Browser DevTools (web `console.*`)** | Direct browser stdout | **None** — bypasses Sentry entirely | ESLint `no-console: error` + strict-zero ratchet; every `console.*` carries `// eslint-disable-next-line no-console -- <rationale>` |
| **Audit trail (`audit/{auditId}` Firestore)** | `writeWithAudit` writes to Firestore | **Deliberate carve-out** — audit records persist actor/target UIDs by design (D-01) | Not a "log surface" in the observability sense; an operational record |
| **Native crash reporting** (Crashlytics / Sentry mobile) | Native SDK → vendor service | Vendor's PII guarantees + sample sanitization | Document in arch doc § 1; vendor-specific |

---

## 2. The 7-layer CF redact pipeline

Every `logger.{log,info,warn,error,debug}` call routes BOTH the message AND each variadic arg through `redact()`. The pipeline runs in order; **ordering is load-bearing** (e.g., URLSearchParams must become plain objects before domain-field recursion, FCM tokens must be eaten before the labeled-ID pass would otherwise half-redact them).

| # | Layer | What it catches | Notes |
|---|-------|-----------------|-------|
| 1 | **`scrubGaxiosError`** | OAuth secrets in error responses: `refresh_token`, `access_token`, `id_token`, `client_secret` → `[REDACTED_OAUTH_TOKEN]` | Recursive walker. Normalizes `URLSearchParams` → plain object. **`code` deliberately EXCLUDED** — HTTP status + JS `Error.code` semantics dominate; the OAuth-grant flow's `code` is short-lived and surfaces as a value, not a secret. |
| 2 | **Domain-PII scrubber (slot)** | Product-specific PII not covered by the generic email/phone redactor (e.g., calendar event titles, attendee lists, contacts metadata, health values, transaction amounts) → `<scrubbed:<domain>-pii>` | **You implement this slot.** Wire your scrubber via `configureLogger({ domainScrubber: scrubMyDomainFields })`. Each domain field is a known leak class. |
| 3 | **`redact-pii` `SyncRedactor`** | Generic PII: email, phone, SSN, credit card, IP, names, addresses, DOB, IBAN, VIN | Same library used by web Sentry pipeline. Operates on string output. **Always runs regardless of bypass** — this is the privacy floor. |
| 4 | **`FIRESTORE_PATH_RE`** | `/users/{uid}/...` / `/households/{hid}/members/{mid}/...` style paths → segment IDs replaced with `[REDACTED_ID]` | Path-shape regex. Catches CF error messages of the form "Document /users/abc123def... not found". |
| 5 | **`LABELED_ID_RE`** | Label-value pairs: `uid: "..."`, `householdId: "..."`, `memberId: "..."` → `<label>: [REDACTED_ID]` | Object-stringify output. Catches structured logs that JSON-serialized internal IDs. |
| 6 | **`BARE_FIREBASE_UID_RE`** | Bare 28-char Firebase Auth UIDs without a label: `/\b[a-zA-Z0-9]{28}\b/g` → `[REDACTED_ID]` | **Width-pinned to exactly 28.** Avoids false positives on 20-char Firestore auto-IDs, 32-char hex digests, 40-char git SHAs. Honors a `KNOWN_28CHAR_IDENTIFIERS` allowlist (project IDs, build SHAs the platform happens to render at 28 chars). |
| 7 | **`FCM_TOKEN_RE`** | FCM device tokens: `[A-Za-z0-9_-]{20,}:APA91[A-Za-z0-9_-]{100,}` → `[REDACTED_FCM_TOKEN]` | Runs FIRST inside `redactInternalIds()` (the layer 4-7 sub-pipeline) because the long alphanumeric prefix would otherwise be half-redacted by `LABELED_ID_RE`. |

### Staging bypass

A controlled bypass is essential for incident triage — sometimes you genuinely need to see the unredacted UID in staging logs to chase a bug. Pattern:

- Env var `LOGGER_REDACT_INTERNAL_IDS_BYPASS=1` enables bypass.
- Project-ID allowlist (`REDACT_BYPASS_ALLOWED_PROJECTS`, e.g., `{ '<app>-staging' }`) gates which projects honor the env var. Prod project ID is NOT in the allowlist.
- The bypass disables layers 4–7 (internal-ID redaction). **Layers 1–3 still run** — the privacy floor never drops.
- Fail-closed by design: if the env var is set in a project not on the allowlist, the bypass is ignored.

---

## 3. The web Sentry pipeline

Web-side redaction runs in `Sentry.init`'s `beforeSend` hook. Three jobs:

1. **`deepRedactStrings(event, redactor)`** — walker that recurses through nested objects + arrays and redacts string LEAF values only. **Never serializes the whole event to JSON for redaction** — that round-trip (`JSON.parse(redact(JSON.stringify(...)))`) silently produces parse errors on payloads containing characters PII redaction touches (e.g., quotes inside redacted email-like strings). Chorz hit this as a class of `SyntaxError: Unexpected identifier "URL"` Sentry events in 2026-04..05.
2. **Same `redact-pii` `SyncRedactor`** as layer 3 of the CF pipeline — single library, two surfaces, same vocabulary.
3. **`SENTRY_IGNORED_ERRORS: RegExp[]`** consulted by Sentry's `ignoreErrors` config. SDK-internal classes that carry zero PII (e.g., `/send was called before connect/i` — Sentry-replay-internal race during tab-close) get suppressed at the source. **Object-frozen** for runtime mutation defense.

`Sentry.init` itself emits a `console.warn` if the DSN is missing in production — this is one of the documented carve-outs (§ 5) because Sentry can't capture-message itself before init.

---

## 4. The structural defense matrix

| Rule | Layer | Defends what |
|------|-------|--------------|
| `no-console: error` (ESLint at the root + per workspace) | Write-time | The most common bypass; catches at IDE / `npm run lint`. |
| `no-console-in-source` (strict-zero ratchet) | Pre-commit + CI | `git commit --no-verify` ESLint escape. Requires `-- <rationale>` segment on every `eslint-disable-next-line no-console` directive — empty disables fail the gate. |
| `no-<vendor>-import-in-cf` (strict-zero ratchet) | Pre-commit + CI | Prevents a parallel scrub pipeline outside `@camelburrito/cf-utils.logger`. (chorz uses `no-sentry-import-in-cf` for the same reason — CF observability is Cloud Logging only.) |
| `no-bare-firebase-uid-in-logger` (strict-zero ratchet) | Pre-commit + CI | Defends `BARE_FIREBASE_UID_RE` + `KNOWN_28CHAR_IDENTIFIERS` + `wrapHandler` breadcrumb invariants by structural assertion (regex export, redact pipeline composition, breadcrumb emit). |
| `wrapHandler` Proxy on every onCall | Runtime | Routes thrown errors through the logger before rethrow. Unhandled-error paths can no longer escape the redact pipeline. |
| CF ESLint gate in `scripts/ci-local.sh` | Pre-push + CI | Linter runs against every CF source dir. Web side relies on the ratchet because typical web codebases carry a pre-existing ESLint backlog (tech debt; the ratchet still defends the PII invariant strictly). |

The drift gate (`ratchet-list-precommit-vs-workflow.test.ts`) keeps the ratchet list in `.githooks/pre-commit` and `.github/workflows/test-coverage.yml § "Design System Ratchets"` in sync.

---

## 5. Carve-out discipline

Some places PII appears in logs by design. **Every one must be documented with rationale**, or you don't know whether it's a leak or a feature. The canonical list lives in your downstream `docs/architecture/pii-handling.md § 5`.

Common legitimate carve-outs:

- **5.1 Audit trail** — `audit/{auditId}` records persist actor/target IDs intentionally. The redactor only runs on logger output; audit-trail writes are direct Firestore mutations through `writeWithAudit`. Locked by `no-audit-bypass-in-functions` ratchet.
- **5.2 Tokens transmitted to a vendor** — FCM tokens go to Google FCM for delivery; OAuth tokens go to Google OAuth for exchange. Wire content goes to the vendor, not your logs. On error paths, `scrubGaxiosError` + `FCM_TOKEN_RE` redact them in any log output.
- **5.3 i18n fallback warnings** — codegen-emitted `console.warn` calls fire on missing-translation paths. Interpolation values are catalog keys + locale codes (neither is PII). Each call site carries an `eslint-disable-next-line no-console -- <rationale>` directive emitted by the codegen.
- **5.4 Static config-missing warnings** — bootstrap modules (Sentry init, Analytics init, FCM VAPID key) `console.warn` when their env vars are missing. Static strings; load-order-special (Sentry can't `captureMessage` before init); document the rationale at each call site.
- **5.5 Dev-only debug surfaces** — design-system showcase pages (`/components`), debug-mode dashboards, screenshot harness routes. Use a top-of-file `/* eslint-disable no-console -- <rationale> */` block.
- **5.6 React error-boundary lifecycle** — `componentDidCatch` calls `console.error(error, errorInfo)` alongside `Sentry.captureException`. The Sentry path is redacted; the `console` path retains DevTools visibility for the user themselves. PII risk is bounded to the user's own session.

**The discipline:** each carve-out gets a § 5.N entry in the arch doc + a `-- <rationale>` directive (per-site) or a top-of-file disable block (per-file). The ratchet enforces structurally that the disable directive exists with rationale; the arch doc gives a reviewer the why.

---

## 6. The unhandled-error path — `wrapHandler`

A CF that crashes outside its top-level try/catch escapes any in-function logging. `wrapHandler` is a JavaScript `Proxy` that wraps every onCall export:

- The `apply` trap fires before the handler runs and emits a `logger.info('callable-invocation', { uid })` breadcrumb — gives you a redacted, queryable hit for every invocation BEFORE the handler even starts.
- The trap wraps the handler call in try/catch. HttpsErrors are rethrown unchanged (preserves wire codes). Non-HttpsErrors are routed through `logger.error(...)` (which runs the full redact pipeline) and then rethrown as `HttpsError('internal', 'internal')`.
- The Proxy's `get` trap forwards `.__trigger` / `.run` / etc. metadata so Firebase's runtime still recognizes the wrapped value as a CallableFunction.

Mount pattern: every CF index file does `export const myCf = wrapHandler(require('./path').myCf)`. Universal coverage. If you add a new CF without `wrapHandler`, the redact pipeline doesn't run on its unhandled-error path — file a follow-up ratchet (`no-oncall-without-wrapHandler` or similar) if this risk crosses an acceptable threshold for your product.

---

## 7. Operational tools

### 7.1 Weekly Cloud Logging scout

`scripts/audit-cloud-logging-pii.mjs` — operator-runnable, **read-only** scout. Pattern:

- `gcloud logging read` samples the last N log entries (default 1000) over the last M hours (default 168 = 7 days) from the project.
- Scans each entry's text for 7 PII pattern classes (email, phone E.164, 28-char Firebase UID, Firestore-paths-with-embedded-IDs, FCM tokens, OAuth refresh-token prefix `1//`, and any domain-specific patterns you add — e.g., Calendar v3 keys for chorz).
- Honors a `REDACTION_SENTINELS` allowlist (`[REDACTED]`, `[REDACTED_ID]`, `[REDACTED_FCM_TOKEN]`, `[REDACTED_OAUTH_TOKEN]`, `<scrubbed:<domain>-pii>`) — matches inside redaction sentinels are not flagged.
- Also honors a `KNOWN_28CHAR_IDENTIFIERS` Set (project IDs, build SHAs) that defends the runtime BARE_FIREBASE_UID_RE allowlist symmetrically.
- Exit 0 if clean, 1 if matches. CI-friendly.
- Run weekly. Triage matches via your `docs/runbooks/observability.md` § "PII drift audit".

### 7.2 Alert wiring

`scripts/setup-cf-alerts.sh --project=<APP>-{staging,prod}` (idempotent `gcloud` wrapper) wires:
- Per-env email notification channel (Gmail `+tag` aliases per env — `<addr>+<app>-{staging,prod}@gmail.com`).
- Log-based metric: count of new error groups.
- Alert policies: new error groups + sustained error rate.

Run once per environment at project setup.

### 7.3 Triage runbook

`docs/runbooks/observability.md` — three-tier triage:
- **Tier 1** — Firebase Console (CF logs viewer, errored invocations). Fastest. Most issues stop here.
- **Tier 2** — GCP Error Reporting. Auto-groups errors across deployments. Use when Tier 1 is too noisy or you need stack-trace clustering.
- **Tier 3** — `gcloud logging read` with structured filters. Use when you need to correlate across services, embed `labels.git_sha` filters, or trace a specific user's session through `wrapHandler` breadcrumbs.

---

## 8. Incident learnings (the bug classes this stack has caught)

Each row is a prior incident + the structural defense that now prevents recurrence. This table belongs in your downstream arch doc; the keel version captures the lessons that earned their place in the standard stack.

| When | Incident | Layer that caught it (now) |
|------|----------|---------------------------|
| Pre-2026-04-26 | Plain-text PII (emails, names) in CF Cloud Logging | Layer 3 (`redact-pii`) adoption |
| 2026-04..05 | `SyntaxError: Unexpected identifier "URL"` Sentry events from `JSON.parse(redact(JSON.stringify(...)))` round-trip | Web pipeline rewrite — walker, not round-trip |
| 2026-05-27 | Plaintext `refresh_token` in CF error `textPayload` (errorGroup `CIrnzZbL6NnqqAE`) | Layer 1 (`scrubGaxiosError`) + `wrapHandler` unhandled-error path |
| 2026-06-03 | Bare 28-char Firebase UIDs in CF log strings, usable for backwards email resolution | Layer 6 (`BARE_FIREBASE_UID_RE`) + `wrapHandler` 'callable-invocation' breadcrumb dominating queryability |
| 2026-06-04 | `console.*` bypasses (web Sentry, CF logger) detected post-PR-#627 review | ESLint `no-console: error` + strict-zero ratchet + CF lint gate in `ci-local.sh` |

The pattern: every time a real leak ships, a structural defense earns its way into the standard stack. Don't relitigate the lesson on the next product.

---

## 9. Adopting this playbook in a new keel-derived project

Checklist for a fresh project setup. Most of it ships in the templates; this enumerates what you wire up yourself.

- [ ] Install `@camelburrito/cf-utils` and configure the logger with your product's domain-PII scrubber (layer 2 of the pipeline).
- [ ] Add `KNOWN_28CHAR_IDENTIFIERS` allowlist entries for any 28-char strings your platform legitimately renders (build SHAs at that length, project IDs).
- [ ] ESLint `no-console: error` at the root + every CF workspace (`functions/eslint.config.mjs` etc.).
- [ ] Wire the strict-zero ratchets via `@camelburrito/ratchet-kit`: `noConsoleInSource`, `noBareFirebaseUidInLogger`. Add `no-<vendor>-import-in-cf` for whichever vendor SDKs you've decided don't belong in CF (Sentry, etc.).
- [ ] Wrap every onCall with `wrapHandler` from `@camelburrito/cf-utils`. Cite the count in `docs/architecture/cloud-functions.md` and defend it with an `arch-doc-cf-claims` value parser.
- [ ] Sentry init with `beforeSend` running `deepRedactStrings` + `SyncRedactor`. Add an `ignoreErrors` array for SDK-internal classes that carry zero PII.
- [ ] Write `docs/architecture/pii-handling.md` (§ 1 surfaces, § 2 CF pipeline, § 3 web Sentry pipeline, § 4 enforcement matrix, § 5 carve-outs, § 6 operational tools). Re-anchor the Last-updated footer when you ship a change.
- [ ] Wire `scripts/audit-cloud-logging-pii.mjs` into the operator routine. Schedule weekly cadence (calendar reminder, cron, or human discipline — pick one and document).
- [ ] Wire `scripts/setup-cf-alerts.sh` for both staging and prod environments.
- [ ] Write `docs/runbooks/observability.md` with the three-tier triage flow.
- [ ] Verify the pre-launch PII audit checklist before flipping any new surface public — see [checklists/pre-launch-pii-audit.md](../../checklists/pre-launch-pii-audit.md).

---

## Reference reading

Specific chorz file paths for cross-referencing during implementation:

- `chorz/docs/architecture/pii-handling.md` — the canonical inventory
- `chorz/shared-cf-utils/src/utils/logger.ts` — the 7-layer pipeline, `BARE_FIREBASE_UID_RE` exported by name
- `chorz/shared-cf-utils/src/observability/instrument.ts` — `wrapHandler` Proxy + `scrubGaxiosError` + `OAUTH_SECRET_FIELDS` + `scrubCalendarFields` (chorz's domain scrubber)
- `chorz/src/lib/sentry.ts` — `beforeSend` + `deepRedactStrings` + `SENTRY_IGNORED_ERRORS`
- `chorz/scripts/audit-cloud-logging-pii.mjs` — weekly scout (operator tool)
- `chorz/scripts/setup-cf-alerts.sh` — alert wiring (per-env gcloud wrapper)
- `chorz/src/__tests__/no-console-in-source.test.ts` — ratchet #48
- `chorz/src/__tests__/no-bare-firebase-uid-in-logger.test.ts` — ratchet #47
- `chorz/src/__tests__/no-sentry-import-in-cf.test.ts` — ratchet defending CF observability boundary
- `chorz/docs/runbooks/observability.md` — Tier 1/2/3 triage runbook
- `chorz/functions/src/audit/writeWithAudit.ts` — the audit-trail carve-out (D-01)
