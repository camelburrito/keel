# Playbook Index

The keel playbook is a set of methodology docs that capture the WHY, the structural assertions a new project must satisfy, and the generic, portable shape of each pattern. This index, the playbook framing, and the per-doc bodies are all app-agnostic and self-contained — no app-specific file paths (only generic conventions like `functions/src/`).

A new entry is added every time a consuming project ships a significant new architecture (notifications, Android, payments, etc.) and generalizes it back here. A consuming project's `playbook-coverage-on-new-architecture` ratchet enforces same-PR coverage on its side — adding `docs/architecture/<new>.md` there without a matching keel playbook entry trips the gate.

## Status legend

- 🟢 **drafted** — content is real and load-bearing
- 🟡 **outlined** — section structure exists, content TODO
- ⚪ **stub** — placeholder only, written when a consuming project ships the corresponding system

## Entries

| #  | Topic | Status |
|----|-------|--------|
| 01 | [GSD workflow](01-gsd-workflow.md) | 🟢 drafted |
| 02 | [Design system](02-design-system.md) | 🟢 drafted |
| 03 | [CI/CD philosophy](03-ci-cd.md) | 🟢 drafted |
| 04 | [Architecture docs convention](04-architecture-docs.md) | 🟢 drafted |
| 05 | [Observability & PII handling](05-observability-pii.md) | 🟢 drafted (pilot full entry, 2026-06-04) |
| 06 | [Testing cadence](06-testing-cadence.md) | 🟢 drafted |
| 07 | [Ratchet framework](07-ratchet-framework.md) | 🟢 drafted |
| 08 | [String catalog & i18n](08-string-catalog-i18n.md) | 🟢 drafted |
| 09 | [Firebase stack](09-firebase-stack.md) | 🟢 drafted |
| 10 | [Screenshot workflow](10-screenshot-workflow.md) | 🟢 drafted |
| 11 | [Staging & prod environments](11-staging-prod-environments.md) | 🟢 drafted |
| 12 | [Notifications](12-notifications.md) | 🟢 drafted |
| 13 | [System architecture & scale](13-system-architecture-and-scale.md) | 🟡 outlined |
| 14 | [Server view-model layer (SDUI-lite)](14-server-view-model-layer.md) | 🟡 outlined |

## Future entries (placeholders)

Add a new row above the line and a new file when these ship in any consuming project:

- ⚪ Android client (cross-platform parity with iOS via shared core package)
- ⚪ Payments (Stripe / RevenueCat patterns + reconciliation)
- ⚪ Background jobs (Pub/Sub scheduled functions + idempotency at scale)
- ⚪ Multi-tenancy (org-level data isolation patterns)

## How to draft an entry

Every playbook entry follows the same shape. See [recipes/add-a-playbook-entry.md](../../recipes/add-a-playbook-entry.md) for the template.

---

**Last updated:** 2026-06-21
