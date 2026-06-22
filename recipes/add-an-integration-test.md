# Recipe: Add an Integration Test

Integration tests (Tier 2) run against real Firebase emulators (Auth + Firestore + Functions). They catch the bug class that mock unit tests can't see: trigger fan-out, transaction races, security-rule rejections, audit-doc atomicity, signal-based cross-codebase coordination.

## When to add one

- You added a new onCall Cloud Function → **mandatory** (defended by per-codebase `<codebase>-onCall-has-emulator-integration` ratchet).
- You added a new Firestore trigger → mandatory.
- You added a security rule → mandatory (defended by `firestore.rules.test.ts` describe block coverage).
- You changed an existing CF's wire shape → highly recommended.
- The behavior depends on a Firestore transaction, batched write, or cross-document atomicity.

## Where it lives

| Surface | Path |
|---------|------|
| Default CF codebase | `functions/src/__tests__-integration/<feature>.integration.test.ts` |
| Per-extra codebase | `functions-<external>/src/__tests__-integration/<feature>.integration.test.ts` |
| Web wire-symmetry | `src/lib/firebase/__tests__-emulator/<wrapper>.test.ts` |

## Pattern — CF emulator integration

```ts
// functions/src/__tests__-integration/<feature>.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getApps, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { httpsCallable, getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { seedPermutations } from './helpers/seedPermutations';

describe('myFeature — Tier 2 emulator integration', () => {
  // The describe title MUST mention your new CF by name (case-insensitive
  // substring) so the `<codebase>-onCall-has-emulator-integration` ratchet
  // sees it. Example for a CF named `setMemberRole`:
  //   describe('setMemberRole — happy path')

  beforeAll(async () => {
    initializeApp({ projectId: 'demo-test' });
    await seedPermutations(getFirestore());
  });

  afterAll(async () => {
    await Promise.all(getApps().map(deleteApp));
  });

  it('does the thing under realistic state', async () => {
    // Arrange — read the seeded fixture you care about
    const before = await getFirestore().doc('tenants/seed-basic/items/i-1').get();

    // Act — invoke the CF via the production wrapper (or callable directly)
    const fn = httpsCallable(getFunctions(/* connected to emulator */), 'myFeature');
    const { data } = await fn({ itemId: 'i-1' });

    // Assert — wire shape + Firestore side effects + audit doc presence
    expect(data).toMatchObject({ success: true });
    const after = await getFirestore().doc('tenants/seed-basic/items/i-1').get();
    expect(after.data()).toMatchObject({ /* expected delta */ });
    const audit = await getFirestore().collection('audit').where('action', '==', 'MY_FEATURE_DID_THE_THING').limit(1).get();
    expect(audit.size).toBe(1);
  });
});
```

## How to run

```bash
# Manually
firebase emulators:exec --only firestore,auth,functions \
  "(cd functions && npx vitest run src/__tests__-integration)"

# As part of the full CI mirror
bash scripts/ci-local.sh
```

## Mandates this satisfies

- **Tier 2 coverage** — every CF that touches Firestore needs one of these.
- **Mandate 1 (permutation seeds)** — if your CF reads a NEW state shape, extend `seedPermutations.ts` AND bump `EXPECTED_TOTAL_SEEDED` in the same commit.
- **CF contract fixture** — pair this test with a `shared/test-fixtures/cf/<cfName>/<scenario>/{request,expected}.json` so `cf-contract.test.ts` replays the wire shape.

## Web wire-symmetry alternative

For testing the production-callable-wrapper code path (i.e., what the browser actually runs), put the test under `src/lib/firebase/__tests__-emulator/<wrapper>.test.ts` and use `vi.mock` to redirect the wrapper's transport to an emulator-bound `httpsCallable`. Do NOT create a parallel factory — you'd lose coverage of the production code path.

## Related playbook

- [06-testing-cadence.md](../docs/playbook/06-testing-cadence.md) — Tier 2 layer (web wire-symmetry + CF emulator + iOS host-bundle splits)
- [09-firebase-stack.md](../docs/playbook/09-firebase-stack.md) — emulator harness setup
- [recipes/add-a-cloud-function.md](add-a-cloud-function.md) — the full CF checklist
