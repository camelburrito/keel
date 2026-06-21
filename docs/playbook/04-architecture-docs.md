# 04 — Architecture Docs Convention

**Status:** 🟢 drafted
**Reference impl:** `chorz/docs/architecture/`, `chorz/.claude/hooks/architecture-doc-drift.sh`, `chorz/src/__tests__/arch-doc-cf-claims.test.ts`

---

## The principle

A subsystem reverse-engineered from 20+ files takes hours per pass. Anyone — you in 6 months, a collaborator, a Claude session resumed cold — will do that reverse-engineering badly the first time and waste a day catching back up to what was already known. The fix is canonical `docs/architecture/<system>.md` per major subsystem, read first, then read code.

Drift is the failure mode. Architecture docs that ship inaccurate after 3 months of code changes are worse than no docs — they mislead the reader into trusting a stale model. Three structural mechanisms catch drift:

1. **Citation hook** — a PostToolUse Claude Code hook flags edits to files cited by name in any arch doc. Prompts the editor to re-anchor the doc in the same PR.
2. **Value-based parsers** — vitest tests that parse the doc AND the source of truth, then assert claims match. Catches drift the citation hook can't see (counts, rate limits, version numbers).
3. **Integrity ratchet** — `archDocIntegrity` from `@camelburrito/ratchet-kit` asserts every citation a doc makes RESOLVES: links + anchors point at real files/headings, inline cited paths exist on disk, mermaid renders on GitHub, footer present.

---

## What you must satisfy

- `docs/architecture/README.md` — index listing every doc with status + last-updated date.
- One doc per major subsystem: auth, data model, audit trail, design system, state machines, cloud functions, observability, etc. Add new ones as systems stabilize, not aspirationally.
- Each doc carries a `Last updated: YYYY-MM-DD (<phase or quick name>)` footer; re-anchor it when you ship a change that affects the system.
- PostToolUse hook at `.claude/hooks/architecture-doc-drift.sh` — flags edits to files cited by name in any arch doc.
- Value-based parsers for claims the citation hook can't catch (counts, rate limits, version numbers). Chorz's `arch-doc-cf-claims.test.ts` is the canonical example.
- `archDocIntegrity` from `@camelburrito/ratchet-kit` wired into the ratchet suite — every link/anchor/cited-path resolves, mermaid has no renderer traps, footer present. Strict-zero.
- The authoring contract itself: see [`templates/_AUTHORING.md`](../../templates/_AUTHORING.md) — the four principles, the mechanical/judgment split, the pre-PR checklist.
- Updates land **in the same PR** as the code change — never deferred to a follow-up.

---

## 2. The three-tier drift defense

### Tier 1 — citation hook

`.claude/hooks/architecture-doc-drift.sh` runs after every `Edit` / `Write` tool call. It greps every `docs/architecture/*.md` for citations matching file paths (e.g., `src/lib/firebase/auth.ts`, `functions/src/chores/transitionChoreStatus.ts`). When the just-edited file appears in any doc's body, the hook emits a reminder: "this file is cited by `docs/architecture/<doc>.md`; consider whether the doc needs to be updated in the same PR."

The hook is project-scoped in `.claude/settings.json`. It's a reminder, not a blocker — the editor decides whether the change is doc-relevant. The reminder is the load-bearing part; without it, you forget.

### Tier 2 — value-based parsers

The citation hook only fires on path-cited files. For claims that aren't file-citations (e.g., "the default codebase has 30 onCall handlers", "calendar codebase rate limits are 5/min for OAuth"), the hook can't help. Value-based parsers fill the gap:

- `chorz/src/__tests__/arch-doc-cf-claims.test.ts` — parses `functions/src/**/*.ts` for ground truth (onCall handler count, per-CF `checkRateLimit` values), then parses `docs/architecture/cloud-functions.md`, then asserts claims match. Failure message points at exactly which claim drifted with the new value to drop in.

The pattern is generalizable: for any documented numeric claim ("we have N CFs", "K database collections", "M strict-zero ratchets in the pre-commit list"), write a parser that reads the source AND the doc claim and asserts equality. Strict-zero from day 1 — there's no carve-out for "stale claim, will fix later" because the carve-out IS the bug.

### Tier 3 — integrity ratchet

The citation hook and value parsers both assume the doc's _structure_ is sound — that a `[link](#anchor)` actually points somewhere, that an inline `` `path/to/file.ext` `` citation names a real file, that a mermaid block renders. None of them check that. That structural class is the most mechanical and the most common: a heading-slug anchor that doesn't exist, a relative link to a moved file, a fabricated-by-paraphrase path citation, a node label carrying a GitHub-renderer trap (`\n`, `&&`, an unescaped `<tag>` that silently drops the text). `archDocIntegrity` from `@camelburrito/ratchet-kit` closes it:

- **Links + anchors resolve** — `[text](./other.md)` to a real file; `[text](#anchor)` and `[text](./other.md#anchor)` to a real heading, slugged with GitHub's exact algorithm (so an editor-valid link that 404s on GitHub is caught).
- **Cited paths exist** — any inline `` `code` `` span that is a fully-qualified repo path (real top-level dir + source extension, incl. the `file.ext:42` line-reference form) must name a file on disk. Base-relative shorthand and generated/ephemeral build outputs are skipped.
- **Mermaid renders on GitHub** — the full set of GitHub-renderer traps grounded against the real parser: in a node or pipe-delimited edge label, a `\n` (use `<br/>`), `&&` (renders as an HTML entity), a raw `<tag>` other than `<br/>` (GitHub drops it), or a backslash-escaped quote `\"` (mermaid has no `\"` escape — use `#quot;`); a `.` inside a `-. dotted .->` edge label (the `.->` close token lexes on the first `.`); a `;` in any `sequenceDiagram` line (a statement separator); and a `classDef`/`style` that sets a `fill:` but no text `color:` (GitHub's dark theme paints light text on the light fill — illegible).
- **Footer present** — every doc except `README.md` carries a `Last updated` line.

Strict-zero from day 1: the carve-out for "broken link, will fix later" IS the bug. The judgment half of the contract — readable intros, content-named sections, a diagram per subsystem, grounded claims — can't be mechanized and lives in [`templates/_AUTHORING.md`](../../templates/_AUTHORING.md) + the pre-PR checklist there.

> **The ratchet is a heuristic, not a full parse — the authoritative mermaid check is a real render.** `archDocIntegrity` text-scans for known trap classes; it cannot prove a diagram renders. Twice now a clean ratchet has shipped diagrams that broke on GitHub: four parse-aborting diagrams slipped a pre-render ratchet, and an entire fleet of diagrams went illegible in dark mode before the `classDef`-color rule existed. When you touch diagrams — or before you trust a new trap rule — extract every ` ```mermaid ` block and run it through the real engine (`mermaid.parse()` via jsdom, or `npx @mermaid-js/mermaid-cli`). "Looks fine in mermaid.live" is not "renders on GitHub," and a green ratchet is not a guarantee. When a new trap surfaces, **ground the rule against the real parser first**, then add it to `findMermaidTraps`/`findContrastTraps` and a row here.

---

## 3. Anatomy of a good architecture doc

```markdown
# <System Name>

**Status:** stable | in-flight | deprecated
**Last updated:** YYYY-MM-DD (<phase or quick name>)

## 1. Top-level layout
Tree or file inventory. What files compose this system.

## 2. Data flow
Mermaid sequence diagram showing the happy-path flow. Optional but high-leverage.

## 3. Core invariants
The things that must always be true. Each invariant ideally paired with a
ratchet or test that defends it (cite the test file path inline).

## 4. Pitfalls
Lessons learned. Each pitfall: symptom → root cause → fix → defense that
now prevents recurrence. This section grows over time and is the
highest-leverage reading for someone new to the system.

## 5. Interactions with other subsystems
Brief callouts to the other arch docs this one depends on or affects.

## 6. Operational runbook (if applicable)
Per-environment commands, common triage flows, on-call references.

---

**Last updated:** YYYY-MM-DD (<phase or quick name>).
```

The chorz `docs/architecture/cloud-functions.md`, `pii-handling.md`, `calendar-oauth-and-scheduling.md`, and `data-model.md` all follow this shape. Look at any of them for a concrete example.

---

## 4. When to add a new doc vs. extend an existing one

**Add new** when:
- A new major subsystem ships (auth, payments, notifications, calendar).
- An existing subsystem has grown beyond what fits as a section in another doc.
- You found yourself explaining the same system to yourself or a collaborator twice.

**Extend existing** when:
- A new sub-feature ships within an established subsystem (e.g., a new CF in an existing codebase → extend `cloud-functions.md`, don't create `cloud-functions-v2.md`).
- The change refines an invariant or adds a pitfall to an existing doc.

The cost of a new doc is the citation hook + parser-test setup (a few minutes); the cost of NOT splitting a doc that has outgrown its scope is the next reader wading through 800 lines of conflated systems. Err toward splitting when the doc clearly has two stories.

---

## 5. The Last-updated footer + re-anchoring

Every doc ends with:
```markdown
**Last updated:** YYYY-MM-DD (<phase or quick name>) — <one-line summary of what changed>.
```

When you ship a change affecting this system, **prepend** a new line to the footer (don't overwrite) so the doc carries its own change history. Over time the footer becomes a per-doc changelog you can grep.

The footer also signals to readers "this doc was current as of X." If the date is months old and the underlying system has clearly evolved, that's a flag — either the doc needs updating, or the system's been stable enough that the date is irrelevant. Either way, the date helps.

---

## 6. The same-PR rule

When a code change affects a documented system, **update the doc in the same PR**. Don't defer to a follow-up. Two reasons:

1. Follow-ups slip. By the time anyone notices the drift, the original context for the change is gone and the doc update takes 3x longer.
2. The drift detector (citation hook) is loudest at write time. By the time the PR is open, you've already seen the reminder; the cost to act is low.

User-memory rule `feedback_pr_nits_before_merge` reinforces this: fix root-cause changes in the same PR, not in follow-ups.

---

## 7. Pre-merge UI checklist cross-reference

For PRs touching UI, the pre-merge checklist's "Architecture docs" section asks whether `design-system-architecture.md` needs an update. See [checklists/pre-merge-ui-checklist.md](../../checklists/pre-merge-ui-checklist.md).

---

## 8. Adopting this playbook

- [ ] `docs/architecture/README.md` from template (one entry per future doc, even as TODOs).
- [ ] First arch doc when first subsystem stabilizes (don't write aspirational docs for systems that don't exist yet).
- [ ] `.claude/hooks/architecture-doc-drift.sh` from template, wired in `.claude/settings.json`.
- [ ] Value-based parser test for any doc that cites numeric claims (counts, rate limits, version numbers).
- [ ] `archDocIntegrity` from `@camelburrito/ratchet-kit` wired into the ratchet suite (links/anchors/cited-paths/mermaid/footer — strict-zero).
- [ ] `templates/_AUTHORING.md` copied to `docs/architecture/_AUTHORING.md` — the authoring contract authors read before editing any doc.
- [ ] User-memory rule `feedback_ask_skills_arch_docs` loaded — surfaces "do skills or arch docs need updates?" before every PR ships.

---

## Reference reading

- `chorz/docs/architecture/README.md` — index of 9 docs
- `chorz/docs/architecture/cloud-functions.md` — exemplar with both citation hook AND value-parser ratchet defending it
- `chorz/docs/architecture/pii-handling.md` — the canonical PII inventory (see [05-observability-pii.md](05-observability-pii.md))
- `chorz/docs/architecture/calendar-oauth-and-scheduling.md` — exemplar with mermaid sequence diagrams + Pitfalls section
- `chorz/.claude/hooks/architecture-doc-drift.sh` — citation-based PostToolUse hook
- `chorz/src/__tests__/arch-doc-cf-claims.test.ts` — value-based parser ratchet
- `chorz/.claude/skills/systems-architecture-doc/` — the skill that documents how to write a new arch doc end-to-end
