# Recipe: Add an Architecture Doc

When a subsystem stabilizes, write its canonical reference doc so the next reader doesn't have to reverse-engineer it from 20+ files.

## When to add one

- A new major subsystem has shipped (auth, calendar, scheduling, payments).
- An existing subsystem has grown beyond what fits in inline comments + README.
- You found yourself explaining the same system to yourself or a collaborator twice.

## File location

`docs/architecture/<system-name>.md` — kebab-case slug.

## Standard sections

```markdown
# <System Name>

**Status:** stable | in-flight | deprecated
**Last updated:** YYYY-MM-DD (<phase or quick name>)

## 1. Top-level layout
What files compose this system. Tree or file inventory.

## 2. Data flow
Mermaid sequence diagram showing the happy-path flow.

## 3. Core invariants
The things that must always be true. Each one ideally paired with a ratchet
or test that defends it (cite the test file path).

## 4. Pitfalls
Lessons learned. Each pitfall: the symptom, the root cause, the fix, the
defense that now prevents recurrence.

## 5. Interactions with other subsystems
Brief callouts to the other arch docs this one depends on or affects.

## 6. Operational runbook (if applicable)
Per-environment commands, common triage flows, on-call references.
```

## Read the authoring contract first

Before writing, read [`templates/_AUTHORING.md`](../templates/_AUTHORING.md) — the four principles (readable top-down, diagram-rich, content-named sections, grounded in source), the mechanical-vs-judgment split, and the pre-PR checklist. Copy it to `docs/architecture/_AUTHORING.md` in your repo if it isn't there yet; it's the contract every doc author reads.

The mechanical half of that contract is enforced by `archDocIntegrity` from `@camelburrito/ratchet-kit`: every relative link + `#anchor` resolves (GitHub-exact slugs), every fully-qualified inline `` `path/to/file.ext` `` citation exists on disk, mermaid carries no GitHub-renderer traps (`\n`/`&&`/raw `<tag>`), and the `Last updated` footer is present. Run the ratchet suite before opening the PR — it's strict-zero.

## Wire it into the drift defenses

1. **Citation hook** — list every file path your doc cites in `.claude/hooks/architecture-doc-drift.sh` (the script greps doc bodies for citations). When someone edits a cited file, the hook prompts them to re-anchor the doc.
2. **Value parsers** — for claims that are counts or version numbers, write a parser-test that reads source ground truth and asserts the doc's claim matches. See `chorz/src/__tests__/arch-doc-cf-claims.test.ts` for the canonical example.
3. **Integrity ratchet** — `archDocIntegrity` from `@camelburrito/ratchet-kit` validates that every citation RESOLVES (links, anchors, cited paths), mermaid renders, and the footer is present. No per-doc wiring needed — it scans the whole `docs/architecture/` directory once it's in the suite.
4. **Last-updated footer** — re-anchor it whenever you ship a change that affects this system.
5. **Same-PR rule** — when a code change affects a documented system, update the doc in the SAME PR. Don't defer.

## Add to the index

Update `docs/architecture/README.md` with a row for the new doc.

## Related playbook

- [04-architecture-docs.md](../docs/playbook/04-architecture-docs.md) — convention + drift hooks
