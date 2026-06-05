# 09 — Firebase Stack

**Status:** 🟢 drafted
**Reference impl:** `chorz/docs/architecture/cloud-functions.md`, `chorz/docs/architecture/data-model.md`, `chorz/docs/architecture/audit-trail.md`, `chorz/firebase.json`, `chorz/firestore.rules`, `chorz/shared-cf-utils/`

---

## The principle

Firebase is the default backend stack for keel-derived projects: Auth (multi-provider OAuth + anonymous + custom-token), Firestore (real-time sync + per-document audit), Cloud Functions (split codebases for cold-start budget control), FCM (notifications). The patterns that earn their keep across products:

- **Codebase split** for cold-start budget isolation — heavy SDKs (googleapis, openai) blow cold-start times if mixed with default app-domain CFs. Defended by `no-<heavy-sdk>-in-default-codebase` ratchets.
- **Deny-all-then-allowlist** Firestore rules — every collection deny-by-default; allowlist per-collection with corresponding rule-test coverage.
- **`writeWithAudit` atomic mutations** — every mutation that touches an audited doc type lands the audit record in the same transaction (D-01 invariant).
- **Cross-codebase coordination via Firestore field signals only** — never `httpsCallable` from one codebase to another. Defended by `no-cross-codebase-https-call`.
- **Index discipline** — every `collectionGroup` query has an index entry; every `fieldOverride` keeps you out of unindexed `.where()` chains. Defended by `no-unindexed-collectiongroup-query`.

---

## What you must satisfy

- `firebase.json` declares each codebase as a separate `functions[]` entry. Heavy SDKs live in one codebase only.
- `firestore.rules` opens with a deny-all match block; allowlist per collection.
- `firestore.indexes.json` carries an entry for every `collectionGroup()` query call site AND every `fieldOverride` that disables COLLECTION-scope keeps a matching COLLECTION-scope auto-index entry alongside.
- `@camelburrito/cf-utils` workspace package providing: `writeWithAudit` / `writeWithAuditBatch`, `checkRateLimit`, `claimIdempotency`, `validateString` / `validateEmail` / `validateUrl`, `logger` (see [05-observability-pii.md](05-observability-pii.md)), `wrapHandler` Proxy.
- Cross-codebase coordination via **Firestore field signals only**. Defended by `no-cross-codebase-https-call`.
- Heavy SDKs (`googleapis`, etc.) in **one codebase only**. Defended by `no-<sdk>-in-default-codebase`.
- Every onCall handler carries `{ invoker: 'public' }` (defended by `no-oncall-without-explicit-invoker` — required since firebase-tools 15.11.0 silently skips the IAM CREATE auto-grant).
- Every onCall handler calls `checkRateLimit` (defended by `arch-doc-cf-claims` parser).
- Every onCall handler has a contract fixture pair (defended by `no-cf-without-contract-fixture`).
- Every audited mutation routes through `writeWithAudit` / `writeWithAuditBatch` (defended by `no-audit-bypass-in-functions`).

---

## 2. Codebase split philosophy

**Why split.** Cloud Functions cold-start time scales with bundle size + dependency tree depth. `googleapis` alone adds ~500ms to cold start. If you mix `googleapis`-using CFs with your default app-domain CFs in one codebase, every cold start for the default codebase pays the `googleapis` tax — and 90% of your CFs don't need it.

**The split:**
- `functions/` — default codebase. App-domain CFs (auth, chores, members, household, users, FCM token registration, audit, testing). NO heavy SDKs.
- `functions-<external>/` — per-external-system codebase (e.g., `functions-calendar/` for googleapis-using CFs). One codebase per heavy SDK domain.

Chorz Phase 1065 split the megabundle when `googleapis` was retrofitted into a few CFs and the default codebase's cold-start budget cap hit. The split landed alongside two new strict-zero ratchets (`no-googleapis-in-default-codebase` defending the SDK boundary, `no-cross-codebase-https-call` defending the coordination boundary).

**Deploy commands:**
```bash
firebase deploy --only functions --project <APP>-staging              # both codebases
firebase deploy --only functions:default --project <APP>-prod         # default only
firebase deploy --only functions:calendar --project <APP>-staging     # calendar only
```

---

## 3. Cross-codebase coordination — Firestore field signals only

The forbidden pattern: codebase A calls codebase B's CF via `httpsCallable`. Reasons against:
- Cold-start cascades (A waits for B's cold start).
- Auth context complexity (A's auth doesn't transfer to B as-the-caller).
- Tight coupling at the wire layer (B's wire shape changes break A).

The required pattern: codebase A writes a signal field to Firestore; B's Firestore trigger picks up the signal asynchronously.

```ts
// shared-cf-utils/src/signals/SCHEDULING_SIGNALS.ts (typed registry)
export const SCHEDULING_SIGNALS = {
  CHORE_NEEDS_SCHEDULING_SYNC: 'scheduling.needsSyncTrigger',
  CHORE_SCHEDULING_DELETED: 'scheduling.deletedTrigger',
} as const;

// functions/src/chores/markChoreDone.ts (default codebase)
await db.doc(`households/${hid}/chores/${cid}`).update({
  status: 'done',
  completedAt: serverTimestamp(),
  [SCHEDULING_SIGNALS.CHORE_NEEDS_SCHEDULING_SYNC]: serverTimestamp(),
});

// functions-calendar/src/scheduling/onChoreSchedulingSync.ts (calendar codebase)
export const onChoreSchedulingSync = onDocumentUpdated(
  'households/{hid}/chores/{cid}',
  async (event) => {
    const after = event.data?.after.data();
    if (!after?.[SCHEDULING_SIGNALS.CHORE_NEEDS_SCHEDULING_SYNC]) return;
    // do the calendar work; clear the signal at end
  }
);
```

The typed registry (`SCHEDULING_SIGNALS`) makes the signal vocabulary explicit. Adding a new signal: add to the registry, then producer and consumer reference the same constant.

Defended by `no-cross-codebase-https-call` strict-zero ratchet (scans every codebase's source for `httpsCallable(<otherCodebaseCf>)` patterns and fails).

---

## 4. The `writeWithAudit` pattern

Every mutation on an audited doc type lands a matching `audit/{auditId}` doc in the same transaction:

```ts
import { writeWithAudit, AUDIT_ACTIONS } from '@camelburrito/cf-utils';

await writeWithAudit({
  mutate: (txn, refs) => {
    txn.update(refs.target, { status: 'done', completedAt: serverTimestamp() });
  },
  audit: {
    action: AUDIT_ACTIONS.CHORE_MARKED_DONE,
    actor: { uid, displayName },
    target: { collection: 'chores', id: choreId, householdId },
    before: { status: 'pending' },
    after: { status: 'done' },
  },
});
```

The transaction ensures the mutation + audit doc both land OR both fail. No half-written state. The audit doc is queryable via `audit/{auditId}` for forensics, dispute resolution, and GDPR data-export requests.

**The discipline:** every audited-doc-type mutation routes through this helper. Direct `db.doc().update()` on an audited doc fails the `no-audit-bypass-in-functions` ratchet. The ratchet scans source for `txn.set/update/delete` or `batch.set/update/delete` on lines that also reference audited doc refs.

Audited doc types are project-specific; chorz audits ~14 types (chores, members, households, users, slots, invites, creds, etc.). Each new audited type needs a registry entry + ratchet awareness.

---

## 5. Deny-all-then-allowlist rules

```javascript
// firestore.rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // writes via CF only
    }

    match /households/{hid}/members/{mid} {
      allow read: if hasHouseholdAccess(hid);
      allow write: if false;
    }

    // ... per-collection allowlist ...

    // Default deny — everything else.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The deny-all block at the bottom catches everything not explicitly allowlisted. New collections inherit deny-by-default — you opt-in with a match block + a paired test in `firestore.rules.test.ts`.

**The strict-zero ratchet `no-firestore-collection-without-rule-test`** parses `firestore.rules` for `match /<collection>/{...}` blocks AND `firestore.rules.test.ts` `describe()` titles, then asserts every collection has at least one describe block. New collection without test coverage = fail.

Why this is structural: Firestore rules tests are easy to skip ("I'll add the test later"). The ratchet ensures the rule + the test land together.

---

## 6. Index discipline

Firestore auto-creates single-field indexes at COLLECTION scope by default. Two index classes break this default:

**Class A — `collectionGroup` queries** need explicit COLLECTION_GROUP index entries. `db.collectionGroup('credentials').where('email', '==', x)` requires a `collectionGroup`-scoped index for `credentials.email`. Otherwise the query throws `9 FAILED_PRECONDITION` in production (the emulator silently allows ad-hoc indexes, hiding the gap).

**Class B — `fieldOverride` that disables COLLECTION-scope auto-index** removes the implicit single-field index. If you declare a fieldOverride at COLLECTION_GROUP-only scope, the COLLECTION-scope auto-index for that field IS NO LONGER GENERATED, breaking any `.collection(...).where(field, op, x)` chain. Chorz quick 260518-trz lesson: `pendingInvites.email` fieldOverride at COLLECTION_GROUP only broke the `setHouseholdId` legacy-migration State-2 branch in prod.

**The strict-zero ratchet `no-unindexed-collectiongroup-query`** (originally Class A, widened to also cover Class B) parses `firestore.indexes.json` AND scans both CF codebases for `.collectionGroup(NAME)` calls + `.collection(PATH).where(FIELD, OP, ...)` chains, then asserts every call site has a matching index entry. Strict-zero from day 1.

---

## 7. Rate limit + invoker discipline

```ts
import { onCall } from 'firebase-functions/https';
import { checkRateLimit } from '@camelburrito/cf-utils';

export const myCf = onCall(
  { invoker: 'public' },          // REQUIRED — defended by no-oncall-without-explicit-invoker
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'unauth');
    await checkRateLimit(uid, 'myCf', { perMin: 10 });
    // …
  }
);
```

**Why `invoker: 'public'` is mandatory:** firebase-tools 15.11.0+ silently SKIPS the IAM CREATE auto-grant if you don't set `invoker` explicitly. The CF deploys, but every caller gets 403 in prod. Defended by `no-oncall-without-explicit-invoker` strict-zero ratchet.

**Why `checkRateLimit` is mandatory:** without it, a single malicious caller can DoS your CF + Firestore quota. Defended by `arch-doc-cf-claims` parser (verifies every onCall has a rate-limit call + matches the documented rate-limit table claim in `docs/architecture/cloud-functions.md`).

Rate limits are per-caller per-CF per-minute. Typical tiers: 5/min for OAuth flows, 10/min for state mutations, 30/min for read-only queries.

---

## 8. Contract fixtures per CF

Every onCall CF has at least one `shared/test-fixtures/cf/<cfName>/<scenario>/{request,expected}.json` pair. Defended by `no-cf-without-contract-fixture`. The fixture pair drives:
- TS contract test (`cf-contract.test.ts` — replays the fixture against live emulator, asserts byte-equal response after generated-field normalization).
- Swift contract test (`CFContractTests.swift` — decodes `expected.json` into the matching Codable type).

See [06-testing-cadence.md § Sub-pattern: cross-platform contract fixtures](06-testing-cadence.md) for the full pattern.

---

## 9. The emulator harness

`firebase emulators:start` runs local Auth + Firestore + Functions + Hosting + UI emulators. The `emulators:exec` variant boots emulators, runs a command, tears down:

```bash
firebase emulators:exec --only firestore,auth,functions \
  "(cd functions && npx vitest run src/__tests__-integration)"
```

This is what Tier 2 integration tests use (see [06-testing-cadence.md](06-testing-cadence.md)). The wire-symmetry web suite uses long-running emulators via `firebase emulators:start` in a background process.

**Operator rule:** kill leftover emulators before running `bash scripts/ci-local.sh` — STEP 4 needs the ports free (8080/9099/5001/4400/4500). User-memory rule `feedback_kill_emulator_before_ci_local`.

---

## 10. Validation primitives

Every user-supplied string input to a callable Cloud Function MUST be validated:

```ts
import { validateString, validateEmail, validateUrl } from '@camelburrito/cf-utils';

const name = validateString(request.data.name, { field: 'name', maxLen: 100 });
const email = validateEmail(request.data.email, { field: 'email' });
const url = validateUrl(request.data.callbackUrl, { field: 'callbackUrl', requireHttps: true });
```

All three throw `HttpsError('invalid-argument', '<field>-<reason>')` where reason ∈ `{ required, too-long, invalid-format, invalid-protocol }`. Defaults: names 100-char cap, emails 254 (RFC 5321), URLs 2048 (V4-signed URL ceiling). `validateEmail` returns lower-cased.

Server-generated URLs (e.g., signed URLs written by upload triggers) bypass validation — they're trusted, not user-supplied.

---

## 11. Adopting this playbook

- [ ] `firebase.json` with default codebase declared.
- [ ] `firestore.rules` opens with deny-all baseline (template).
- [ ] `firestore.rules.test.ts` skeleton; `no-firestore-collection-without-rule-test` ratchet wired.
- [ ] `@camelburrito/cf-utils` installed.
- [ ] `writeWithAudit` used for every audited-doc mutation; `no-audit-bypass-in-functions` ratchet wired.
- [ ] `no-cf-without-contract-fixture` + `no-oncall-without-explicit-invoker` + `arch-doc-cf-claims` ratchets wired.
- [ ] `no-unindexed-collectiongroup-query` ratchet wired from day 1.
- [ ] When second codebase appears (heavy SDK), wire `no-<sdk>-in-default-codebase` + `no-cross-codebase-https-call` ratchets.
- [ ] `firestore.indexes.json` populated for every `collectionGroup` + `fieldOverride` call site.
- [ ] Emulator suite in `scripts/ci-local.sh` STEP 4 (and STEP 4.5 for second codebase).

---

## Reference reading

- `chorz/docs/architecture/cloud-functions.md` — full architecture doc (codebase split, rate limit table, signals registry)
- `chorz/docs/architecture/data-model.md` — schema + collection inventory
- `chorz/docs/architecture/audit-trail.md` — D-01 atomic-write pattern + audit-action catalog
- `chorz/shared-cf-utils/` — workspace package (the agnostic primitives `@camelburrito/cf-utils` extracts from)
- `chorz/functions/src/index.ts` + `chorz/functions-calendar/src/index.ts` — split codebases
- `chorz/firestore.rules` + `chorz/firestore.indexes.json` + `chorz/functions/src/rules/firestore.rules.test.ts` — deny-all + per-collection allowlist + paired tests
- `chorz/src/__tests__/no-googleapis-in-default-codebase.test.ts` + `chorz/src/__tests__/no-cross-codebase-https-call.test.ts` — codebase split defenders
- `chorz/src/__tests__/no-unindexed-collectiongroup-query.test.ts` — index discipline defender (Class A + Class B)
- `chorz/src/__tests__/no-audit-bypass-in-functions.test.ts` — audit-trail defender
- `chorz/src/__tests__/no-oncall-without-explicit-invoker.test.ts` — IAM CREATE defender
- `chorz/src/__tests__/arch-doc-cf-claims.test.ts` — value-parser for CF count + rate-limit claims
- `chorz/functions/src/utils/validation.ts` — validateString/Email/Url primitives
- Recipe: [recipes/add-a-cloud-function.md](../../recipes/add-a-cloud-function.md)
- Recipe: [recipes/add-an-integration-test.md](../../recipes/add-an-integration-test.md)
