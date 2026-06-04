# Architecture Documentation

Canonical architecture references for this codebase. Read these first when touching a corresponding subsystem rather than reverse-engineering from many files.

**Keep them in sync as you iterate.** When a phase or PR changes how a documented system actually works, update the matching `docs/architecture/<name>.md` in the same PR. Each doc carries a "Last updated" footer; re-anchor it when you ship the change.

A PostToolUse hook at `.claude/hooks/architecture-doc-drift.sh` flags edits to files cited by these docs — heed the reminder rather than dismissing it.

See keel playbook entry [04-architecture-docs.md](https://github.com/camelburrito/keel/blob/main/docs/playbook/04-architecture-docs.md) for the convention.

## Index

| Doc | Status | Last updated |
|-----|--------|--------------|
| _add your first arch doc here_ | — | — |

## Suggested first docs to write (as the systems land)

- `auth.md` — sign-in providers, custom claims, token refresh
- `data-model.md` — Firestore schema + collection inventory + index discipline
- `cloud-functions.md` — codebase split, rate limits, signal registry
- `audit-trail.md` — `writeWithAudit` pattern + audit action catalog
- `design-system-architecture.md` — 4-layer hierarchy + codegen pipelines
- `testing.md` — 4-tier cadence + permutation grid + contract fixtures
- `observability.md` — alert wiring + runbook references
- `pii-handling.md` — 7-layer redact pipeline + carve-out inventory
