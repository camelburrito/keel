# Recipe: Add a New Environment

Most projects need only `staging` and `prod`. Some grow to need `preview`, `qa`, or per-customer envs.

## Steps

1. **Create a new Firebase project** — e.g., `<APP>-preview`. Separate IAM, Firestore, Secret Manager. Don't try to overload an existing project.
2. **`.env.<APP>-preview` file** — copy `.env.staging.example`, fill in the new project's IDs. Add `VITE_APP_ENV=preview`.
3. **Custom domain (optional)** — `preview.<app>.org` + `auth.preview.<app>.org`. Wire DNS, Firebase Hosting, Auth domain.
4. **GHA workflow wrapper** — copy `staging-deploy.yml` to `preview-deploy.yml`. Bind to `preview` branch or `workflow_dispatch:` only.
5. **`npm run deploy:preview` script** — chain through `test:pre-release` like staging/prod.
6. **Per-env alert email** — add `<addr>+<app>-preview@gmail.com` notification channel via `scripts/setup-cf-alerts.sh --project=<APP>-preview`.
7. **Sentry env tag** — verify the new `VITE_APP_ENV=preview` value routes correctly in the Sentry project's environment filter.
8. **Update `docs/runbooks/observability.md`** with the per-env triage row for `preview`.

## What stays the same

- Source code (no env-conditional branches except `VITE_APP_ENV` reads).
- Firestore rules (deny-all + allowlist — identical across envs).
- Cloud Function code (per-env config via Secret Manager, not code).
- All ratchets, all tests.

## Anti-pattern to avoid

Don't use env flags within a single Firebase project ("staging is a /staging subcollection in prod Firestore"). It looks cheaper short-term and bites hard later — IAM mistakes leak prod data into staging tests, quotas mix, backup/restore gets complicated.

## Related playbook

- [11-staging-prod-environments.md](../docs/playbook/11-staging-prod-environments.md)
