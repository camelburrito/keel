# Changelog

All notable changes to `@camelburrito/cf-utils` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver.

## [0.3.2] — 2026-06-22

### Changed
- Relicensed from PolyForm Noncommercial 1.0.0 to **MIT** (`license` field + bundled `LICENSE` file). No code or public-API change.

## [0.3.1] — 2026-06-21

### Changed — domain-neutral defaults
- `LABELED_ID_RE` now matches any camelCase `<word>Id` label **case-sensitively** (literal capital `I`, so English words ending in lowercase "id" — "android"/"valid"/"grid" — don't false-match), plus the fixed token labels `uid`/`watchToken`/`fcmToken` matched **case-insensitively** (`UID`/`WatchToken`/`FCMToken` are caught) — replacing the previous enumerated app-specific noun list. The previous bare-entity-name form (`Tenant abc123`) is no longer matched by default; a project that logs that shape recovers it with a `domainScrubber`. All-caps multi-word labels (`USERID`) are likewise not matched by default.
- `firestoreCollectionNames` default trimmed to the universal `['users', 'audit']` (was an app-specific set). Extend per project via `configureLogger` — this controls the `<collection>/<id>` path layer only.

No public API change; redaction of camelCase `<word>Id` labels and bare 28-char UID *values* (via `BARE_FIREBASE_UID_RE`, independent of label casing) is unaffected.

## [0.3.0] — 2026-06-05

### Added
- `logger` with 7-layer PII redact pipeline (exports `BARE_FIREBASE_UID_RE`).
- `instrument.wrapHandler` + `OAUTH_SECRET_FIELDS` + `scrubGaxiosError`.
- `writeWithAudit` / `writeWithAuditBatch` — atomic mutation + audit doc in one transaction.
- `checkRateLimit`, `claimIdempotency`.
- `validateString` / `validateEmail` / `validateUrl` — input validation primitives.

_(Granular 0.1.0–0.2.0 history predates this changelog; the surface above reflects the implemented 0.3.0 state.)_
