# 12 — Notifications (in-app feed + push + widgets)

**Status:** 🟡 outlined
**Reference impl:** `chorz/docs/architecture/notifications.md`, `chorz/shared-cf-utils/src/notifications/`, `chorz/functions-calendar/src/notifications/`, `chorz/firestore.indexes.json`, `chorz/firestore.rules`, `chorz/packages/ChorzCore/Sources/ChorzCoreMessaging/`, `chorz/apple/Chorz/ChorzWidgets/`

## Why this exists

A product that wants to tell a user "something happened" needs three surfaces that are usually built ad-hoc and drift apart: a durable in-app feed, an OS push, and (on mobile) a widget. The keel pattern unifies them behind **one dispatcher abstraction** and **one fan-out-on-write document**, so adding a new notification kind is a payload change — not a new delivery path, a new rule, and a new index each time. It also names the single scaling frontier (fleet-wide scheduled scanners) up front, so the next project doesn't discover it in production.

## What you must satisfy

These are the load-bearing claims. Get these right and the rest is detail.

- **Fan-out-on-write to ONE document, not one-per-recipient.** A notification is a single doc carrying `recipientMemberIds: string[]` plus per-viewer `readBy[]` / `dismissedBy[]` arrays. This makes the per-event write cost O(1) regardless of fan-out size, avoids hot-doc contention (each is a fresh auto-id doc), and bounds the per-viewer arrays by group size. Resist the "one doc per recipient" instinct — it multiplies writes and index entries by N for no benefit at family/team scale.
- **The in-app feed is the source of truth; push is a best-effort courtesy.** Deliver via a frozen, ordered dispatcher registry where the durable-feed adapter is registered FIRST and runs inside the write transaction, and the push adapter runs in a post-commit side-effect phase whose failures are logged and swallowed. Consequence: a transaction abort delivers nothing on any channel; a push never fires for a notification that didn't persist; a dead push never rolls anything back.
- **Scheduled producers stamp-before-dispatch under a transactional re-read.** Any polled scanner (reminders, overdue) must re-read the candidate inside a transaction, bail if the state changed, write a one-per-lifetime idempotency stamp, and only then dispatch. This is at-most-once: a dispatch failure after the stamp loses that one push permanently, which is correct (the alternative re-spams every cycle) as long as the underlying state is also derivable in the UI.
- **The `== null` query trap is real.** Firestore `where(field, '==', null)` does not match *missing* fields. Any field a scanner filters on (the idempotency stamp) must be initialized at create time and backfilled for the existing corpus, or the scanner silently matches zero rows.
- **Opt-out is server-enforced, not just client-hidden.** A single `optIn` boolean with opt-OUT semantics (only explicit `false` suppresses) gated inside the push adapter — so opting out on one device silences every channel including the widget cache. A client must not be reachable against an explicit opt-out.
- **Cross-tenant isolation is a rule conjunct, not an app-layer filter.** The feed read rule ANDs a `token.householdId == <path tenant>` (or your tenant claim) condition, so knowing another tenant's notification ID still denies the read. All writes are CF-only (`write: false`); clients never write the feed doc.
- **Tokens self-heal on three layers.** Per-device token registry with a `lastSeenAt`; clean up on sign-out, inline on send-error (`registration-token-not-registered`), and on a weekly reaper at the platform's stale-token TTL (~90 days). Never trust a token to be live.
- **Widgets duplicate a Lite Codable shape rather than link the full core.** The widget extension's memory cap (~30 MB on iOS) won't hold the Firebase graph, so the extension reads a small app-group cache written by the host app and decodes a duplicated "Lite" struct — kept honest by a contract test against shared golden fixtures, never by trust.
- **One projected presentation contract, mirrored per platform, pinned by golden fixtures.** The card shape is projected once (already-localized title/body, already-formatted relative time, per-viewer `isRead`) and mirrored byte-for-byte across web + native (+ widget Lite copy), with the fixtures as the single source of truth. Same discipline as your card-projector contract.

## The scaling frontier (name it before you hit it)

The per-event path scales to any number of tenants for free (O(1) write, index-bounded reads, per-tenant isolation). The binding constraint is the **fleet-wide scheduled jobs**: single-worker serial loops under fixed CF timeouts.

- The index-backed `collectionGroup` query is cheap; the cost is the **serial per-candidate work** (txn + reads + dispatch), with no sharding/cursor/parallelism. Throughput is capped at "what one worker does in the timeout."
- The stale-token reaper is the one genuinely O(total users) operation — `lastSeenAt` lives inside an array element, which is unindexable, so there's no query to pre-filter users holding stale tokens. Plan for a queryable top-level marker or a cursored sweep before this binds.
- The push multicast has a platform per-call token ceiling (FCM: 500). Chunk before you send; a single fan-out exceeding it fails the whole push.

Scale-out is local, not architectural: shard the scanners by tenant-hash/time-bucket (or enqueue per-candidate work onto a task queue so the scanner is an *enqueuer*); make the stale-token sweep queryable; chunk the multicast; add a feed-doc TTL/reaper (the subcollection grows monotonically — nothing prunes it by default); maintain a server-side unread counter if exact badge counts matter (you can't compute exact unread client-side without an inverse field — there's no array-not-contains).

## Sections (TODO when drafted to 🟢)

1. The dispatcher port/adapter + 3-phase composer + ordering guarantee
2. Producers: event-driven triggers vs polled scanners; the at-most-once stamp contract
3. Token lifecycle + 3-layer dead-token cleanup
4. The fan-out-on-write doc + the 2–3 composite indexes + the tenant-isolation rule
5. Clients: real-time feed listener, the push bridge (note the platform swizzler gotchas), widgets via app-group cache + Lite duplicate
6. The cross-platform presentation contract + golden fixtures
7. Scale analysis: per-event cost table, the scheduled-scanner ceiling, latent gaps, scale-out path

## Reference reading

- `chorz/docs/architecture/notifications.md` — the canonical write-up incl. the § 8 scale analysis
- `chorz/shared-cf-utils/src/notifications/{NotificationDispatcher,dispatchNotification,FirestoreFeedDispatcher,FcmDispatcher}.ts` — the dispatch layer
- `chorz/functions-calendar/src/notifications/{scanOverdueChores,sendChoreReminders,cleanupStaleFcmTokens}.ts` — the scheduled producers + reaper
- `chorz/functions/src/users/registerFcmToken.ts` — per-device token registry upsert
- `chorz/firestore.indexes.json` + `chorz/firestore.rules` — the feed/scanner composite indexes + the two-arm read rule with the tenant conjunct
- `chorz/apple/Chorz/Chorz/AppDelegate.swift` — the APNs→FCM bridge (explicit `apnsToken` set; the SwiftUI delegate-proxy swizzler gotcha)
- `chorz/apple/Chorz/ChorzWidgets/` + `chorz/apple/Chorz/Chorz/Notifications/WidgetSharedCache.swift` — Architecture B (Lite duplicate, app-group cache, fallback timeline)
- `chorz/shared/test-fixtures/notification-card/*.json` — the golden fixtures pinning the cross-platform card contract

## Related playbook

- [09-firebase-stack.md](./09-firebase-stack.md) — the CF/Firestore/rules substrate this rides on
- [05-observability-pii.md](./05-observability-pii.md) — FCM tokens are a documented PII carve-out (transmitted to the vendor for delivery; redacted in logs)
- [04-architecture-docs.md](./04-architecture-docs.md) — the arch-doc convention + the `playbook-coverage-on-new-architecture` ratchet that brought you here
