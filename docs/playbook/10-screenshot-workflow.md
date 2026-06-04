# 10 — Screenshot Workflow

**Status:** 🟡 outlined
**Reference impl:** `chorz/.claude/skills/pr-ui-screenshots/`, `camelburrito/chorz-screenshots`

## Why this exists

DOM-replica screenshot tools lie. A button that renders correctly in a Playwright DOM snapshot can still ship visually broken because the real app pulls Firebase data, runs real auth, depends on real layout cascades. Screenshots for PR review must come from the **real app** running against **seeded emulators** — not a parallel render. And they must NOT live in the main repo (binary churn rots history); they live in a sibling private repo at `<org>/<app>-screenshots` and are referenced from PRs via private-repo image URLs.

## What you must satisfy

- A `.claude/skills/pr-ui-screenshots/` skill (or equivalent runbook) per project — emulator-seed pattern + capture script + push-to-sibling-repo flow.
- A sibling private repo (`<org>/<app>-screenshots`) — one folder per PR (`pr-<NNN>/`), images on `main`, NOT orphan branches.
- Image URLs in PR descriptions use `github.com/<org>/<repo>/raw/...` (session auth), NOT `raw.githubusercontent.com` (anonymous, breaks for private repos).
- Every PR that touches a visual surface ships screenshots before "ready" status — enforced by checklist habit + `feedback_ui_pr_screenshots_mandatory` user memory rule.
- Capture pattern: spin up emulators → seed admin/non-admin test data → Playwright navigates real app → `page.screenshot()` → push to sibling repo `pr-<NNN>/<scenario>.png`.

## Sections (TODO when drafted)

1. Why DOM replicas don't suffice (the actual failure modes from chorz history)
2. Sibling-repo hosting pattern + the private-URL gotcha
3. The emulator-seed-then-capture flow
4. Per-platform variants (web Playwright; iOS swift-snapshot-testing for tests, manual Xcode capture for review)
5. PR description format with embedded images
6. The git-worktree upload pattern for keeping screenshots out of feature branches

## Reference reading

- `chorz/.claude/skills/pr-ui-screenshots/SKILL.md` — full capture-to-PR runbook
- `camelburrito/chorz-screenshots` — the sibling private hosting repo
- `chorz/e2e/screenshot-harness/` — Playwright harness with seeded routes
