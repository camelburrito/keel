# keel

App-agnostic engineering baseline for production apps under `camelburrito/`.

`keel` is a **standalone, app-agnostic playbook + scaffolds + vendored packages** repository. It's the foundation every new production project starts from. Patterns are proven in real production projects, generalized here so they carry no app-specific detail, and flow back into keel through an app-agnostic upstreaming process (see [recipes/upstream-an-improvement.md](recipes/upstream-an-improvement.md)). keel names no specific downstream project; any project (current or future) is just a consumer.

## What's here

**`docs/playbook/`** — methodology docs (one per system). These capture the WHY, the structural assertions you must satisfy, and the generic pattern itself. They are self-contained and app-agnostic — the only paths they contain are generic conventions (e.g. `functions/src/`).

**`docs/architecture/`** — how keel *itself* is built (the baseline's own architecture: artifact layers, copy-vs-publish distribution, the upstreaming loop). Authored under keel's own [arch-doc convention](docs/playbook/04-architecture-docs.md) and self-validated by it (`scripts/check-arch-docs.mjs`). The playbook documents patterns for a consuming project; these document keel.

**`templates/`** — empty scaffolds that get copied into new projects at bootstrap time. POSIX-bash githooks, deny-all `firestore.rules`, base `tsconfig.json` / `eslint.config.js` / `vitest.config.ts`, parametrized GHA workflows, `.env.{staging,prod}.example` field conventions.

**`packages/`** — truly agnostic code, published to GitHub Packages as `@camelburrito/<pkg>`:
- `cf-utils` — logger with 7-layer PII redact pipeline, `writeWithAudit`, `idempotency`, `rateLimit`, `validation`, `wrapHandler` + `OAUTH_SECRET_FIELDS`
- `ratchet-kit` — shared ratchet helpers + 23 structural ratchet templates as configurable functions

**`scripts/`** — agnostic build/CI/audit scripts (parametrized): `ci-local.sh` skeleton, `gen-strings.mjs`, `gen-tokens.mjs`, `audit-cloud-logging-pii.mjs`, `predeploy-pack-cf-utils.sh`.

**`recipes/`** — "how to add X" guides (new ratchet, new architecture doc, new CF, new locale, new environment) plus [upstream-an-improvement.md](recipes/upstream-an-improvement.md), the app-agnostic contribution gate.

**`checklists/`** — pre-launch, pre-merge, pre-deploy checklists.

## Distribution model

- Source is available under the [PolyForm Noncommercial License](LICENSE) — free for any noncommercial use; commercial/business use is not permitted (see [License](#license)).
- Agnostic packages publish to **GitHub Packages** as `@camelburrito/*`. Consuming projects add `.npmrc` with a GitHub PAT and `npm install` normally.
- `templates/` is **copied** at bootstrap (`bootstrap.sh` rsyncs it in; a project's own copy is allowed to drift). The playbook, recipes, and checklists are **reference** — read in place or browsed on GitHub, not stamped into the project.

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

Bootstrapped 2026-06-04. **12 of 13 playbook entries 🟢 drafted** (01..12; 13 🟡 outlined). `@camelburrito/ratchet-kit` (v0.7.3 — 23 ratchet templates) and `@camelburrito/cf-utils` (v0.3.1 — logger, audit, rate-limit, idempotency, validation) are both implemented in `packages/`. See [docs/playbook/00-index.md](docs/playbook/00-index.md) for the full table of contents and per-entry status.

## License

keel is **source-available** under the [PolyForm Noncommercial License 1.0.0](LICENSE) — you may use, modify, and share it for **any noncommercial purpose** (personal and hobby projects, research, education, nonprofits, public-sector and other noncommercial organizations). **Commercial / business use is not permitted** under this license. A noncommercial license is not an OSI "open source" license (which forbids field-of-use limits), so keel carries no open-source badge by design; the intent is to let others learn from and build on it for non-business use.
