# Changelog

All notable changes to `@camelburrito/cf-utils` are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semver.

## [Unreleased]

### Added
- Scaffold only. Implementation pending extraction from `chorz/shared-cf-utils/`.

## [0.1.0] - TBD

Initial extraction. Targets:
- `logger` with 7-layer redact pipeline (extracted from `chorz/shared-cf-utils/src/utils/logger.ts`)
- `instrument.wrapHandler` + `OAUTH_SECRET_FIELDS` + `scrubGaxiosError`
- `writeWithAudit` / `writeWithAuditBatch`
- `checkRateLimit`
- `claimIdempotency`
- `validateString` / `validateEmail` / `validateUrl`
