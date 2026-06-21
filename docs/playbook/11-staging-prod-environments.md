# 11 — Staging & Prod Environments

**Status:** 🟢 drafted

---

## The principle

Multi-environment deploys are where most projects accumulate footguns: env flags that drift between envs, staging that doesn't catch prod-only bugs, OAuth client secrets mixed across projects, paths-filter shallow-clone traps that silently no-op release cuts, ad-hoc deploy commands that bypass the test wall. The patterns that earn their keep across products:

- **Two separate Firebase projects**, not env flags within one. Separate IAM, Firestore, Secret Manager, quotas. Real isolation.
- **Release-branch cumulative-state cuts.** `git push origin main:release` triggers prod cut; `always_deploy: true` ensures large jumps (multi-week accumulation) deploy fully even when paths-filter would otherwise silently no-op.
- **Per-env tagging.** Sentry env tag (`VITE_APP_ENV`), per-env analytics measurement IDs, per-env Gmail-`+tag` alert aliases.
- **Structurally-gated deploy scripts.** `npm run deploy:{staging,prod}` chain through `test:pre-release`. No `--skip-tests` flag exists. Defended by `deploy-scripts-gated-by-pre-release` ratchet.
- **Staging-before-prod rule.** Every prod deploy is preceded by a staging deploy + soak window. Catches deploy-shape drift that local-CI can't (lockfile drift, tarball non-determinism, indices missing).

---

## What you must satisfy

- Two separate Firebase projects (`<app>-staging`, `<app>-prod`). Never share a project between envs.
- `.env.<app>-{staging,prod}` files carrying per-env config. Gitignored. Locally configured.
- GHA workflow shape: `_deploy.yml` (callable template) + `staging-deploy.yml` + `prod-deploy.yml` (wrappers).
- `prod-deploy.yml` declares `workflow_dispatch:` for manual recovery + `always_deploy: true` for cumulative-state release cuts.
- All `paths-filter` callers use `actions/checkout@v4` with `fetch-depth: 0`. Defended by `no-paths-filter-without-fetch-depth-zero` ratchet.
- `scripts/verify-deploy-shape.sh` simulates upload-isolated `npm ci` + entry-point load per codebase.
- `npm run deploy:{staging,prod}` chain into `test:pre-release` (Tier 3 wall). Defended by `deploy-scripts-gated-by-pre-release` ratchet.
- Per-env Gmail-`+tag` alert aliases (`<addr>+<app>-{staging,prod}@gmail.com`).
- `lockfile-sync-with-package-json` + `cf-utils-tarballs-committed` ratchets defending the deploy-shape invariants pre-commit.
- A standing rule: always deploy to staging before prod.

---

## 2. Two Firebase projects, not env flags

The anti-pattern (don't): one Firebase project, env flags decide which subcollection (`/staging/...` vs `/prod/...`) writes go to. Looks cheaper to set up; bites hard later:

- IAM mistakes leak prod data into staging tests (or vice versa).
- Quotas mix — a staging-tier load test consumes prod-tier quota.
- Backup/restore becomes complicated (you'd restore staging + prod state in one operation).
- Cloud Logging blends env signals (Sentry env tag becomes the only differentiator).
- Secret Manager has one set of credentials shared across envs.

The pattern (do): two separate Firebase projects. Separate IAM. Separate Firestore. Separate Secret Manager. Separate quotas. Real isolation. Costs ~$0 incremental on Spark/Blaze tier (you only pay for what's used; idle projects cost nothing).

---

## 3. `.env.<project>` field convention

```
.env.<app>-staging.example                # template (committed)
.env.<app>-prod.example                    # template (committed)
.env.<app>-staging                         # filled, gitignored
.env.<app>-prod                            # filled, gitignored
```

Required fields:
- `VITE_APP_ENV={staging|prod}` — Sentry env routing.
- `VITE_FIREBASE_AUTH_DOMAIN=auth.[staging.]<your-domain>` — custom auth subdomain per env.
- `VITE_FIREBASE_*` — per-project Firebase web SDK config (auto-rotated when you regenerate the web app config in Firebase Console).
- `VITE_SENTRY_DSN` — per-env Sentry DSN (or one DSN with env tagging via `VITE_APP_ENV`).
- `VITE_GA_MEASUREMENT_ID` — per-env Google Analytics measurement ID.
- `SENTRY_DSN` — CF-side observability (consumed by `firebase deploy --only functions`).

---

## 4. Custom domain split

```
<your-domain>                             ← prod web app
staging.<your-domain>                     ← staging web app
auth.<your-domain>                        ← prod Firebase Auth domain
auth.staging.<your-domain>                ← staging Firebase Auth domain
```

The auth subdomain split matters for OAuth redirect URIs — each Google OAuth client app has a fixed callback host, and mixing envs across one host complicates the consent screen. Per-env auth subdomain = per-env OAuth client = clean isolation.

DNS records + Firebase Hosting + Firebase Auth domain settings all need wiring per-env. Done once at setup; rarely touched after.

---

## 5. GHA workflow shape

```
.github/workflows/
├── _deploy.yml              ← callable template (parametrized: project, environment, always_deploy)
├── staging-deploy.yml       ← caller on push to main; runs paths-filter
├── prod-deploy.yml          ← caller on push to release + workflow_dispatch; always_deploy: true
└── test-coverage.yml        ← PR + push gate; runs ratchets + coverage + integration
```

The callable template (`_deploy.yml`) accepts inputs:
- `project: <app>-{staging|prod}`
- `environment: {staging|prod}`
- `always_deploy: boolean` — skip paths-filter check, deploy unconditionally

Staging is paths-filtered (only deploys client OR server if relevant files changed) to keep CI minutes low. Prod is always-deploy (cumulative-state cuts).

---

## 6. Release-branch cumulative-state pattern

The prod deploy flow:

```
main branch (rolling)
    │
    │ accumulate N PRs over a week
    │
    ▼
git push origin main:release        ← release cut
    │
    │ prod-deploy.yml fires
    │ always_deploy: true ensures full deploy
    │
    ▼
<app>-prod gets the cumulative state
```

**Why `always_deploy: true` is load-bearing:** `dorny/paths-filter@v3` diffs `event.before..event.sha` to detect changed files. If the release cut is a large multi-commit jump from the previous release, paths-filter's shallow-clone fallback returns "no changes" and silently no-ops. Without `always_deploy: true`, your prod release cut deploys nothing while reporting success. This is a real war story: a release cut spanning many weeks of accumulated commits silently shipped nothing. The fix added the `no-paths-filter-without-fetch-depth-zero` ratchet (forcing `fetch-depth: 0` so paths-filter can reach `event.before`) + `always_deploy: true` on prod.

**Manual recovery via `workflow_dispatch:`** — if anything misbehaves, an operator triggers a manual prod deploy from the GHA UI. Belt-and-braces alongside automatic release-cut deploys.

---

## 7. Per-env alert routing

**Gmail-`+tag` aliases:** `<addr>+<app>-staging@gmail.com` + `<addr>+<app>-prod@gmail.com`. Gmail treats both as `<addr>@gmail.com` but the `+tag` lets you filter on tag → label → folder. One Gmail account, infinite per-env aliases.

`scripts/setup-cf-alerts.sh --project=<app>-{staging,prod}` (idempotent gcloud wrapper) creates per-env GCP notification channels with the appropriate `+tag` alias. Run once per env at setup. See [05-observability-pii.md § 7.2](05-observability-pii.md).

---

## 8. `verify-deploy-shape.sh` — the deep preflight

Local CI runs Tier 1/2/3/4 tests against your dev environment. None of that catches deploy-shape drift:
- Lockfile out-of-sync with `package.json` for a CF codebase (`npm ci` would EUSAGE in Cloud Build).
- A workspace-package tarball (e.g., `cf-utils.tgz`) regenerated with a new sha512 vs. the lockfile integrity field — a real cross-machine non-determinism war story where the committed bytes' sha became unrecoverable to Cloud Build's `npm ci`.
- An entry-point file (e.g., `functions/lib/index.js`) failing to resolve a dependency at load time.

`scripts/verify-deploy-shape.sh` simulates the upload-isolated install per codebase:
1. For each `firebase.json` codebase, copy the source tree to a temp dir.
2. `npm ci` in the temp dir using ONLY that codebase's lockfile.
3. `require()` the entry point to verify load-time resolution.
4. Report PASS/FAIL per codebase.

Two ratchets defend the inputs:
- `lockfile-sync-with-package-json` — every CF codebase's `package-lock.json` carries entries for every dep in `package.json`.
- `cf-utils-tarballs-committed` — every codebase's workspace-package tarball sha512 matches the lockfile integrity field.

The script runs in `ci-local.sh` STEP 3.5 + the GHA workflow. The ratchets catch faster (pre-commit), but the script catches the cases ratchets can't (entry-point resolution at install-time).

---

## 9. The pre-release wall + deploy-script ratchet

```json
// package.json
{
  "scripts": {
    "test:pre-release": "npm run check:coverage && npm run test:e2e",
    "deploy:staging": "npm run test:pre-release && firebase deploy --project <app>-staging",
    "deploy:prod": "npm run test:pre-release && firebase deploy --project <app>-prod"
  }
}
```

The `&&` chain is structural — `firebase deploy` only fires if `test:pre-release` exits 0. The `deploy-scripts-gated-by-pre-release` strict-zero ratchet parses `package.json` and asserts every `deploy:*` script begins with `npm run test:pre-release &&`. Silent un-gating fails pre-commit.

**No `--skip-tests` flag.** An explicit rejection: any escape valve becomes the new default during incidents. Better to fix the test under pressure.

---

## 10. Staging-before-prod rule

Every prod deploy is preceded by a staging deploy + soak window:
- Trivial changes: 30 min soak.
- Schema/migration changes: 24h+ soak; manual UAT walkthrough.

Why structural-but-not-automated: the test wall catches behavioral regressions, the verify-deploy-shape catches install-time drift, but **only a staging deploy catches Firestore-index drift** (the emulator silently allows ad-hoc indexes; production fails). War story: two separate index-drift bugs both surfaced as `FAILED_PRECONDITION` errors in staging — well before they would have hit prod.

This is a standing rule worth codifying in team norms: never skip staging.

---

## 11. CI-quota-cliff fallback

`scripts/post-local-ci-status.cjs` posts green statuses to the PR via GitHub Status API when GHA is down (free-tier monthly-minute cap blown — a recurring failure mode on free CI tiers). Without this, every PR shows red checks during quota outages even though local CI is green.

See [03-ci-cd.md § 5](03-ci-cd.md) for the full pattern.

---

## 12. Operational checklist (per deploy)

Use [checklists/pre-deploy-checklist.md](../../checklists/pre-deploy-checklist.md):
- Local gates green (`ci-local.sh`).
- Deploy-shape verified (`verify-deploy-shape.sh`).
- Indexes shipped if changed (`firebase deploy --only firestore:indexes`).
- Staging deployed + soaked.
- Cloud Logging clean for the staging window.
- Rollback plan known.

---

## 13. Adopting this playbook

- [ ] Two Firebase projects created (`<app>-staging`, `<app>-prod`).
- [ ] `.env.<app>-{staging,prod}.example` templates filled in for your project.
- [ ] Custom domain DNS + Firebase Hosting + Auth domain settings wired per env.
- [ ] GHA workflows from templates (`_deploy.yml` + `staging-deploy.yml` + `prod-deploy.yml`).
- [ ] `actions/checkout@v4` with `fetch-depth: 0` on all paths-filter callers; `no-paths-filter-without-fetch-depth-zero` ratchet wired.
- [ ] `scripts/verify-deploy-shape.sh` skeleton from template; `lockfile-sync-with-package-json` + `cf-utils-tarballs-committed` ratchets wired.
- [ ] `npm run deploy:{staging,prod}` scripts chained through `test:pre-release`; `deploy-scripts-gated-by-pre-release` ratchet wired.
- [ ] Per-env Gmail `+tag` aliases created; `scripts/setup-cf-alerts.sh` run for both envs.
- [ ] `scripts/post-local-ci-status.cjs` wired into pre-push for quota-cliff days.
- [ ] Team norms: always deploy to staging before prod; avoid bypassing CI gates during outages.

---

## Reference reading

- `.github/workflows/_deploy.yml` — callable template
- `.github/workflows/staging-deploy.yml` + `.github/workflows/prod-deploy.yml` — env wrappers
- `scripts/verify-deploy-shape.sh` — upload-isolated simulation
- `scripts/post-local-ci-status.cjs` — quota-cliff fallback
- `scripts/setup-cf-alerts.sh` — per-env alert wiring
- `src/__tests__/deploy-scripts-gated-by-pre-release.test.ts` — pre-release-gate defender
- `src/__tests__/no-paths-filter-without-fetch-depth-zero.test.ts` — shallow-clone trap defender
- `src/__tests__/lockfile-sync-with-package-json.test.ts` — lockfile drift defender
- `src/__tests__/cf-utils-tarballs-committed.test.ts` — tarball integrity defender
- `docs/runbooks/observability.md` — per-env Tier 1/2/3 triage flow
- Recipe: [recipes/add-a-new-environment.md](../../recipes/add-a-new-environment.md)

---

**Last updated:** 2026-06
