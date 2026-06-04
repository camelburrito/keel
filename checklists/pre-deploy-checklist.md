# Pre-Deploy Checklist

For any `npm run deploy:staging` or `npm run deploy:prod`.

## Local gates

- [ ] `bash scripts/ci-local.sh` is green (full mirror if native changes, `--skip-native` otherwise).
- [ ] `npm run check:coverage` passes per-workspace floors.
- [ ] `npm run test:pre-release` is green (the Tier 3 wall the deploy scripts chain through).

## Deploy-shape verification

- [ ] `bash scripts/verify-deploy-shape.sh` passes for every Cloud Functions codebase listed in `firebase.json`. Catches lockfile-integrity drift before Cloud Build does.
- [ ] `lockfile-sync-with-package-json` ratchet is green.
- [ ] All committed `cf-utils.tgz` sha512s match their lockfile integrity entries (defended by `cf-utils-tarballs-committed`).

## Index discipline

- [ ] Any new `.collectionGroup()` query has a matching entry in `firestore.indexes.json` (defended by `no-unindexed-collectiongroup-query` class A).
- [ ] Any new `fieldOverride` that disables COLLECTION-scope is paired with a re-added COLLECTION-scope auto-index (defended by class B).
- [ ] Any new composite `.where().where()` chain has a matching composite index.
- [ ] `firebase deploy --only firestore:indexes` is in the deploy plan if any index changed.

## Staging before prod

- [ ] `npm run deploy:staging` ran first.
- [ ] Staging soak window passed (≥30 min for non-trivial changes, ≥24h for migration-class changes).
- [ ] Manual UAT walkthrough completed if the change affects user-visible flows.
- [ ] Cloud Logging is clean for the staging-deploy window (no new error groups, no PII drift).

## Secret discipline

- [ ] No secrets in env files or code. All sensitive values in Secret Manager.
- [ ] Per-env OAuth client secrets verified in GCP Secret Manager (not mixed across projects).
- [ ] `.env.<APP>-{staging,prod}` files are gitignored and locally configured.

## Runbook readiness

- [ ] `docs/runbooks/observability.md` is current for any new alert thresholds or new CFs.
- [ ] On-call has access to the new Cloud Logging filters / Sentry projects.

## Rollback plan

- [ ] You know how to roll back: the previous prod deploy's git SHA + the `firebase hosting:rollback` command + the per-CF previous-revision invocation.
- [ ] If migrations are involved, the migration is reversible OR you accept that you can't roll back DB state.

## Related playbook

- [11-staging-prod-environments.md](../docs/playbook/11-staging-prod-environments.md)
- [03-ci-cd.md](../docs/playbook/03-ci-cd.md)
- [09-firebase-stack.md](../docs/playbook/09-firebase-stack.md)
