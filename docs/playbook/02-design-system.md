# 02 — Design System

**Status:** 🟢 drafted

---

## The principle

Visual surfaces drift faster than any other layer of a codebase. Bare hex literals, inline styles, one-off pixel offsets, and ad-hoc UI atoms accumulate over months and become the dominant source of "this surface doesn't match the rest of the app." A token-first, hierarchical UI system + a strict-zero ratchet baseline + cross-platform codegen from a single source of truth catches drift at write-time (ESLint), pre-commit (ratchets), and CI — before it ships.

Four mandates compose the system. Each is enforced structurally (ratchets), not advisory.

---

## The design source of truth (where token values come from)

The four mandates govern how design values flow *through* the codebase — but they say nothing about where the values themselves come from. `tokens.json` is the source of truth *for the code*; it is not where the design is *decided*. A design surface is decided in a **design tool**, and the tool — not a developer's eyeballing — is the authority for the palette, the type scale, elevation, and the interaction-affordance rules. `tokens.json` is the **materialization** of that design, encoded for codegen.

```
design.md  ─►  design tool (Stitch)  ─►  tokens.json  ─►  per-platform codegen
(committed     (ingests the spec &       (encoded for     (CSS vars · Swift · …)
 hand-authored  renders the system)       the code)
 spec)

reconcile (◄): tokens.json must always agree with the design source on its
left (design.md + the rendered system); on conflict, the design source wins.
The flow is one-way — and design.md is hand-authored, never exported back out
of the tool — so never hand-edit tokens.json to diverge without changing
design.md / the design tool first.
```

### Stitch as the canonical design tool

[Stitch](https://stitch.withgoogle.com/) is the worked example here, the same way Firebase, Playwright, and mermaid are named tools elsewhere in this playbook — it is a general design tool, not coupled to any one product. The flow:

1. **The design system lives in Stitch.** A named design system (palette, type scale, spacing, elevation, component rules) is created and iterated in the tool. Stitch can **ingest a `design.md`** (a plain-text design spec) to create a design system, **apply** that system to generated screens, and **generate screen variants** so you can preview a real surface before any code exists. The `design.md` is the durable, reviewable, version-control-friendly bridge between the visual tool and `tokens.json`.
2. **The design system governs a specific scope.** Reconcile token values against the tool for: **palette / colors**, **the type scale** (sizes, weights, case — e.g. an uppercase small-label style at a fixed size/weight), **spacing & radii**, **elevation** (e.g. a hard offset shadow), and **interaction-affordance rules** (e.g. a fixed border width + press-offset on buttons). When a value in `tokens.json` disagrees with the tool, the tool wins — update `tokens.json` to match, then codegen. Expect this to be a translation, not a mechanical copy: a design tool typically models a simpler palette (often one light/dark mode at a time) than your full token set with its dark-mode swap block (§ 7), so treat the tool's values as the authoritative *starting point* that your richer token structure encodes.
3. **The design system does NOT govern everything.** Things the tool leaves unspecified — a one-off per-icon pixel size, a specific surface's bespoke offset — are governed by **local convention** (sibling-consistency: match the size its peer elements already use) and the **Off-Grid Mandate** (§ 1, Mandate 3) escape — a named constant carrying the Mandate-3 design-intent comment. Don't invent a token for these, and don't pretend the design tool dictated them.

### Direction of flow is one-way

The tool (and its `design.md`) is **upstream**; `tokens.json` is **downstream**. Hand-editing `tokens.json` to diverge from the design system — without updating the design system first — is the drift this whole layer exists to prevent. If a value needs to change, change it in the design tool / `design.md`, then bring `tokens.json` into agreement. The reconciliation is a real review step when you add or restyle a UI atom: *does this match what the design system says for color / type / elevation / affordance?*

### Iteration hygiene

When you iterate mocks in the design tool, **prune superseded versions immediately** once the replacement is confirmed. A design-tool project littered with stale variants stops being a single source of truth — the next person can't tell which screen is current. One current truth per surface, in the tool and in `tokens.json` alike.

### The tool is an input; the ratchets are the enforcement

A design tool cannot stop a developer from typing a bare hex in a feature file — it has no reach into the codebase. That is exactly what Mandate 1 + the bare-literal ratchets do. The division of labor: **the design tool decides the values; `tokens.json` + codegen carry them into every platform; the ratchets keep feature code from drifting off them.** All three are required; none substitutes for another.

**Procedure:** [recipes/sync-design-system-from-a-design-tool.md](../../recipes/sync-design-system-from-a-design-tool.md).

---

## 1. The four mandates

### Mandate 1 — Token Mandate

All colors, spacing, typography, motion values, and breakpoints flow through `shared/tokens/tokens.json`. Codegen (`scripts/gen-tokens.mjs`) emits per-platform consumables:

- Web: `src/ui/tokens.generated.css` — CSS custom properties (`--color-accent-primary: #0066FF`).
- iOS: `packages/<CoreUI>/Sources/<CoreUI>/Tokens/<Family>.generated.swift` — Swift static lets in token-family structs (`Colors.Accent.primary`, `Spacing.md`).
- Android (when it lands): `packages/<CoreUI>/.../tokens/<Family>.generated.kt`.

**Allowed exceptions** in source code: `0`, `100%`, `auto`, `none`, `transparent`. The `no-undefined-tokens` ratchet will flag drift (refs to tokens that don't exist in the JSON).

**Per-platform encoding is load-bearing.** Web gets `var(--color-accent-primary)` references; Swift gets a literal `#hex` baked into the `Color(red:green:blue:)` call. Codegen is responsible for "same source, different encoding" so consumers never need to know they're sharing tokens cross-platform.

### Mandate 2 — Hierarchy Mandate

Four layers, ordered:

1. **L1 — Tokens** (`shared/tokens/tokens.json` → generated per-platform).
2. **L2 — Primitives** (`src/ui/primitives/`) — unstyled, behavior-only (focus rings, accessibility attrs, click outside, portal mounts).
3. **L3 — Elements** (`src/ui/elements/`) — styled single-purpose UI (`Button`, `Input`, `Badge`, `Avatar`, `IconTile`).
4. **L4 — Components** (`src/ui/components/`) — composed UI (`Modal`, `Card with header`, a domain card composed of multiple elements).

Pages (`src/pages/`) and features (`src/features/`) compose using L2+ only. They MUST NOT introduce new styled atoms — that's an L3 promotion candidate that goes through review.

The iOS equivalent: `packages/<CoreUI>/Sources/<CoreUI>/Atoms/` for L3 elements, `Components/` for L4. The cross-platform parity is enforced by paired contract fixtures (see [06-testing-cadence.md § Sub-pattern: cross-platform contract fixtures](06-testing-cadence.md)).

### Mandate 3 — Off-Grid Mandate

Any value that genuinely cannot be tokenized (e.g., a one-off pixel offset earned by a specific design intent, a viewport-bound transition duration earned by a user-research outcome) MUST be a named TypeScript/CSS/Swift constant with an inline comment of the form:

```ts
const TOAST_REVIEW_HOLD_MS = 6000; // Design-intent constant — explicit user-review pause (see GH #<issue>)
```

```swift
let ctaHeight: CGFloat = 64 // Design-intent constant — primary CTA tap target (see GH #<issue>)
```

The `// Design-intent constant — <reason> (see GH #<issue>)` comment shape is what the bare-literal ratchets recognize as a legitimate carve-out. Pin the comment to whatever issue tracker the consuming project uses.

**The no-new-tokens default:** snap literals onto the closest existing token by default. Don't add new tokens to `tokens.json` without explicit approval. The off-grid escape is the right path for one-offs.

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

Project-specific ratchets defending a product's own anti-patterns (e.g., locking a renamed-away legacy token symbol out of the codebase) live in the project's own `src/__tests__/`. Recipe: [recipes/add-a-ratchet.md](../../recipes/add-a-ratchet.md).

Additional gates:
- `npm run tokens:check` (prebuild + pre-commit) — verifies codegen is in sync.
- ESLint with the `no-console: error` rule (paired with [05-observability-pii.md](05-observability-pii.md)).
- The pre-merge UI checklist at [checklists/pre-merge-ui-checklist.md](../../checklists/pre-merge-ui-checklist.md).

---

## 3. Cross-platform parity model

Same source, different encoding. Same logic, two runners.

- **Tokens:** one `tokens.json` → CSS vars for web, Swift literals for iOS. The `no-bare-hex-in-codegen-output` ratchet defends against the generator emitting bare hex instead of per-platform token references (a real incident: an icon-color generator emitted bare hex into the var-reference map instead of `var(--color-*)` references; defended by the ratchet from then on).
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

## 7. Dark mode as a token-value swap (+ the kept-light-island polarity gate)

### The principle

Dark mode is not a parallel stylesheet, a second theme file, or a per-component override. It is a **token-value swap**: because feature code may never use a bare color (Mandate 1 — every color is a `--color-*` custom property on web / a `Colors.*` reference on iOS), inverting the canvas mostly means redefining a small set of **structural color tokens** under a selector. Everything else stays put.

Partition the palette into two classes:

- **Adaptive tokens** — the handful of structural colors that *do* invert: `text-primary` / `ink` → near-white, `surface` / `background` → dark, `border` → dark slate, `text-secondary` / `cool-gray` → light. These are authored as a separate `darkColor` block in `tokens.json`.
- **Kept-light islands** — every *other* color token: pastels, brand accents, status chips, role chips, badges, icon tiles, the primary CTA. These do **not** invert. A dark glyph on a light pastel reads correctly on a dark canvas, so the island stays light by design.

### Cross-platform model

Same source, different encoding — the same model as every other token (see § 3 Cross-platform parity).

- **Web:** the `darkColor` block emits a second declaration of the adaptive vars under `[data-theme="dark"]` (explicit opt-in) and a system-default branch gated on `prefers-color-scheme: dark`. Feature CSS is untouched — it already references the vars.
- **iOS:** codegen emits the adaptive leaves as an adaptive `Color` (a `light:dark:` pair resolved by the OS); every other `Colors.*` leaf is a static literal island. Same partition, derived from the same `darkColor` keys.
- **Hard shadows / brutalist accents** that previously baked the ink hex at codegen time must emit a *token reference* (`var(--color-text-primary)` / `Colors.ink`) instead, so they re-theme with the adaptive ink rather than going invisible on a dark canvas. Light output stays byte-identical (the adaptive ink equals the border ink in light).

### Runtime toggle + FOUC guard

- A tiny store (web: a `localStorage`-backed value applied to `<html data-theme>`; iOS: `@AppStorage` driving `preferredColorScheme`) with a shared storage key and a `light | dark | system` tri-state.
- An **`index.html` FOUC guard** applies the stored theme *before first paint* (inline script reads `localStorage` and sets `data-theme` synchronously), so the page never flashes light-then-dark on load.
- The hand-authored token wrapper additionally sets the CSS `color-scheme` property under the same selectors so native controls (scrollbars, `<select>`, caret, date pickers) render in matching chrome.

### The bug class this introduces

A token-value swap creates exactly one new failure mode that every existing ratchet is blind to: **an adaptive foreground painted on a kept-light island**. Both directions of it vanish specifically in dark:

- `color: var(--color-text-primary)` on `background: var(--color-success)` → near-white-on-mint (the light-mode intent was dark-on-mint).
- `color: var(--color-surface)` on `background: var(--color-primary)` → flips white-on-pink (light) to dark-on-pink (dark).

Every prior ratchet checks that a color flows *through a token*; none check that the **right** token is used for the context. The fix is a **`STAYS-*` token** — a foreground token that is `#`-identical to its adaptive twin *in light* but does not carry a dark override (e.g. a `*-foreground` / `*-text` partner that stays dark ink on pastels, or a `text-on-primary` that stays white on saturated brand fills). Because it equals the adaptive value in light, light goldens never churn when you migrate to it.

### Enforcement: `noAdaptiveFgOnKeptLightIsland`

The `noAdaptiveFgOnKeptLightIsland` ratchet (`@camelburrito/ratchet-kit`) is the guard for this one bug class. It runs on both platforms from a single source of truth:

- **Web:** scans each `*.module.css` rule and fails when one declaration sets a `background` / `background-color` to a *non-adaptive* `--color-*` var **and** sets `color` to an *adaptive* one (catches both polarities).
- **iOS:** `findSwiftIslandPolarityViolations` scans contiguous SwiftUI modifier runs (one run = one view) and fails when a literal `.foregroundStyle/.foregroundColor(Colors.<adaptive>)` co-locates with a `.background(…Colors.<island>…)` in the same run.
- **Self-deriving adaptive set:** the notion of "adaptive" is *derived from the `darkColor` token keys + their `color.*` aliases* — add or remove a dark override and the ratchet updates automatically. No hardcoded list, and the web and iOS scanners can never disagree on what "adaptive" means.
- **Escape valve:** a translucent island over an adaptive surface (a pastel at low opacity that reads as a wash, not a solid) can legitimately carry adaptive ink. Opt out with `/* dark-ok: <reason> */` (web) or `// dark-ok: <reason>` (iOS) — the rationale is **required**; a bare or empty `dark-ok` does not exempt (mirrors the `no-console` rationale convention).

### The honest ceiling

Static analysis sees only the **co-located** case (background + foreground in the same CSS rule / same modifier run), which is the majority of real sites. It cannot pair a **JS/TS-computed inline background**, a **cross-rule cascade** (background on parent, foreground on child), a `background-image` gradient, or a `fill` / `border-color` foreground. An adaptive *border* on a pastel island is left uncovered on purpose — it's a correct by-design inversion, not a bug. The residual is covered by **dark-render snapshot goldens** plus an **auto-run dark-mode e2e spec**, grown per-surface as dark coverage matures. Document the ceiling in the ratchet header so the next contributor knows what the gate does and does not catch. Where a platform pins a single scheme (e.g. a tvOS target at `.preferredColorScheme(.light)`), the bug class can't occur and that target is excluded from the scan.

---

## 8. Typography & sizing foundation

### The principle

A type scale is a **composite token layer**, not a pile of loose `font-size` declarations. The canonical failure mode is a heading that sets `font-size` but silently ships no `line-height` (or sets letter-spacing on one platform but not the other). The fix is to bundle size + line-height + weight + tracking as a *set* that always travels together, authored once and emitted to every platform — the same source-of-truth model as colors and spacing.

### Composite `textStyle.*` levels

Add a `typography.textStyle.*` group to `tokens.json` as a composite layer *over* the flat `fontSize` / `lineHeight` / `fontWeight` / `tracking` primitives — each level references the primitives, it does not introduce new magnitudes. Use a small set of platform-neutral semantic role levels (e.g. `display` / `heading` / `title` / `subtitle` / `body` / `caption` / `micro`) rather than raw sizes, so consumers ask for an *intent* and the scale owns the values.

Emit each level to both platforms in the form that platform reads natively:

- **Web:** per-axis custom properties `--text-{level}-{size|leading|weight|tracking}`. Consume the `size`+`leading` pair together on headings; do **not** use the CSS `font` shorthand — it silently drops `letter-spacing`.
- **iOS:** a generated `TypeStyles.{level}` struct, consumed through a *hand-written* `.typeStyle(_:)` `@ScaledMetric` ViewModifier that applies font + line-spacing + tracking in lockstep with Dynamic Type (only a ViewModifier can host `@ScaledMetric` stored props, so this one consumer is hand-written; the values are still generated).

### Letter-spacing authored once, in `em`

**Tracking is authored once, in `em`** — the only scale-invariant unit for letter-spacing (it's relative to the font size, so the same value is correct at every level) — and emitted to both platforms from that single source: web uses the `em` value verbatim as `letter-spacing`; iOS converts to points at codegen (`tracking_pt = trackingEm × fontSize.px`). This closes the asymmetry where one platform's headings have letter-spacing and the other's don't. Authoring in `px`/`pt` per platform is the anti-pattern: it drifts and double-encodes the same intent.

### Button-sizing a11y rule

Buttons are **content-sized** (text + padding), not fixed-dimension. Every button size variant must floor at a **44px/pt minimum touch target** (a dedicated `touch-target-min` / `minTouchTarget` token) and couple `line-height` to the text box. Buttons must **not** borrow `avatar-size-*` tokens — avatars are fixed-dimension circles, and borrowing their sizes is both a semantic category error and a WCAG 2.5.5 violation at small sizes (a 28px button fails the target floor). When a product has a hand-rolled button family (admin buttons, compact toolbars), fold it into the generic `Button` with a `compact` size + extra variants rather than maintaining a parallel atom.

---

## 9. Driving the primitive-hierarchy ratchet to strict-zero (addendum to Mandate 2)

This is not a new mandate — it's the move that takes the **Hierarchy Mandate** (§ 1, Mandate 2) the last mile, from "mostly enforced with a baseline carve-out" to `EXPECTED_COUNTS = {}` on the `no-bare-primitive-in-features` ratchet (web) and its Swift twin. The blocker to strict-zero is almost always a tail of bare `<button>` / `<input>` sites in feature code that *can't* adopt the chromed L3 `Button` / `Input` because they're genuinely consumer-styled or have a non-standard shape. The answer is not to keep baselining them — it's to give the hierarchy the L2/L3 atoms it was missing.

**The move:**

1. **Add an L2 unstyled base.** A `Pressable` button base (MUI-`ButtonBase` pattern): `type="button"` by default + `ref` / `className` / ARIA passthrough, **no imposed style**. This is the composition point for genuinely consumer-styled affordances — the last bare `<button>` sites route through it keeping their existing class, byte-identical, while still being a hierarchy citizen rather than a raw primitive.
2. **Add small extraction atoms** for the recurring non-button primitives the tail revealed — e.g. `Slider` (L2 range input), `FileInput` (L2 hidden file input driven by a visible trigger), `SegmentedControl` (L3 tablist), `PickerTile` (L3 selectable grid tile). Each is a one-time promotion that removes a whole class of bare-primitive sites.
3. **Migrate the tail** onto the new atoms and **flip the ratchet to strict-zero** (`EXPECTED_COUNTS = {}`) in the same change, so any *new* bare `<button>` / `<input>` (or `<select>` / `<dialog>`) in feature code fails on the first commit.

**Watch the WAI-ARIA APG contract.** An L3 composite that wraps a native interaction pattern owes the full keyboard contract — e.g. a `SegmentedControl` standing in for a tablist must implement the APG tablist pattern: roving `tabindex`, Arrow/Home/End to move focus, and (for a control whose change is destructive) **manual** activation so arrow-key *exploration* doesn't fire `onChange` until the user commits with Enter/click. Adding the atom without the keyboard contract trades a styling violation for an accessibility one. The same applies to `PickerTile` (`aria-pressed` / `aria-selected`) and any other composite that replaces a primitive's built-in semantics.

Mirror the same move on iOS: migrate the last bare `TextField` / `Toggle` / `Picker` sites onto the native-shell-wrapping atoms (`Input` / `Toggle` / `Dropdown`) so the Swift primitive-hierarchy ratchet also reaches strict-zero. Both platforms strict-zero is the goal — at that point the hierarchy is structurally complete and no feature can reintroduce a raw primitive.

---

## Reference reading

The structural artifacts this doc describes, as they appear in a consuming project:

- a design tool (e.g. Stitch) holding the named design system — the upstream authority for color / type / elevation / affordance values
- `design.md` — the textual design spec that bridges the design tool and the tokens (version-controlled, reviewable)
- `shared/tokens/tokens.json` — token source of truth *for the code* (the encoded materialization of the design system)
- `src/ui/tokens.generated.css` — web codegen output
- `packages/<CoreUI>/Sources/<CoreUI>/Tokens/Colors.generated.swift` — Swift codegen output
- `src/ui/elements/` — L3 atoms
- `src/ui/components/<Card>/<Card>.tsx` — L4 component with a cross-platform projector
- `packages/<CoreUI>/Sources/<CoreUI>/Atoms/<Card>.swift` — iOS mirror
- `shared/test-fixtures/<system>/` — paired contract fixtures
- `src/__tests__/no-inline-style.test.ts` — an exemplar ratchet
- The project's own design-system architecture doc — full pipeline narrative including the string catalog

Ratchet implementations referenced throughout live in `@camelburrito/ratchet-kit`; shared backend utilities in `packages/cf-utils`.

---

**Last updated:** 2026-06-21
