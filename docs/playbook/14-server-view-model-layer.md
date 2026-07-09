# 14 — Server view-model layer (SDUI-lite)

**Status:** 🟡 outlined

## Why this exists

When two or more clients hand-mirror the same presentation logic (status labels,
badge derivation, avatar/status token paths, masking), every new client multiplies
the drift surface. Hoisting presentation computation into server-materialized
view-model documents — delivered over the SAME realtime channel the clients
already subscribe to — collapses N per-client projectors into one server
projector plus a thin per-client time-overlay, so a new client is born as a
pure renderer instead of a third hand-mirrored logic layer.

This is deliberately SDUI-**lite**: the server sends view MODELS (data shaped
for display), not layout trees, renderer registries, or an action vocabulary.
Full SDUI was evaluated and rejected for small-team, offline-first,
listener-driven apps — it inverts the cost model under per-render server calls
and does not reduce new-client cost.

## What you must satisfy

- **One contract type, schema-first.** The VM wire shape is defined ONCE (in
  the shared server package); native bindings for every client are code-generated
  from it, and a drift gate (source ↔ schema ↔ generated bindings ↔ golden
  fixtures) runs at commit time. Born-versioned (`vmSchemaVersion: 1`),
  additive-only.
- **Field partition rule.** A field goes INTO the VM iff a database write can
  change it. Anything derived from wall-clock time alone (late-flip, relative
  due-text) stays in a small fixture-locked client overlay — never written back
  to the database.
- **Localization by key, not by value.** VM docs carry catalog KEYS
  (`status.todo`), never resolved strings — a locale change requires zero
  re-materialization. (Contrast with fan-out surfaces like notifications, where
  per-recipient resolution at dispatch time is correct.)
- **Materializer triggers are structurally loop-proof.** A trigger listens on
  the source collection and writes to a DISJOINT sibling collection; a
  strict-zero ratchet asserts no trigger writes to the collection it listens on
  (resolve write targets by receiver correlation, not nearest-declaration
  heuristics — and document the static-analysis ceiling honestly).
- **Mechanics-only writes.** VM docs are derived read-views of already-audited
  writes — they do NOT dual-write audit entries.
- **Privacy masking at write time.** If the VM collection is coarsely readable
  (household/tenant-wide), the materializer masks restricted content BEFORE
  writing — the masked doc must expose no more than the existing masked-read
  path does (field-for-field parity, including timestamps like completedAt).
  Lock it with rules tests AND a live integration test, not a "rule exists" check.
- **A cost gate before scale-out.** Ship ONE materializer behind a
  staging-only measurement window first: instrument write/no-op/delete
  breadcrumbs plus a baseline-writes breadcrumb, measure write amplification
  against an explicit threshold, extrapolate to the full surface count, and
  HARD-GATE further rollout on a recorded PROCEED verdict. Verify the
  denominator query actually matches an emitter on day 0 — an unsatisfiable
  filter wastes the whole soak window.
- **Delivery-semantics honesty.** Realtime trigger pipelines are at-least-once
  and unordered; before any surface renders from VM docs, land an ordering
  guard keyed on the platform's server-authoritative write time.

## Sections (TODO when drafted)

- The doc + thin-reader split (generalizing a notification-feed-style pattern)
- Contract + codegen pipeline (single-source type, multi-target emitters, drift gates)
- The materializer trigger anatomy (context reads, projection, no-op guard, breadcrumbs)
- Privacy masking parity
- The cost gate (measurement script, threshold derivation, extrapolation math)
- Deadline/midnight-boundary options for time-bucketed grouping VMs
  (content-hash no-op guard vs cron vs overlay-side bucket assignment)
- Migration sequencing (shadow parity against the legacy projectors before any
  surface flips; projector deletion as the terminal step)

## The portable shape

```text
source-collection write
  → onWrite trigger (disjoint sibling target, loop-proof by construction)
    → concurrent context reads (assignee, dependency, existing VM)
    → pure projection function (shared package, 100% coverage, fixture-replayed)
    → masked variant for restricted content
    → content-equality no-op guard (+ breadcrumb instrumentation)
    → VM doc write
  → clients stream VM docs over the existing realtime channel
    → thin overlay adds wall-clock-derived state (late-flip, relative text)
```

Golden fixtures live in a shared directory replayed by EVERY platform's test
runner (byte-equality); the fixture inputs drive the pure projection function
directly, so the contract and the materializer cannot drift apart silently.
