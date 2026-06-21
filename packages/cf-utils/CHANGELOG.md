# Changelog

All notable changes to `@camelburrito/cf-utils` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver.

## [0.3.1]

### Changed — domain-neutral defaults
- `LABELED_ID_RE` now matches any camelCase `<word>Id` label (capital `I`, so words like "android"/"valid" don't false-match) plus `uid` and the `watchToken`/`fcmToken` token labels — replacing the previous enumerated app-specific noun list. Projects needing bare-entity-name redaction (`Tenant abc123`) extend via `firestoreCollectionNames` or a `domainScrubber`.
- `firestoreCollectionNames` default trimmed to the universal `['users', 'audit']` (was an app-specific set). Extend per project via `configureLogger`.

No public API change; redaction of camelCase `<word>Id` labels and bare 28-char UIDs is unaffected.

## [0.3.0]

### Added
- `logger` with 7-layer PII redact pipeline (exports `BARE_FIREBASE_UID_RE`).
- `instrument.wrapHandler` + `OAUTH_SECRET_FIELDS` + `scrubGaxiosError`.
- `writeWithAudit` / `writeWithAuditBatch` — atomic mutation + audit doc in one transaction.
- `checkRateLimit`, `claimIdempotency`.
- `validateString` / `validateEmail` / `validateUrl` — input validation primitives.

_(Granular 0.1.0–0.2.0 history predates this changelog; the surface above reflects the implemented 0.3.0 state.)_
