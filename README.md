# keel

Private engineering baseline for production apps under `camelburrito/`.

`keel` is a **standalone, app-agnostic playbook + scaffolds + vendored packages** repository. It's the foundation every new production project starts from. Patterns are proven in real production projects, generalized here so they carry no app-specific detail, and flow back into keel through an app-agnostic upstreaming process (see [recipes/upstream-an-improvement.md](recipes/upstream-an-improvement.md)). keel names no specific downstream project; any project (current or future) is just a consumer.

## What's here

**`docs/playbook/`** — methodology docs (one per system). These capture the WHY, the structural assertions you must satisfy, and the generic pattern itself. The framing and index are app-agnostic; app-specific paths are being removed from the body docs per-entry as a follow-up.

**`templates/`** — empty scaffolds that get copied into new projects at bootstrap time. POSIX-bash githooks, deny-all `firestore.rules`, base `tsconfig.json` / `eslint.config.js` / `vitest.config.ts`, parametrized GHA workflows, `.env.{staging,prod}.example` field conventions.

**`packages/`** — truly agnostic code, published to GitHub Packages as `@camelburrito/<pkg>`:
- `cf-utils` — logger with 7-layer PII redact pipeline, `writeWithAudit`, `idempotency`, `rateLimit`, `validation`, `wrapHandler` + `OAUTH_SECRET_FIELDS`
- `ratchet-kit` — shared ratchet helpers + 23 structural ratchet templates as configurable functions

**`scripts/`** — agnostic build/CI/audit scripts (parametrized): `ci-local.sh` skeleton, `gen-strings.mjs`, `gen-tokens.mjs`, `audit-cloud-logging-pii.mjs`, `predeploy-pack-cf-utils.sh`.

**`recipes/`** — "how to add X" guides (new ratchet, new architecture doc, new CF, new locale, new environment).

**`checklists/`** — pre-launch, pre-merge, pre-deploy checklists.

## Distribution model

- This repo is **private** (`camelburrito/keel`).
- Agnostic packages publish to **GitHub Packages** as `@camelburrito/*`. Consuming projects add `.npmrc` with a GitHub PAT and `npm install` normally.
- Templates, playbooks, recipes, and checklists are **copied** at bootstrap time (a project's own copy is allowed to drift; pulling updates is a manual `keel-refresh.sh` step that shows a diff).

## Bootstrapping a new project

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/camelburrito/keel/main/bootstrap.sh) my-new-app
cd my-new-app
# follow on-screen TODOs in docs/architecture/README.md, .env.*.example, firebase.json
```

## Keeping keel fresh

When a consuming project adds a significant new architecture (notifications, Android client, payments, etc.) or finds an improvement to an existing pattern:
1. Land it in the consuming project first, proven against its own tests.
2. Generalize it — strip every app-specific name, path, and identifier — and open a keel PR that adds/updates the matching `docs/playbook/<NN>-<system>.md` plus any vendorable pieces in `packages/`, `scripts/`, or `templates/`. See [recipes/upstream-an-improvement.md](recipes/upstream-an-improvement.md) for the agnosticism gate.
3. A consuming project's `playbook-coverage-on-new-architecture` ratchet enforces the reverse direction — adding a new arch doc there without a matching keel playbook entry trips the gate.

## Status

Bootstrapped 2026-06-04. **12 of 13 playbook entries 🟢 drafted** (01..12; 13 🟡 outlined). `@camelburrito/ratchet-kit` (v0.7.3 — 23 ratchet templates) and `@camelburrito/cf-utils` (v0.3.0 — logger, audit, rate-limit, idempotency, validation) are both implemented in `packages/`. See [docs/playbook/00-index.md](docs/playbook/00-index.md) for the full table of contents and per-entry status.
