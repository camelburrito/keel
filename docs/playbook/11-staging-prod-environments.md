# 11 — Staging & Prod Environments

**Status:** 🟡 outlined
**Reference impl:** `chorz/.github/workflows/_deploy.yml`, `chorz/.github/workflows/{staging,prod}-deploy.yml`, `chorz/.env.<project>` files, `chorz/scripts/verify-deploy-shape.sh`

## Why this exists

Multi-environment deploys are where most projects accumulate footguns: env flags that drift, staging that doesn't catch prod-only bugs, OAuth client secrets that get mixed across projects, paths-filter shallow-clone traps that silently no-op release cuts. The patterns that earn their keep across products: **two separate Firebase projects** (not env flags within one), **release-branch cumulative-state cuts**, **per-env Sentry/Analytics tagging**, and **structurally-gated deploy scripts** that can't run without passing the Tier 3 wall.

## What you must satisfy

- **Two Firebase projects** — `<app>-staging` for dev/soak, `<app>-prod` for production. Separate IAM, Firestore, Secret Manager, quotas. Never share a project between envs.
- **`.env.<project>` files** carrying:
  - `VITE_APP_ENV=staging|prod` (Sentry env routing)
  - `VITE_FIREBASE_AUTH_DOMAIN=auth.<app>.org` or `auth.staging.<app>.org` (custom auth subdomain per env)
  - Per-env analytics measurement ID
  - Per-env Sentry DSN binding (for CF-side observability)
- **GHA workflow shape:**
  - `_deploy.yml` — callable workflow template with `project`, `environment`, `always_deploy` inputs.
  - `staging-deploy.yml` — caller on push to `main`, runs paths-filter.
  - `prod-deploy.yml` — caller on push to `release` branch + `workflow_dispatch:` for manual recovery. `always_deploy: true` ensures cumulative-state release cuts (93-commit jumps) don't get silently no-op'd by shallow-clone paths-filter.
  - All `paths-filter` callers run on `actions/checkout@v4` with `fetch-depth: 0` (defended by `no-paths-filter-without-fetch-depth-zero` ratchet).
- **Release-branch cumulative-state pattern** — `git push origin main:release` triggers prod cut; cumulative state ensures large jumps deploy cleanly.
- **Per-env Gmail-`+tag` alert aliases** — e.g., `<addr>+<app>-staging@gmail.com` and `<addr>+<app>-prod@gmail.com` so per-env alerts route to filtered Gmail labels.
- **Deploy-shape verification** — `scripts/verify-deploy-shape.sh` simulates the upload-isolated `npm ci` + entry-point load per codebase. Catches lockfile drift before Cloud Build does.
- **Structurally gated deploy scripts** — `npm run deploy:{staging,prod}` chain into `test:pre-release` (Tier 3 wall). Defended by `deploy-scripts-gated-by-pre-release` ratchet. NO `--skip-tests` flag.
- **Staging-before-prod rule** — every prod deploy is preceded by a staging deploy + soak window. Catches deploy-shape drift that local-CI can't (lockfile mismatch, tarball non-determinism, indices missing).

## Sections (TODO when drafted)

1. Two-Firebase-projects philosophy (why not env flags within one project)
2. `.env.<project>` field convention + secret discipline (Secret Manager vs env vars)
3. Custom domain split (`<app>.org`, `staging.<app>.org`, `auth.<app>.org`, `auth.staging.<app>.org`)
4. GHA workflow shape (callable template + per-env wrappers + paths-filter discipline)
5. Release-branch cumulative-state pattern + when `always_deploy: true` is load-bearing
6. Per-env alert routing (Gmail aliases + GCP notification channels)
7. `verify-deploy-shape.sh` — the slow, thorough preflight
8. Pre-release gate + the deploy-script ratchet
9. GHA-quota-cliff fallback (`scripts/post-local-ci-status.cjs`)
10. Recipe: adding a new environment — see [recipes/add-a-new-environment.md](../../recipes/add-a-new-environment.md)

## Reference reading

- `chorz/.github/workflows/_deploy.yml` — callable template
- `chorz/.github/workflows/staging-deploy.yml` + `prod-deploy.yml` — env wrappers
- `chorz/scripts/verify-deploy-shape.sh` — upload-isolated simulation
- `chorz/scripts/post-local-ci-status.cjs` — quota-cliff fallback
- `chorz/src/__tests__/deploy-scripts-gated-by-pre-release.test.ts` — ratchet locking the pre-release gate
- `chorz/src/__tests__/no-paths-filter-without-fetch-depth-zero.test.ts` — shallow-clone trap defender
- `chorz/docs/runbooks/observability.md` — per-env Tier 1/2/3 triage flow
