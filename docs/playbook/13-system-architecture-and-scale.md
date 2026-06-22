# 13 — System architecture & scale

**Status:** 🟡 outlined

## Why this exists

A project accumulates a dozen per-subsystem architecture docs (auth, data model, cloud functions, notifications…) but no single doc that answers the three questions a founder, an SRE, or a new hire asks first: *what are all the moving parts, how far does this scale, and what will it cost?* This entry is the convention for a **whole-system overview doc** — the bird's-eye companion to the subsystem deep-dives — and the modeling discipline behind its scaling and cost claims.

## What you must satisfy

A whole-system overview doc earns its place only if it does what no subsystem doc can:

- **One master diagram** showing every tier (clients, edge/CDN, auth, compute, database, object storage, push, external APIs) and the *direction* of each dependency. The read path and the write path are drawn separately — they are different flows with different cost profiles.
- **An end-to-end read path and write path**, each as its own sequence diagram, traced from client tap to durable commit to real-time fan-out. The doc states which path goes through compute and which goes straight to the database — that distinction is the whole cost story.
- **A scaling envelope stated as an ordered list of ceilings**, not a single number. The honest shape is "the per-entity path is effectively unbounded; the *first* real ceiling is X (fleet-wide serial jobs), the next is Y (per-database write throughput), the outer bound is Z (single-region)." Each ceiling names the order-of-magnitude where you hit it and the local intervention that lifts it — no architecture rewrite.
- **A cost model with its assumptions written down.** A reference per-entity daily workload (reads / writes / invocations / compute / storage), the published unit prices with their date and region, the free-tier subtracted once per project, and a cost-by-scale table. The model is explicitly labeled an estimate, not a bill, and names the two or three line items that dominate (so the reader knows which knobs matter).
- **Grounded in the same source the subsystem docs cite** and consistent with them — the overview links *out* to the deep dives for detail (e.g. the scanner-ceiling math) rather than restating or, worse, contradicting them. It is enforced by the same `archDocIntegrity` ratchet (links resolve, cited paths exist, mermaid renders, footer present) as every other arch doc, and it counts toward `playbook-coverage-on-new-architecture`.

The load-bearing idea: **cost and scale fall out of two architecture choices** — (1) every write funnels through a server-validated callable while reads stream directly from the database, so reads dominate cost and compute is the swing factor; and (2) data is sharded by a natural tenant key (account, org, user), so there is no global hot document and the per-tenant path scales horizontally for free. An overview doc that doesn't trace cost and scale back to those choices is just a re-drawn box diagram.

## Sections (TODO when drafted)

Promote to 🟢 drafted once a second reference project ships a whole-system overview doc and the modeling discipline survives a real cost review. Outline:

- The mental model + master tier diagram
- The tiers table (technology, role, scaling model per tier)
- End-to-end read path (sequence)
- End-to-end write path (sequence) + the audit dual-write multiplier
- Tenant-sharding as the scaling property
- The ordered scaling envelope (per-tenant → fleet jobs → DB throughput → region)
- The cost model: assumptions, unit prices, cost-by-scale table, what moves the numbers
- Availability and failure modes
- Cross-links to every subsystem doc

## Where the overview lives and what it leans on

The whole-system overview is itself an architecture doc (`docs/architecture/system-overview.md`) that links *out* to the subsystem deep-dives rather than restating them:

- **The overview doc** — the canonical whole-system reference: tier diagram, read/write sequence diagrams, the three-layer scaling envelope, and the cost-by-scale table with stated assumptions.
- **The notifications / background-job subsystem doc** — typically the deepest per-subsystem scaling analysis (fleet-wide serial scanners as the binding constraint); the overview links to it rather than restating the math.
- **The compute-tier doc** — the callable/cloud-function surface the overview summarizes: codebase split, callable inventory, pre-flight pattern.
- **The data-model doc** — the tenant-sharded schema that gives the system its horizontal-scaling property.
- **The deploy descriptor** (e.g. `firebase.json`) and **the security rules** (e.g. `firestore.rules`) — the deployed shape (regions, codebases, hosting) and access model the overview describes.

## Related playbook

- [04-architecture-docs.md](04-architecture-docs.md) — the arch-doc convention this entry's overview doc is a member of.
- [09-firebase-stack.md](09-firebase-stack.md) — the Firebase tier details (Firestore, Cloud Functions, rules) the overview rolls up.
- [12-notifications.md](12-notifications.md) — the subsystem whose scaling section the overview's envelope leans on.

**Last updated:** 2026-06-21
