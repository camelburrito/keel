# @camelburrito/cf-utils

Agnostic Cloud Functions utilities for the keel-derived projects.

**Status:** implemented (v0.3.1). See [keel playbook 09-firebase-stack.md](../../docs/playbook/09-firebase-stack.md) and [05-observability-pii.md](../../docs/playbook/05-observability-pii.md).

## What this package provides

- `logger` — 7-layer PII redact pipeline (Gaxios scrubbing, domain-PII scrubber slot, email, phone, FCM token, Firestore-path embedded IDs, 28-char Firebase UID). Exports `BARE_FIREBASE_UID_RE` for downstream ratchets.
- `instrument.wrapHandler` — Proxy-based unhandled-error catch routing thrown errors through the logger before rethrow. Exports `OAUTH_SECRET_FIELDS` + `scrubGaxiosError`.
- `writeWithAudit` / `writeWithAuditBatch` — atomic mutation + audit doc in one transaction (the D-01 pattern).
- `checkRateLimit` — per-CF per-caller quota with documented tier.
- `claimIdempotency` — at-most-once semantics for retry-safe CFs.
- `validateString` / `validateEmail` / `validateUrl` — input validation primitives with consistent HttpsError codes.
- Generated `AUDIT_ACTIONS` literal-union (per-project codegen consumes from the project's audit catalog).

## Installation

```bash
npm install @camelburrito/cf-utils
```

Requires `.npmrc` with GitHub Packages auth — see [templates/.npmrc.template](../../templates/.npmrc.template).

## Domain-PII scrubber slot

The 7-layer pipeline includes a slot for domain-specific PII scrubbing (e.g., calendar fields, contacts, health data). Wire your project's scrubber at logger init:

```ts
import { configureLogger } from '@camelburrito/cf-utils';
import { scrubMyDomainFields } from './scrubbers';

configureLogger({ domainScrubber: scrubMyDomainFields });
```

## Versioning

Semver. Breaking changes require a major bump. See [CHANGELOG.md](CHANGELOG.md).

## Publishing

Publishes to GitHub Packages on tag push (`v*.*.*`) via `.github/workflows/publish.yml` in the keel repo.
