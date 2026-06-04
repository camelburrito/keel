# keel

Private engineering baseline for production apps under `camelburrito/`.

`keel` is a **playbook + scaffolds + vendored packages** repository. It's the foundation every new production project starts from. The chorz family-chore app is the canonical reference implementation; the patterns proven there flow up into keel and back down into the next project.

## What's here

**`docs/playbook/`** — methodology docs (one per system). These capture the WHY and the structural assertions you must satisfy. They're instructions, not code. Refer back to chorz (`camelburrito/chorz`) for canonical reference implementations.

**`templates/`** — empty scaffolds that get copied into new projects at bootstrap time. POSIX-bash githooks, deny-all `firestore.rules`, base `tsconfig.json` / `eslint.config.js` / `vitest.config.ts`, parametrized GHA workflows, `.env.{staging,prod}.example` field conventions.

**`packages/`** — truly agnostic code, published to GitHub Packages as `@camelburrito/<pkg>`:
- `cf-utils` — logger with 7-layer PII redact pipeline, `writeWithAudit`, `idempotency`, `rateLimit`, `validation`, `wrapHandler` + `OAUTH_SECRET_FIELDS`
- `ratchet-kit` — `_ratchetHelpers` + ~22 structural ratchet templates as configurable functions

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

When chorz (or any reference project) adds a significant new architecture (notifications, Android client, payments, etc.):
1. Land it in the reference project first, with `docs/architecture/<system>.md`.
2. Open a PR on keel that adds the matching `docs/playbook/<NN>-<system>.md` and any vendorable pieces in `packages/` or `templates/`.
3. The `playbook-coverage-on-new-architecture` ratchet on the reference project enforces this — adding a new arch doc without a matching keel playbook entry trips the gate.

## Status

Bootstrapped 2026-06-04. Pilot playbook entry in flight: `05-observability-pii.md`. See [docs/playbook/00-index.md](docs/playbook/00-index.md) for the full playbook table of contents and draft status.
