# 10 — Screenshot Workflow

**Status:** 🟢 drafted

---

## The principle

DOM-replica screenshot tools lie. A button that renders correctly in a Playwright DOM snapshot can still ship visually broken because the real app pulls live backend data, runs real auth, depends on real layout cascades, applies real i18n, and resolves real design-token CSS variables. **Screenshots for PR review must come from the real app running against seeded emulators** — not a parallel render.

Two anti-patterns this fixes:

1. **Storybook/DOM-replica-only proofs.** Catches simple cases; misses everything that depends on real data shape or real layout cascade.
2. **Committing PNGs to the main repo.** Binary churn rots history; every PR with screenshots bloats the repo. The right home is a separate, dedicated screenshots repo.

Hosting model: a **dedicated screenshots repo** (sibling private repo, e.g. `<org>/<app>-screenshots`). One folder per PR (`pr-<NNN>/`). Images live on `main`, NOT orphan branches (orphan branches are unreviewable and accumulate). PR descriptions reference images via `github.com/<org>/<repo>/raw/...` URLs (session auth), NOT `raw.githubusercontent.com` (anonymous; breaks for private repos).

---

## What you must satisfy

- A `.claude/skills/pr-ui-screenshots/` skill (or equivalent runbook) per project — emulator-seed pattern + capture script + push-to-screenshots-repo flow.
- A dedicated screenshots repo (`<org>/<app>-screenshots`) — one folder per PR (`pr-<NNN>/`), images on `main`.
- Image URLs in PR descriptions use `github.com/<org>/<repo>/raw/...` (session auth), NOT `raw.githubusercontent.com` (breaks for private).
- Every PR that touches a visual surface ships screenshots before "ready" status — enforced by checklist habit.
- Capture pattern: spin up emulators → seed admin/non-admin test data → Playwright/native tooling navigates the real app → `page.screenshot()` (or native capture) → push to the screenshots repo `pr-<NNN>/<scenario>.png`.
- The pre-merge UI checklist (`checklists/pre-merge-ui-checklist.md`) lists screenshot requirements; write the 4-item PR-ready checklist before `gh pr create`.

---

## 2. Why DOM replicas don't suffice

Failure modes the real-app screenshot pattern catches:

- **Real data shape.** A card that renders fine with a 3-character mock name breaks with a 40-character real name. Real seed data carries realistic shape.
- **Real auth state.** Route guards (e.g. `RequireAuth`, role-gated guards) determine which surfaces render. DOM replicas often skip auth; you see surfaces that wouldn't be visible to the actual user.
- **Real layout cascade.** A bug where parent CSS overrides a child's design token isn't visible in an isolated component snapshot.
- **Real i18n.** A surface that's pixel-perfect in `en-US` can overflow in another locale (Spanish averages ~30% longer). DOM replicas usually use English mocks.
- **Real CSS custom prop resolution.** Token misconfigurations only show up when the full stylesheet cascade resolves.

A `pr-ui-screenshots` skill encodes the emulator-seed-then-Playwright pattern. The cost is ~30s additional per scenario vs. a DOM replica (~1s). The win is screenshots that match what the user actually sees.

---

## 3. Dedicated-repo hosting pattern

```
<org>/<app>                      ← main repo (private)
<org>/<app>-screenshots          ← dedicated screenshots repo (private)
  └── main branch
       ├── pr-101/
       │   ├── dashboard-empty.png
       │   ├── dashboard-with-data.png
       │   └── settings-view.png
       ├── pr-102/
       │   └── …
       └── pr-103/
           └── …
```

**Why a separate repo, not the main repo:**
- Binary churn rots `git log` and inflates clone times.
- The main repo's branch protection rules would otherwise need carve-outs for PNG-only commits.
- Screenshot review is independent of code review (different cadence, different reviewers possibly).

**Why `main` branch and not orphan branches:**
- Orphan branches are unreviewable and accumulate forever.
- `pr-<NNN>/` folder organization is more discoverable than a branch name lookup.
- Easy to clean up old PRs' folders periodically without touching git refs.

---

## 4. The private-URL gotcha

PR descriptions reference images via URLs. There are two URL shapes — only one works for private repos:

- ✅ **`https://github.com/<org>/<repo>/raw/main/pr-<NNN>/<image>.png`** — uses session auth. Reviewer's logged-in GitHub session is the authentication context. Works for private repos.
- ❌ **`https://raw.githubusercontent.com/<org>/<repo>/main/pr-<NNN>/<image>.png`** — anonymous URL. Works only for public repos. Returns 404 for private; the PR shows broken image icons.

Always use the `github.com/.../raw/...` shape.

---

## 5. Emulator-seed-then-capture flow (web Playwright)

```
1. Spin up emulators (background process):
   firebase emulators:start --only auth,firestore,functions,hosting

2. Wait for "All emulators ready"

3. Seed via Playwright fixture or seed script:
   - Seed an admin user plus the domain entities in canonical shapes
   - Spin up emulators + seed your own data; don't rely on existing
     staging data.

4. Capture spec runs Playwright:
   - test('dashboard-empty', async ({ page }) => {
       await page.goto('/_harness/dashboard?seed=empty');
       await page.screenshot({ path: 'pr-101/dashboard-empty.png' });
     });

5. Push screenshots to the screenshots repo via git-worktree pattern:
   - git worktree add ../app-screenshots-worktree main
   - cp pr-101/*.png ../app-screenshots-worktree/pr-101/
   - (cd ../app-screenshots-worktree && git add . && git commit && git push)
   - git worktree remove ../app-screenshots-worktree

6. Update PR description with github.com/.../raw/... URLs
```

The git-worktree pattern keeps screenshot commits out of the feature branch's history.

---

## 6. Per-platform variants

### Web (Playwright)

Pattern above. An `e2e/screenshot-harness/` directory holds the capture specs. Harness routes (`/_harness/<screen>?seed=...`) bypass auth for capture; production routes use seeded auth tokens.

### iOS (swift-snapshot-testing for tests, manual Xcode capture for review)

- **For test-side regression catching:** `swift-snapshot-testing` snapshots in the UI test target. Per-atom, per-component, per-locale variants. Reference snapshots committed to the test target's resources directory.
- **For PR-review screenshots:** manual Xcode capture from the simulator. Pasted into the PR description with the same `github.com/.../raw/...` URL pattern after upload to the screenshots repo.

The iOS-tests-only approach (no PR-review screenshots) would miss the design-intent review step that catches visual regressions before merge. Both patterns coexist; the test snapshots catch automated regressions, the PR-review screenshots catch design-intent drift.

### Android (when it lands)

Likely `paparazzi` (JVM-based, no emulator needed) for test snapshots; manual Android Studio capture for PR review. Same dedicated-repo hosting.

---

## 7. PR description format

```markdown
## Summary
<1-3 bullets>

## Screenshots
**Dashboard — empty state**
![dashboard-empty](https://github.com/<org>/<app>-screenshots/raw/main/pr-101/dashboard-empty.png)

**Dashboard — with data**
![dashboard-with-data](https://github.com/<org>/<app>-screenshots/raw/main/pr-101/dashboard-with-data.png)

**Settings view**
![settings-view](https://github.com/<org>/<app>-screenshots/raw/main/pr-101/settings-view.png)

## Test plan
- [ ] …
```

The `![alt](url)` markdown shape renders as an inline image in the PR description. Reviewers see them without clicking.

---

## 8. The git-worktree upload pattern

```bash
# From the main repo working directory:
git worktree add ../<app>-screenshots-worktree main          # mount the screenshots repo
cp -r screenshots/pr-101/. ../<app>-screenshots-worktree/pr-101/
cd ../<app>-screenshots-worktree
git add pr-101/
git commit -m "pr-101 screenshots"
git push origin main
cd -
git worktree remove ../<app>-screenshots-worktree
```

Worktree lets you operate on the screenshots repo without `cd` chaos and without leaving the main repo's state perturbed. Cleanup via `git worktree remove` is idempotent.

---

## 9. Pre-merge UI checklist cross-reference

The pre-merge UI checklist asks: "Visual proof — does the PR include real-app screenshots?" If no, the PR isn't ready. The checklist also requires the URL shape (`github.com/.../raw/...`) be used. See [checklists/pre-merge-ui-checklist.md](../../checklists/pre-merge-ui-checklist.md).

---

## 10. Adopting this playbook

- [ ] Dedicated screenshots repo created (`<org>/<app>-screenshots`).
- [ ] `.claude/skills/pr-ui-screenshots/SKILL.md` written, capturing the emulator-seed-then-capture flow.
- [ ] `e2e/screenshot-harness/` directory with at least one capture spec.
- [ ] Harness routes wired into the app (e.g., `/_harness/*` paths that bypass auth for seed-driven capture).
- [ ] Pre-merge UI checklist references the screenshot requirements.

---

**Last updated:** 2026-06-21
