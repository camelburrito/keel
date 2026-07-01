# Getting Started

A walkthrough for bootstrapping a new project from the keel baseline. Takes about 30 minutes from `git clone` to first deploy.

> Prefer skimming the playbook first if you haven't seen it: [`docs/playbook/00-index.md`](playbook/00-index.md). This doc is the hands-on companion that turns the playbook's WHY into a working repository.

## Prerequisites

Before you run anything, make sure the following are installed locally:

- **Node.js ≥ 20** — `node --version`. Use [`fnm`](https://github.com/Schniz/fnm) or [`nvm`](https://github.com/nvm-sh/nvm) if you need to switch.
- **npm ≥ 9** — ships with Node 20+.
- **git** — `git --version`. Set your global identity if you haven't:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email you@example.com
  ```
- **Firebase CLI** — `npm install -g firebase-tools` (≥ 13.0). Needed for emulators + deploys.

That's all — the agnostic `@camelburrito/*` packages keel installs are **public on npmjs**, so no access token or registry auth is needed to bootstrap.

## Step 1 — Run the bootstrap script

Clone keel (or symlink your local copy) and run the script with your new project's slug:

```bash
git clone git@github.com:camelburrito/keel.git ~/projects/keel
cd ~/projects
bash ~/projects/keel/bootstrap.sh my-app
```

What this does, in order:

1. Creates `~/projects/my-app/` and copies `templates/` into it (dotfiles included).
2. `chmod +x` the hooks + scripts so they're executable.
3. Replaces every `<APP>` placeholder in the templates with your slug (`my-app`) — package name, deploy targets, env-file names.
4. `git init -b main` + wires `core.hooksPath` to `.githooks/`.
5. Creates an initial commit (with `--no-verify` since `node_modules/` doesn't exist yet).
6. Runs `npm install` — pulls `@camelburrito/cf-utils` + `@camelburrito/ratchet-kit` from npmjs (public, no token needed).

You'll see something like:

```
[keel] Bootstrapping my-app at /Users/you/projects/my-app
[keel] Replacing <APP> placeholders with 'my-app'
[keel] Installing @camelburrito/cf-utils + @camelburrito/ratchet-kit (latest)
[keel] Done. Project ready at: /Users/you/projects/my-app

Next steps:
  cd my-app
  1. Review CLAUDE.md — workflow rules shipped from keel templates
  2. Fill in .env.my-app-staging + .env.my-app-prod from templates
  3. Create your two Firebase projects (my-app-staging + my-app-prod)
  ...
```

**Troubleshoot:**
- Slug invalid (`ERROR: project-name must match ^[a-z][a-z0-9-]*$`) — slugs must start with a lowercase letter and contain only lowercase letters, digits, hyphens.
- `npm install` 404 — the packages may have been retired or renamed. Check [npmjs.com/package/@camelburrito/ratchet-kit](https://www.npmjs.com/package/@camelburrito/ratchet-kit).
- Want to bootstrap without internet? Pass `--no-install`:
  ```bash
  bash ~/projects/keel/bootstrap.sh my-app . --no-install
  ```
  This skips `npm install`. Run it yourself when ready.

## Step 2 — Create your two Firebase projects

Keel assumes a staging/prod split (per [playbook 11](playbook/11-staging-prod-environments.md)). Spin up both now so the `.env.*` files have something real to point at:

```bash
firebase login   # if you haven't already
firebase projects:create my-app-staging
firebase projects:create my-app-prod
```

Then in each Firebase Console:
1. **Authentication** → Sign-in method → enable the providers you want (Google + Anonymous is a common starter).
2. **Firestore Database** → Create database → start in **production mode** (keel's templated `firestore.rules` denies all client access by default; you'll grant per-collection as you build features).
3. **Project Settings → General → Your apps** → add a Web app, copy the Firebase config snippet.

## Step 3 — Fill in `.env.*`

Templates are at `.env.my-app-staging.example` + `.env.my-app-prod.example`. Copy + populate:

```bash
cd ~/projects/my-app
cp .env.my-app-staging.example .env.my-app-staging
cp .env.my-app-prod.example .env.my-app-prod
```

Each file needs at minimum:
- `VITE_FIREBASE_API_KEY` + `VITE_FIREBASE_AUTH_DOMAIN` + `VITE_FIREBASE_PROJECT_ID` + `VITE_FIREBASE_APP_ID` + `VITE_FIREBASE_MESSAGING_SENDER_ID` (from the Firebase Console snippet)
- `VITE_APP_ENV` (`staging` or `prod`)
- `VITE_GIT_SHA` is injected by CI; leave empty locally

> **Never** commit `.env.*` files to git. Keel's templated `.gitignore` excludes them; the `.example` versions are the only ones that ship.

## Step 4 — Skim the workflow rules

Open `CLAUDE.md` at the project root. It shipped from keel's `templates/CLAUDE.md` and codifies the workflow discipline the keel reference projects developed over months: Ralph loop rules (NITs are merge gates, 3-clean exit, no pause between iters), PR conventions (ready-checklist before `gh pr create`, screenshot mandate for UI surfaces, `.planning/` in PR branch, ask before every merge), testing cadence (3-tier model, local-first gates, full suite at phase end), token discipline (snap onto closest existing token; no new tokens without approval), and more.

You don't have to memorize it — Claude Code loads CLAUDE.md into every conversation in this project. But skim it once so you know what's in there. Two sections need your input as the project grows:

- **§9 Project-specific commands** — fill in `npm run dev` / `npm run build` / etc. as your scripts solidify.
- **§11 Ratchet inventory** — verbatim list from `.githooks/pre-commit`; update whenever you add or retire a ratchet.

If a keel default doesn't fit your project, edit the rule explicitly with a comment explaining the deviation — don't let it drift silently.

## Step 5 — First feature

Now that the harness is wired, do something user-facing. The minimum viable feature for a new project is **sign in + greet the user**:

1. **Plan it** — per [playbook 01 GSD workflow](playbook/01-gsd-workflow.md), document the plan in `.planning/phases/001-sign-in-and-greet/` before writing code. For a tiny first feature this can be a single `PLAN.md` listing the 3-4 files you'll touch.
2. **Pick a token** — the first time you'd write a color or spacing value, add it to `shared/tokens/tokens.json` instead and run `npm run tokens:gen` (per [playbook 02 Design System](playbook/02-design-system.md)). Token discipline starts on day one — see `recipes/add-a-token.md` for the canonical add path. Token *values* come from a design tool (e.g. Stitch), not eyeballing — see `recipes/sync-design-system-from-a-design-tool.md` and playbook 02 § "The design source of truth".
3. **Pick a string** — same idea for user-facing text: add to `shared/strings/catalogs/en-US.json` and use `t('greeting.welcome')` from the generated helper (per [playbook 08 String Catalog](playbook/08-string-catalog-i18n.md)).
4. **Write the component** — `src/features/auth/SignInButton.tsx`, etc. Use the L4 atoms from your design system layer; don't compose raw `<button>` in feature code (the `noBarePrimitiveInFeatures`-style ratchet from ratchet-kit will catch it).
5. **Commit** — `git add . && git commit -m "Sign in + greet"`. The pre-commit hook runs your token check + tsc + the ratchet vitest list. If anything fails, fix the underlying issue (don't bypass with `--no-verify` per playbook 03).
6. **Push** — `git push -u origin main`. Pre-push runs `scripts/ci-local.sh` (the local mirror of CI).

## Step 6 — First Cloud Function

Keel's templates wire `functions/` (default codebase) up to the `@camelburrito/cf-utils` package. Add a `helloWorld` callable:

```typescript
// functions/src/hello/helloWorld.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { writeWithAudit, checkRateLimit } from '@camelburrito/cf-utils';

export const helloWorld = onCall(
  { region: 'us-central1', invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'sign-in required');
    await checkRateLimit(uid, 'helloWorld', 30);
    return { message: 'hello from cloud functions' };
  },
);
```

Wire it in `functions/src/index.ts`:

```typescript
export { helloWorld } from './hello/helloWorld';
```

The keel playbook 09 (Firebase stack) covers the deploy semantics. See `recipes/add-a-cloud-function.md` for the per-CF checklist (validation, rate limit, audit, tests).

## Step 7 — First deploy

Deploys are gated by `npm run test:pre-release` (the templated pre-release wall — see playbook 06):

```bash
# Verify locally first
npm run check:coverage   # vitest coverage gate
npm run test:e2e         # Playwright E2E suite

# Staging deploy
npm run deploy:staging
```

This runs:
1. `npm run test:pre-release` — coverage gate + E2E + ratchets
2. `firebase deploy --project my-app-staging` — Hosting + Functions + Firestore rules + Firestore indexes

After staging looks green for a soak period, ship to prod:

```bash
npm run deploy:prod
```

> **Don't skip the staging soak.** Per memory rule `feedback_staging_before_prod.md`, prod gets the change only after staging has been running it for a defined period. Set your own bar (24h is typical for a single-developer project).

## Step 8 — Wire your first ratchet

Keel ships `@camelburrito/ratchet-kit` with 23 graduated ratchets (as of v0.7.4). The templated `.githooks/pre-commit` already runs a default set. To add one of your own:

```typescript
// src/__tests__/no-bare-foo-in-features.test.ts
import { describe, it } from 'vitest';
import { noBareHexInTsx } from '@camelburrito/ratchet-kit';
import path from 'node:path';

describe('no-bare-foo-in-features', () => {
  it('passes', () => {
    noBareHexInTsx({
      root: path.join(__dirname, '..'),
      extensions: ['.tsx', '.ts'],
      ignoredPrefixes: ['ui/'],
      expectedCounts: {},   // strict-zero
    });
  });
});
```

Add the test file path to BOTH `.githooks/pre-commit` AND `.github/workflows/test-coverage.yml` "Design System Ratchets" step. The `ratchetListPrecommitVsWorkflow` drift gate (also from ratchet-kit) enforces that the two lists stay in sync.

See `recipes/add-a-ratchet.md` for the canonical full walkthrough.

## Where to go next

By now you have:
- A working repo on staging
- Token + string catalog discipline wired
- Pre-commit + pre-push gates active
- 1 Cloud Function shipped end-to-end
- 1 ratchet of your own

Per-system deep-dives live in the [playbook](playbook/00-index.md):

| You want to... | Read |
|----------------|------|
| Add a new feature using the GSD workflow | [01 GSD](playbook/01-gsd-workflow.md) |
| Touch the design system | [02 Design System](playbook/02-design-system.md) |
| Understand the CI/CD philosophy | [03 CI/CD](playbook/03-ci-cd.md) |
| Document an arch decision | [04 Architecture Docs](playbook/04-architecture-docs.md) |
| Wire observability + PII redaction | [05 Observability + PII](playbook/05-observability-pii.md) |
| Set up your testing cadence | [06 Testing Cadence](playbook/06-testing-cadence.md) |
| Add another ratchet | [07 Ratchet Framework](playbook/07-ratchet-framework.md) |
| Add a locale | [08 String Catalog](playbook/08-string-catalog-i18n.md) |
| Add another Cloud Function | [09 Firebase Stack](playbook/09-firebase-stack.md) |
| Set up PR screenshots | [10 Screenshot Workflow](playbook/10-screenshot-workflow.md) |
| Add another environment (preview / dev / etc.) | [11 Staging & Prod](playbook/11-staging-prod-environments.md) |

For task-shaped how-tos see [`recipes/`](../recipes/). For pre-merge / pre-deploy / pre-launch checklists see [`checklists/`](../checklists/).

If anything in this walkthrough drifted from reality (a template changed, a script renamed, a step no longer works), open an issue or PR against keel — the bootstrap path is load-bearing and stale instructions there break adoption.
