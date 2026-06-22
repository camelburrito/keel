# Recipe: Add a Cloud Function

## Choose the codebase

- `default` for app-domain CFs (auth, business logic, queries, mutations).
- A separate codebase (e.g., `<external>`) if the CF imports a heavy SDK like `googleapis`, `openai`, etc. — heavy SDKs blow cold-start budgets if mixed with the default codebase. Defended by `no-<heavy-sdk>-in-default-codebase` ratchet.

## Required structure

```ts
// functions/src/<module>/<cfName>.ts
import { onCall, HttpsError } from 'firebase-functions/https';
import { checkRateLimit, writeWithAudit, validateString, logger } from '@camelburrito/cf-utils';
import { AUDIT_ACTIONS } from '../audit/actions';

export const cfName = onCall(
  { invoker: 'public' },              // REQUIRED — defended by no-oncall-without-explicit-invoker
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'unauth');

    // 1. Rate limit (required — defended by arch-doc-cf-claims)
    await checkRateLimit(uid, 'cfName', { perMin: 10 });

    // 2. Validate every user-supplied input
    const name = validateString(request.data.name, { field: 'name', maxLen: 100 });

    // 3. Atomic mutation + audit doc (D-01)
    await writeWithAudit({
      mutate: (txn, refs) => {
        txn.update(refs.target, { name });
      },
      audit: { action: AUDIT_ACTIONS.NAME_UPDATED, actor: uid },
    });

    return { success: true };
  }
);
```

## Required adjacent artifacts

1. **Contract fixture** — `shared/test-fixtures/cf/cfName/<scenario>/{request,expected}.json`. Defended by `no-cf-without-contract-fixture` ratchet.
2. **Unit test** — `functions/src/<module>/<cfName>.test.ts` — mocked Firestore + auth.
3. **Integration test** — `functions/src/__tests__-integration/<feature>.integration.test.ts` — describes the CF by name (case-insensitive substring). Defended by per-codebase emulator-integration ratchets.
4. **Wire code mapping** — if the CF throws any new `HttpsError` codes, add catalog keys to `shared/strings/catalogs/en-US.json#errors.<code>` and route through `cfErrorHandler.ts`.
5. **Architecture doc update** — refresh `docs/architecture/cloud-functions.md` § rate-limit table + handler count.

## What can break if you skip a step

| Skip | Consequence |
|------|-------------|
| `invoker: 'public'` | firebase-tools silently skips the IAM CREATE auto-grant (15.11.0+); CF returns 403 in prod |
| Rate limit | `arch-doc-cf-claims` ratchet fails immediately |
| Contract fixture | `no-cf-without-contract-fixture` ratchet fails |
| Integration test | per-codebase emulator-integration ratchet fails |
| Wire code catalog | client surfaces "Something went wrong" instead of the real error |

## Related playbook

- [09-firebase-stack.md](../docs/playbook/09-firebase-stack.md)
- [05-observability-pii.md](../docs/playbook/05-observability-pii.md)
- [06-testing-cadence.md](../docs/playbook/06-testing-cadence.md)
