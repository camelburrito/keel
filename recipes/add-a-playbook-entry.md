# Recipe: Add a Playbook Entry

When the reference project ships a significant new architecture (notifications, Android client, payments, multi-tenancy, etc.), the keel playbook gets a matching entry.

## Trigger

- A new `docs/architecture/<system>.md` lands in the reference project.
- The `playbook-coverage-on-new-architecture` ratchet on the reference project trips, citing this missing keel entry.

## Steps

1. Pick the next sequential number — see `docs/playbook/00-index.md` for the current high-water mark.
2. Create `docs/playbook/<NN>-<slug>.md` using the template below.
3. Update `docs/playbook/00-index.md`:
   - Add a row to the main entries table.
   - Move the topic out of the "Future entries" placeholder list if it was there.
4. Extract any genuinely agnostic helpers into `packages/cf-utils/`, `packages/ratchet-kit/`, or `scripts/` (whichever is the right home).
5. Update the reference project's `.<reference-project>-playbook-index.json` (or equivalent snapshot) so the `playbook-coverage-on-new-architecture` ratchet sees the new entry.
6. Commit. Tag a keel release if the package surface changed.

## Template

```markdown
# NN — Topic

**Status:** 🟡 outlined
**Reference impl:** `<reference-project>/<paths>`

## Why this exists

Two or three sentences. The motivation, not the mechanism.

## What you must satisfy

Bullet list of structural assertions a new project adopting this system must meet.
These are the load-bearing claims — what makes the pattern work vs. what's incidental.

## Sections (TODO when drafted)

Outline the full draft. Each section becomes a real subsection later.

## Reference reading

- `<reference-project>/<path>` — what it shows
- `<reference-project>/<path>` — what it shows
```

## When the playbook entry is "real" vs "stub"

A 🟡 outlined stub is fine when the system has only shipped in one reference project and the patterns are still hardening. Promote to 🟢 drafted when:
- Two or more reference projects use the pattern.
- The structural assertions have survived a real reorganization without breaking.
- Someone other than the original author has consumed the playbook entry to start a new project successfully.

## Related playbook

- [04-architecture-docs.md](../docs/playbook/04-architecture-docs.md) — the matching arch-doc-convention on the reference project side
