# Changelog

All notable changes to `@camelburrito/cf-utils` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver.

## [0.3.0]

### Added
- `logger` with 7-layer PII redact pipeline (exports `BARE_FIREBASE_UID_RE`).
- `instrument.wrapHandler` + `OAUTH_SECRET_FIELDS` + `scrubGaxiosError`.
- `writeWithAudit` / `writeWithAuditBatch` — atomic mutation + audit doc in one transaction.
- `checkRateLimit`, `claimIdempotency`.
- `validateString` / `validateEmail` / `validateUrl` — input validation primitives.

_(Granular 0.1.0–0.2.0 history predates this changelog; the surface above reflects the implemented 0.3.0 state.)_
