# Recipe: Add an E2E Spec

E2E tests (Tier 4) drive Playwright against the real frontend, seeded against Firebase emulators. They catch the bug class that integration tests can't see: UI render correctness, multi-page navigation flows, accessibility wiring, screenshot drift.

## When to add one

- You added a new user-facing feature touching a rendering surface — **mandatory** (Mandate 2 of the testing-cadence playbook).
- You added a globally-mounted component (mounted via `AppLayout.tsx`) — mandatory (defended by `global-features-have-cross-page-spec` ratchet).
- You changed a critical user flow (sign-in, sign-up, primary CTA) — highly recommended.

## Where it lives

| Surface | Path |
|---------|------|
| Cross-page coverage (Mandate 2) | `e2e/cross-page/<feature>.spec.ts` |
| Per-phase bundle | `e2e/phase-<NNNN>/<feature>.spec.ts` |
| Screenshot harness (visual proof) | `e2e/screenshot-harness/<scenario>.spec.ts` |

`cross-page/` is the load-bearing one. Phase bundles are useful for one-off phase verification; screenshot-harness specs only run on demand for PR review.

## Pattern — cross-page coverage

```ts
// e2e/cross-page/<feature>.spec.ts
import { test, expect } from '@playwright/test';

const PAGES_THAT_SHOULD_SHOW_FEATURE = [
  { url: '/dashboard', shellMode: 'taskCentric' },
  { url: '/my-tasks', shellMode: 'personCentric' },
  { url: '/<user-profile>?t=<token>', shellMode: 'personCentric' },
];

const PAGES_WHERE_FEATURE_IS_INTENTIONALLY_ABSENT = [
  { url: '/calendar', reason: 'calendar view replaces inline affordance' },
];

for (const { url, shellMode } of PAGES_THAT_SHOULD_SHOW_FEATURE) {
  test(`<feature> renders on ${url}`, async ({ page }) => {
    await page.goto(url);

    // Use stable data-testid selectors. The `no-stale-e2e-selectors` ratchet
    // enforces that every testid here exists in production source.
    await expect(page.getByTestId('feature-affordance')).toBeVisible();

    // Exercise the flow
    await page.getByTestId('feature-cta').click();
    await expect(page.getByTestId('feature-confirmation')).toBeVisible();
  });
}

// POSITIVE-ABSENCE tests — when a feature is intentionally absent on a variant,
// ASSERT THE ABSENCE rather than skip. Skipping hides regressions where the
// feature accidentally appears.
for (const { url, reason } of PAGES_WHERE_FEATURE_IS_INTENTIONALLY_ABSENT) {
  test(`<feature> is absent on ${url} — ${reason}`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByTestId('feature-affordance')).toHaveCount(0);
  });
}
```

## How to run

```bash
# All cross-page specs
npm run test:e2e -- e2e/cross-page/

# One spec
npm run test:e2e -- e2e/cross-page/<feature>.spec.ts

# Headed (debug)
npm run test:e2e -- --headed --debug
```

## Seeding pattern

E2E specs run against emulators with `seedPermutations.ts` data seeded at startup. Don't seed inside the spec — the seed shape is the contract, and per-spec seeding produces flaky tests. If your spec needs a state shape not in the permutation grid, **extend the permutation grid first** (Mandate 1) — the new cell becomes available for all specs.

## Harness mode vs real-auth mode

Two seed modes coexist:
- **Real-auth mode** — emulator-auth account, real session cookies, real route guards. Best for primary flows.
- **Harness mode** — pre-authenticated routes (`/_harness/dashboard?seed=basic`) bypass auth and inject seed-doc IDs directly into the rendering layer. Best for visual variants where authentication isn't the thing under test.

Keep both modes for the same flow where it matters: real-auth proves the guard, harness mode gives fast deterministic coverage of the rendering variants behind it.

## data-testid naming convention

- Stable kebab-case slug — `item-card-body-<itemId>`, `feature-affordance`, `kebab-menu-trigger`.
- Interpolate IDs in spec selectors via Playwright's `getByTestId(pattern)` only when you control the seeding side too.
- Never use `*` or `^=` wildcards in spec selectors — they hide drift.
- Defended by `no-stale-e2e-selectors` — every literal in a spec must exist in `src/`, `apple/`, or `packages/` source.

## Mandates this satisfies

- **Mandate 2** — every user-facing feature has cross-page coverage with positive-absence assertions on variants.
- **Pre-release wall** — Tier 4 is part of `npm run test:pre-release` which gates `deploy:{staging,prod}`.

## Related playbook

- [06-testing-cadence.md](../docs/playbook/06-testing-cadence.md) — full 4-tier model
- [10-screenshot-workflow.md](../docs/playbook/10-screenshot-workflow.md) — screenshot-harness mode
- [recipes/add-a-cloud-function.md](add-a-cloud-function.md) — Tier 2 integration recipe
