# Recipe: Add a Ratchet

A ratchet locks an invariant: a bug class you fixed once should never return.

## When to add one

You just fixed a bug class. Ask: *Could this same shape of bug come back later by accident?* If yes, write a ratchet.

Examples that earned ratchets in production:
- A CF wrote `status: 'done'` without `completedAt` (3/12 staging records broken). → `no-done-without-completedat-in-functions`
- Bare `console.log` bypassed Sentry's PII redact. → `no-console-in-source`
- A `paths-filter` GHA job silently no-op'd a 93-commit release cut. → `no-paths-filter-without-fetch-depth-zero`

## Pattern

```ts
// src/__tests__/no-<your-pattern>.test.ts
import { describe, it, expect } from 'vitest';
import { stripTsLineAndBlockComments } from '@camelburrito/ratchet-kit';
import { readFileSync } from 'node:fs';
import { glob } from 'glob';

const EXPECTED_COUNTS: Record<string, number> = {
  // Empty = strict zero. Add path entries only for grandfathered legacy.
};

describe('no-<your-pattern>', () => {
  it('does not appear in src/', async () => {
    const files = await glob('src/**/*.{ts,tsx}', { ignore: ['src/__tests__/**'] });
    const violations: Record<string, number> = {};

    for (const file of files) {
      const src = stripTsLineAndBlockComments(readFileSync(file, 'utf8'));
      const matches = src.match(/your-regex-here/g) ?? [];
      if (matches.length > 0) violations[file] = matches.length;
    }

    // Both adding new sites AND silently migrating without updating count fail.
    expect(violations).toEqual(EXPECTED_COUNTS);
  });
});
```

## Failure message — earn its keep

Don't just say "violation found." Say what to do:

```ts
const msg = `
no-<your-pattern>: found ${count} site(s).
Migrate to <the right primitive> via <playbook reference>.
If this is intentional and grandfathered, add to EXPECTED_COUNTS with a rationale.
`;
expect(violations, msg).toEqual(EXPECTED_COUNTS);
```

## Mutation test at write-time

Before committing, temporarily break the invariant the ratchet defends and confirm the ratchet fails with your repair recipe. Restore. This proves the regex actually catches the regression.

## Wire it in

1. Add the test file to `.githooks/pre-commit`'s ratchet array.
2. Add the test file to `.github/workflows/test-coverage.yml § "Design System Ratchets"`.
3. The `ratchet-list-precommit-vs-workflow.test.ts` drift gate verifies both lists match.
4. Update `CLAUDE.md` ratchet count if your project narrates the total.

## Count-tracked deferrals

If you can't drain to zero today, use a deferral baseline:

```ts
const WEB_DEFERRED: Record<string, { count: number; rationale: string }> = {
  'src/legacy/OldComponent.tsx': {
    count: 3,
    rationale: 'pre-Phase-1078 migration baseline; drain in Phase 1080',
  },
};
```

`@camelburrito/ratchet-kit`'s `checkDeferralCount` verifier fails BOTH on adding new sites AND on silent migration (the count stays at 3 if you migrate one, which is a lie — fix the count when you fix the file).

## Related playbook

- [07-ratchet-framework.md](../docs/playbook/07-ratchet-framework.md) — strict-zero philosophy
- [03-ci-cd.md](../docs/playbook/03-ci-cd.md) — wiring into pre-commit + CI
