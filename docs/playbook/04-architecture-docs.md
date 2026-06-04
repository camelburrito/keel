# 04 — Architecture Docs Convention

**Status:** 🟡 outlined
**Reference impl:** `chorz/docs/architecture/`, `chorz/.claude/hooks/architecture-doc-drift.sh`, `chorz/src/__tests__/arch-doc-cf-claims.test.ts`

## Why this exists

Large codebases reverse-engineered from 20+ files take hours per system. A canonical `docs/architecture/<system>.md` per major subsystem is the answer — read first, then read code. Drift is the failure mode; two mechanisms catch it: a citation-based PostToolUse hook and value-based parsers that fail when doc claims don't match source.

## What you must satisfy

- `docs/architecture/README.md` — index listing every doc.
- One doc per major subsystem: auth, data model, audit trail, design system, state machines, cloud functions, etc. Add new ones as systems stabilize.
- Each doc carries a `Last updated: YYYY-MM-DD (<phase or quick name>)` footer; re-anchor it when you ship the change.
- PostToolUse hook at `.claude/hooks/architecture-doc-drift.sh` — flags edits to files cited by name in any arch doc.
- Value-based parsers (e.g., `arch-doc-cf-claims.test.ts`) for claims the citation hook can't catch (counts, rate limits, version numbers).
- Updates land **in the same PR** as the code change — never deferred to a follow-up.

## Sections (TODO when drafted)

1. The two-tier drift defense (citation hook + value parsers)
2. Anatomy of a good architecture doc
3. When to add a new doc vs. extend an existing one
4. The "Last updated" footer convention + why re-anchoring matters
5. Recipe: how to add a new arch doc — see [recipes/add-an-architecture-doc.md](../../recipes/add-an-architecture-doc.md)

## Reference reading

- `chorz/docs/architecture/README.md` — index of 9 docs
- `chorz/docs/architecture/cloud-functions.md` — exemplar with both citation hooks AND value-parser ratchets defending it
- `chorz/.claude/hooks/architecture-doc-drift.sh` — citation-based PostToolUse hook
- `chorz/src/__tests__/arch-doc-cf-claims.test.ts` — value-based parser ratchet
