# 02 — Design System

**Status:** 🟡 outlined
**Reference impl:** `chorz/CLAUDE.md § Design System Governance`, `chorz/src/ui/`, `chorz/shared/tokens/tokens.json`, `chorz/docs/architecture/design-system-architecture.md`

## Why this exists

Visual surfaces drift fast and break silently. A token-first, hierarchical UI system + a strict-zero ratchet baseline catches drift at write-time (ESLint), pre-commit, and CI — before it ships. Cross-platform parity (web + iOS, eventually Android) is enforced via codegen from a single source of truth.

## What you must satisfy — the four mandates

1. **Token Mandate** — all colors / spacing / typography / motion values flow through `shared/tokens/tokens.json`. Codegen emits per-platform consumables (CSS vars for web, hex/Color literals for Swift). Allowed exceptions: `0`, `100%`, `auto`, `none`, `transparent`.
2. **Hierarchy Mandate** — four layers: L1 Tokens → L2 Primitives (unstyled behavior) → L3 Elements (styled single-purpose) → L4 Components (composed). Pages and features compose using L2+ only; they don't introduce styled atoms.
3. **Off-grid Mandate** — any value that can't be tokenized is a named TypeScript/CSS constant with a `// Design-intent constant — <reason> (see GH #<issue>)` comment.
4. **String Catalog Mandate** — all user-facing strings flow through `shared/strings/catalogs/<locale>.json` via a `t()` helper. See [08-string-catalog-i18n.md](08-string-catalog-i18n.md).

## What enforces this

- `@camelburrito/ratchet-kit` — 22+ structural ratchets defending the four mandates (no-inline-style, no-bare-hex-in-{css,tsx,swift}, no-bare-px-in-css, no-undefined-tokens, no-3char-hex-in-tsx, no-important-css, no-bare-rgba-in-css, etc.).
- Per-project `src/__tests__/<your-business-rule>.test.ts` ratchets for project-specific anti-patterns (e.g., `no-legacy-kid-cta-token` in chorz).
- `npm run tokens:check` + `npm run strings:check` in `prebuild` and pre-commit.

## Sections (TODO when drafted)

1. Token file shape + codegen pipeline (`scripts/gen-tokens.mjs`)
2. The four-layer hierarchy with examples
3. Cross-platform parity model (one fixture, two contract tests)
4. Authoring a new L3 element
5. Ratchet wiring: which `@camelburrito/ratchet-kit` exports to call, with what config
6. Project-specific ratchet recipes — see [recipes/add-a-ratchet.md](../../recipes/add-a-ratchet.md)

## Reference reading

- `chorz/shared/tokens/tokens.json` — token source of truth
- `chorz/src/ui/tokens.generated.css` + `chorz/packages/ChorzCore/Sources/ChorzCore/Tokens/Colors.generated.swift` — codegen outputs
- `chorz/src/__tests__/no-inline-style.test.ts` — exemplar ratchet
- `chorz/docs/architecture/design-system-architecture.md` — full architecture doc
