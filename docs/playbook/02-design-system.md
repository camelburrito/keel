# 02 — Design System

**Status:** 🟢 drafted
**Reference impl:** `chorz/CLAUDE.md § Design System Governance`, `chorz/src/ui/`, `chorz/shared/tokens/tokens.json`, `chorz/docs/architecture/design-system-architecture.md`

---

## The principle

Visual surfaces drift faster than any other layer of a codebase. Bare hex literals, inline styles, one-off pixel offsets, and ad-hoc UI atoms accumulate over months and become the dominant source of "this surface doesn't match the rest of the app." A token-first, hierarchical UI system + a strict-zero ratchet baseline + cross-platform codegen from a single source of truth catches drift at write-time (ESLint), pre-commit (ratchets), and CI — before it ships.

Four mandates compose the system. Each is enforced structurally (ratchets), not advisory.

---

## 1. The four mandates

### Mandate 1 — Token Mandate

All colors, spacing, typography, motion values, and breakpoints flow through `shared/tokens/tokens.json`. Codegen (`scripts/gen-tokens.mjs`) emits per-platform consumables:

- Web: `src/ui/tokens.generated.css` — CSS custom properties (`--color-accent-primary: #0066FF`).
- iOS: `packages/<Core>/Sources/<Core>/Tokens/<Family>.generated.swift` — Swift static lets in token-family structs (`Colors.Accent.primary`, `Spacing.md`).
- Android (when it lands): `packages/<Core>/.../tokens/<Family>.generated.kt`.

**Allowed exceptions** in source code: `0`, `100%`, `auto`, `none`, `transparent`. The `no-undefined-tokens` ratchet will flag drift (refs to tokens that don't exist in the JSON).

**Per-platform encoding is load-bearing.** Web gets `var(--color-accent-primary)` references; Swift gets a literal `#hex` baked into the `Color(red:green:blue:)` call. Codegen is responsible for "same source, different encoding" so consumers never need to know they're sharing tokens cross-platform (memory rule `feedback_codegen_per_platform`).

### Mandate 2 — Hierarchy Mandate

Four layers, ordered:

1. **L1 — Tokens** (`shared/tokens/tokens.json` → generated per-platform).
2. **L2 — Primitives** (`src/ui/primitives/`) — unstyled, behavior-only (focus rings, accessibility attrs, click outside, portal mounts).
3. **L3 — Elements** (`src/ui/elements/`) — styled single-purpose UI (`Button`, `Input`, `Badge`, `Avatar`, `IconTile`).
4. **L4 — Components** (`src/ui/components/`) — composed UI (`Modal`, `Card with header`, `ChoreCard`).

Pages (`src/pages/`) and features (`src/features/`) compose using L2+ only. They MUST NOT introduce new styled atoms — that's an L3 promotion candidate that goes through review.

The iOS equivalent: `packages/<Core>UI/Sources/<Core>UI/Atoms/` for L3 elements, `Components/` for L4. The cross-platform parity is enforced by paired contract fixtures (see [06-testing-cadence.md § Sub-pattern: cross-platform contract fixtures](06-testing-cadence.md)).

### Mandate 3 — Off-Grid Mandate

Any value that genuinely cannot be tokenized (e.g., a one-off pixel offset earned by a specific design intent, a viewport-bound transition duration earned by a user-research outcome) MUST be a named TypeScript/CSS/Swift constant with an inline comment of the form:

```ts
const TOAST_REVIEW_HOLD_MS = 6000; // Design-intent constant — explicit user-review pause (see GH #309)
```

```swift
let ctaHeight: CGFloat = 64 // Design-intent constant — kid-finger tap target (see GH #309)
```

The `// Design-intent constant — <reason> (see GH #<issue>)` comment shape is what the bare-literal ratchets recognize as a legitimate carve-out. GH #309 is the chorz precedent that established the pattern.

**Memory rule `feedback_no_new_tokens_without_approval`:** snap literals onto the closest existing token by default. Don't add new tokens to `tokens.json` without explicit approval. The off-grid escape is the right path for one-offs.

### Mandate 4 — String Catalog Mandate

All user-facing strings flow through `shared/strings/catalogs/<locale>.json` via a `t()` helper. The catalog ships codegen-emitted per-platform consumables identical in shape to the token pipeline. See [08-string-catalog-i18n.md](08-string-catalog-i18n.md) for the full pipeline; the design-system relevance is that strings are part of the same source-of-truth model as tokens.

---

## 2. What enforces this

Structural enforcement via `@camelburrito/ratchet-kit` exports, all strict-zero or count-tracked deferral baseline. The full list lives in [07-ratchet-framework.md](07-ratchet-framework.md); the design-system-relevant subset:

| Ratchet | Defends |
|---------|---------|
| `noInlineStyle` | inline `style={{}}` in JSX |
| `noBareHexInTsx`, `noBareHexInCss`, `noBareHexInSwift` | bare `#hex` literals outside token-source files |
| `noBareRgbaInCss` | `rgba(...)` color drift |
| `noBarePxInCss` | bare `Npx` literals |
| `noBareSizeInSwift`, `noBareDurationInSwift`, `noBareFontSizeInSwift`, `noBareColorConstructorInSwift` | bare iOS literals |
| `noImportantCss` | `!important` declarations |
| `noUndefinedTokens` | refs to CSS custom props not declared in `tokens.generated.css` |
| `no3CharHexInTsx` | 3-char hex shorthand (different regex shape, parallel coverage) |
| `noBareHexInCodegenOutput` | hex literals in generator-emitted files (cross-platform contract gate) |
| `noBareFontPropertyInCss`, `noBareViewportEmInCss` | typography shorthand + viewport-relative drift |

Project-specific ratchets defending product anti-patterns (e.g., `no-legacy-kid-cta-token` in chorz) live in the project's own `src/__tests__/`. Recipe: [recipes/add-a-ratchet.md](../../recipes/add-a-ratchet.md).

Additional gates:
- `npm run tokens:check` (prebuild + pre-commit) — verifies codegen is in sync.
- ESLint with the `no-console: error` rule (paired with [05-observability-pii.md](05-observability-pii.md)).
- The pre-merge UI checklist at [checklists/pre-merge-ui-checklist.md](../../checklists/pre-merge-ui-checklist.md).

---

## 3. Cross-platform parity model

Same source, different encoding. Same logic, two runners.

- **Tokens:** one `tokens.json` → CSS vars for web, Swift literals for iOS. The `no-bare-hex-in-codegen-output` ratchet defends against the generator emitting bare hex instead of per-platform token references (the chorz Phase 1051 Plan 06 incident: `gen-icons.cjs` emitting bare hex in the var-reference map; defended by ratchet from then on).
- **Presentation projectors:** one TS function + one Swift mirror produce identical `<Card>Presentation` data from the same input shape. One JSON fixture per scenario at `shared/test-fixtures/<system>/<scenario>/{input,expected}.json`; one TS contract test + one Swift contract test consume the same fixtures and assert byte-equality.
- **UI atoms:** L3 elements with the same name + same props on web and iOS, rendering the same visual shape. Snapshot tests on both sides (RTL on web, `swift-snapshot-testing` on iOS) lock the rendered output.

---

## 4. Authoring a new L3 element

1. Survey existing L3 atoms — is there one that fits with a new variant prop? If yes, extend. If no, proceed.
2. Implement on the canonical platform first (web for most products; iOS for native-first products).
3. Define the props shape in a way that's portable cross-platform.
4. Implement the mirror on the second platform.
5. Add snapshot tests on both.
6. If the atom takes data that comes from a CF response, add a `<Atom>Presentation` projector + paired contract fixture.
7. Update the design-system architecture doc with an entry for the new atom (its props, its variants, when to use it).

**The reuse rule** (memory `feedback_component_reuse`): never duplicate styling patterns or icon mappings. Parameterize via `variant` / `size` props or extract a View modifier extension. Two near-identical atoms is the start of drift.

---

## 5. The promotion path: feature → element → token

A pattern that's introduced inline in a feature (and survives one cycle of "we keep needing this") earns L3 promotion. A literal value used by two L3 elements with the same intent earns a token promotion. The promotion gate is review (PR conversation), not automation — but the friction of adding a token is intentional. The default is reuse.

---

## 6. Anti-patterns

- **New L3 atom in a feature directory.** Move it to `src/ui/elements/`.
- **Mirroring a styled prop chain across multiple components.** Extract a variant prop on an existing atom.
- **Cross-platform parity by copy-paste.** Use the projector + fixture pattern so both platforms read from the same source.
- **`!important` to override a parent.** The parent is wrong; fix it upstream.
- **Adding a token without verifying no existing token fits.** Snap to nearest existing token first.

---

## Reference reading

- `chorz/shared/tokens/tokens.json` — token source of truth
- `chorz/src/ui/tokens.generated.css` — web codegen output
- `chorz/packages/ChorzCore/Sources/ChorzCore/Tokens/Colors.generated.swift` — Swift codegen output
- `chorz/src/ui/elements/` — exemplar L3 atoms
- `chorz/src/ui/components/ChoreCard/ChoreCard.tsx` — exemplar L4 component with cross-platform projector
- `chorz/packages/ChorzUI/Sources/ChorzUI/Atoms/ChoreCard.swift` — iOS mirror
- `chorz/shared/test-fixtures/chore-card/` — paired contract fixtures
- `chorz/src/__tests__/no-inline-style.test.ts` — exemplar ratchet
- `chorz/docs/architecture/design-system-architecture.md` — full architecture doc (§ 3.5 covers string catalog)
- `chorz/CLAUDE.md § Design System Governance` — project-level enforcement narrative
