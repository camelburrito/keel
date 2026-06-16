# Authoring architecture docs

_Read this before you create or substantially edit any `docs/architecture/*.md`._

These docs exist to answer one question fast: **"how does this part of the
system actually work?"** — without reverse-engineering it from 20+ files. They
are descriptive (what the code does today), not aspirational (what we wish it
did) and not procedural (no phase numbers, decision IDs, or PR-process
scaffolding — that belongs in `.planning/` and commit messages).

This guide is the contract. Half of it is mechanically enforced by the
`archDocIntegrity` ratchet from [`@camelburrito/ratchet-kit`](https://github.com/camelburrito/keel);
the other half is judgment that the author and reviewer own. Both halves are
below. For the full convention — index, drift defenses, when to split a doc —
see playbook [04 — Architecture Docs](../docs/playbook/04-architecture-docs.md).

---

## The four principles

1. **Readable top-down.** Open with a 2–4 sentence mental model: what this
   subsystem is, what problem it solves, and the one diagram that frames it. A
   reader should understand the shape before hitting any detail. Lead with the
   "why" and the flow, then drill into fields/contracts.

2. **Diagram-rich.** Every subsystem doc carries at least one mermaid diagram,
   and complex flows get their own. A `flowchart` for structure, a
   `sequenceDiagram` for request/response paths, a state diagram for lifecycles.
   The diagram is the spine; prose hangs off it. Prefer one clear diagram per
   distinct flow over one mega-diagram.

3. **Content-named sections.** Headings name what the section is _about_
   ("Token storage path", "Conflict resolution"), never process artifacts
   ("Phase N changes", "Decision D-12"). A reader scanning the table of contents
   should be able to find the answer by topic.

4. **Grounded in source.** Every claim traces to real code. Cite the actual file
   (`path/to/the/module.ext`), the actual count, the actual field name. If you
   can't point at the code, don't assert it. When a number or path is
   load-bearing (handler counts, rate limits, a collection total), a value-based
   parser test already pins it — keep them in sync.

---

## What the ratchet enforces (mechanical — can't regress)

`archDocIntegrity` (from `@camelburrito/ratchet-kit`, wired into your repo's
ratchet suite) runs at pre-commit + CI and fails the build on any of these. It
is strict-zero: zero violations, always.

- **Links resolve.** Every `[text](./other-doc.md)` points at a file that
  exists. Every `[text](#anchor)` and `[text](./other.md#anchor)` points at a
  real heading — validated against GitHub's exact heading-slug algorithm (so a
  link that works in your editor but 404s on GitHub is caught here).
- **Cited paths exist.** Any inline `` `code` `` span that is a fully-qualified
  repo path (starts with a real top-level dir and ends in a source extension)
  must name a file that exists — and the `path/to/file.ext:42` line-reference
  form validates against the file too. This is the gate that catches
  fabricated-by-paraphrase citations — the single most common drift class.
  Base-relative shorthand (`audit/writeWithAudit.ts` after you've said "under
  `the/feature/dir/`") is allowed and not checked, as are generated/ephemeral
  build outputs.
- **Mermaid renders on GitHub.** The ratchet flags the GitHub-renderer traps it
  has seen break a real diagram: in a node or pipe-delimited edge label, a
  literal `\n` (use `<br/>`), `&&` (renders as an HTML entity), a raw `<tag>`
  other than `<br/>` (GitHub silently drops it — this is how `<placeholder>`
  text vanishes), or a backslash-escaped quote `\"` (mermaid has no `\"` escape —
  use the `#quot;` entity); plus a `.` inside a `-. dotted .->` edge label (the
  `.->` close token is lexed on the first `.`, aborting the parse) and a `;` in
  any sequenceDiagram line — message/note text or a colon-less `loop`/`alt`
  guard (a statement separator — use `,` or `—`). It also flags a `classDef`
  that sets a `fill:` but no text `color:` — GitHub's dark theme paints that
  node's label light-on-light-pastel (illegible), so pin an explicit `color:`
  (a dark ink on the pastel fills, `#fff` on a saturated one) to make the text
  theme-independent.
- **Footer present.** Every doc except `README.md` ends with a
  `**Last updated:** YYYY-MM-DD` line. Re-anchor it when you ship a change.

`archDocIntegrity` is the third leg of the drift defense. The other two cover
claims it doesn't: a **value-based parser** test pins numeric claims (counts,
rate limits, version numbers) against parsed source of truth; the
**citation hook** (`architecture-doc-drift.sh`) nudges a same-PR doc update when
a file a doc cites is edited. See playbook 04 for all three tiers.

---

## What the reviewer owns (judgment — not mechanizable)

A ratchet can prove a link resolves; it can't prove the doc is _good_. Before a
doc change ships, the author and reviewer confirm:

- The mental-model intro is present and actually orients a newcomer.
- The diagrams match the prose and the current code (a stale diagram is worse
  than none).
- Sections are named by content, and the doc reads top-down without forward
  references.
- Claims are grounded — spot-check a few citations against the real code rather
  than trusting paraphrase. When a subagent or draft asserts a count or path,
  **verify it against source** — paraphrased numbers drift.
- No process scaffolding leaked in (phase numbers, decision IDs, "this PR…").

---

## Pre-PR checklist

Before opening a PR that touches a `docs/architecture/*.md`:

- [ ] Mental-model intro + at least one diagram present for the subsystem.
- [ ] Headings are content-named; no phase/decision/PR scaffolding in the prose.
- [ ] Spot-checked the load-bearing claims (counts, paths, field names) against
      real code.
- [ ] The `archDocIntegrity` ratchet passes (links, anchors, cited paths,
      mermaid, footer) — run it via your repo's ratchet suite.
- [ ] `**Last updated:**` footer re-anchored to today.
- [ ] If a documented behavior changed, the doc changed in the **same PR** (not
      deferred to a follow-up).

---

**Last updated:** YYYY-MM-DD
