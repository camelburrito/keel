# Playbook Index

The keel playbook is a set of methodology docs that capture the WHY and the structural assertions a new project must satisfy. Each entry points back to the canonical reference implementation in `camelburrito/chorz` (and any other reference project) by file path.

A new entry is added every time a reference project ships a significant new architecture (notifications, Android, payments, etc.). The `playbook-coverage-on-new-architecture` ratchet on the reference project (live in `chorz/src/__tests__/playbook-coverage-on-new-architecture.test.ts`) enforces same-PR coverage — adding `docs/architecture/<new>.md` without a matching keel playbook entry trips the gate.

## Status legend

- 🟢 **drafted** — content is real and load-bearing
- 🟡 **outlined** — section structure exists, content TODO
- ⚪ **stub** — placeholder only, written when chorz ships the corresponding system

## Entries

| #  | Topic | Status | Reference impl |
|----|-------|--------|----------------|
| 01 | [GSD workflow](01-gsd-workflow.md) | 🟢 drafted | `chorz/.planning/` + `docs/GSD_PLAN.md` + `docs/ACTIVE_TASKS.md` |
| 02 | [Design system](02-design-system.md) | 🟢 drafted | `chorz/CLAUDE.md § Design System Governance`, `chorz/src/ui/`, `chorz/shared/tokens/tokens.json` |
| 03 | [CI/CD philosophy](03-ci-cd.md) | 🟢 drafted | `chorz/scripts/ci-local.sh`, `chorz/.githooks/`, `chorz/.github/workflows/test-coverage.yml` |
| 04 | [Architecture docs convention](04-architecture-docs.md) | 🟢 drafted | `chorz/docs/architecture/`, `chorz/.claude/hooks/architecture-doc-drift.sh` |
| 05 | [Observability & PII handling](05-observability-pii.md) | 🟢 drafted (pilot full entry, 2026-06-04) | `chorz/docs/architecture/pii-handling.md`, `chorz/shared-cf-utils/src/utils/logger.ts`, `chorz/scripts/audit-cloud-logging-pii.mjs` |
| 06 | [Testing cadence](06-testing-cadence.md) | 🟢 drafted | `chorz/docs/architecture/testing.md`, `chorz/functions/src/__tests__-integration/helpers/seedPermutations.ts` |
| 07 | [Ratchet framework](07-ratchet-framework.md) | 🟢 drafted | `chorz/src/__tests__/_ratchetHelpers.ts`, `chorz/src/__tests__/no-*.test.ts` |
| 08 | [String catalog & i18n](08-string-catalog-i18n.md) | 🟢 drafted | `chorz/docs/architecture/design-system-architecture.md § 3.5`, `chorz/scripts/gen-strings.mjs` |
| 09 | [Firebase stack](09-firebase-stack.md) | 🟢 drafted | `chorz/docs/architecture/cloud-functions.md`, `chorz/firebase.json`, `chorz/firestore.rules` |
| 10 | [Screenshot workflow](10-screenshot-workflow.md) | 🟢 drafted | `chorz/.claude/skills/pr-ui-screenshots`, `camelburrito/chorz-screenshots` |
| 11 | [Staging & prod environments](11-staging-prod-environments.md) | 🟢 drafted | `chorz/.github/workflows/_deploy.yml`, `chorz/.env.*`, `chorz/scripts/verify-deploy-shape.sh` |
| 12 | [Notifications](12-notifications.md) | 🟡 outlined | `chorz/docs/architecture/notifications.md`, `chorz/shared-cf-utils/src/notifications/`, `chorz/functions-calendar/src/notifications/`, `chorz/apple/Chorz/ChorzWidgets/` |

## Future entries (placeholders)

Add a new row above the line and a new file when these ship in any reference project:

- ⚪ Android client (cross-platform parity with iOS via shared core package)
- ⚪ Payments (Stripe / RevenueCat patterns + reconciliation)
- ⚪ Background jobs (Pub/Sub scheduled functions + idempotency at scale)
- ⚪ Multi-tenancy (org-level data isolation patterns)

## How to draft an entry

Every playbook entry follows the same shape. See [recipes/add-a-playbook-entry.md](../../recipes/add-a-playbook-entry.md) for the template.
