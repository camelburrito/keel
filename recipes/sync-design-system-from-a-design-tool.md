# Recipe: Sync the Design System from a Design Tool

The design tool (the worked example here is [Stitch](https://stitch.withgoogle.com/), named the same way this playbook names Firebase / Playwright / mermaid — a general tool, not coupled to any product) is the **upstream authority** for the visual design system: palette, type scale, spacing, elevation, and interaction-affordance rules. `tokens.json` is the **downstream materialization** of that design, encoded for per-platform codegen. This recipe is how you bring the two into agreement.

Direction of flow is one-way: **`DESIGN.md` → design tool → `tokens.json` → codegen.** `DESIGN.md` is hand-authored and ingested into the tool (never exported back out); the tool renders the system; `tokens.json` is the encoded materialization. Never hand-edit `tokens.json` to diverge from the design system without changing `DESIGN.md` / the design tool first.

## Steps

1. **Define or edit the system in the tool.** If you already have a committed `DESIGN.md`, ingest it first (Step 2) to (re)create the system; otherwise iterate fresh. In Stitch, create the design system (or edit the existing one) — palette, type scale, spacing/radii, elevation, component rules. Iterate on real screens: generate a screen (or variants) and `apply` the system so you preview an actual surface before writing any code. (Steps 1–2 are a bootstrapping pair; the steady-state flow stays `DESIGN.md → tool → tokens.json`.)
2. **Capture / ingest `DESIGN.md`.** Keep a plain-text design spec named `DESIGN.md` (Stitch's filename convention; commit it at the repo root or under `docs/`) as the durable, reviewable bridge — **you author and commit it**; it is the version-controlled source, not a tool export. Stitch can **ingest a `DESIGN.md`** to (re)create the system; there is no reverse operation that exports a `DESIGN.md` back out of the tool, which is exactly why the committed `DESIGN.md` — not the tool's UI — is the durable truth. (Read the system's concrete values off its rendered design in the next step.)
3. **Read the system's values.** Pull the concrete values the design system specifies: hex colors, the type scale (size / weight / case / line-height / tracking), spacing & radii, elevation (shadow offset / blur / color), and affordance rules (border width, press-offset, etc.).
4. **Reconcile into `tokens.json`.** For each value:
   - If `tokens.json` already has a token that matches → use it (no change).
   - If it disagrees → **the tool wins.** Update the token value in `tokens.json` to match the design system.
   - If the design system introduces a genuinely new value used across more than one surface → add a token (per [add-a-token.md](add-a-token.md) — but heed its **don't-by-default** rule: snap to an existing token where you can).
   - If the design tool says nothing about it (a one-off per-icon size, a bespoke offset) → it's **not** the design system's call. Use sibling-consistency (match the peer element's size) and the Off-Grid Mandate escape: a named constant with `// Design-intent constant — <reason> (see GH #<issue>)`.
5. **Regenerate.** `npm run tokens:gen` → per-platform outputs. `npm run tokens:check` → verifies codegen is in sync.
6. **Run the ratchets.** The bare-literal ratchets (`no-bare-hex-in-{css,tsx,swift}`, `no-undefined-tokens`, `no-bare-hex-in-codegen-output`, …) stay green only if every value flows through a token. A failure here means a value escaped reconciliation.
7. **Prove it visually.** Capture real-app screenshots of the affected surface (per [10-screenshot-workflow.md](../docs/playbook/10-screenshot-workflow.md)) and eyeball them against the design tool's rendering. Token math being green is necessary, not sufficient — the screenshot is the design-intent check.

## What the design system governs (and what it doesn't)

| Governed by the design tool | Governed by local convention |
|-----------------------------|------------------------------|
| Palette / colors | Per-icon pixel sizing (sibling-consistency) |
| Type scale (size, weight, case, line-height, tracking) | One-off bespoke offsets (off-grid named constant) |
| Spacing & radii | Surface-specific layout that the system is silent on |
| Elevation (shadow) | |
| Interaction-affordance rules (border, press-offset) | |

When the design tool is silent, don't invent a token and don't pretend the system dictated the value — use the Off-Grid Mandate escape.

## Iteration hygiene

When you iterate mocks in the design tool, **delete superseded versions immediately** once the replacement is confirmed. A project full of stale variants is no longer a single source of truth — the next person can't tell which screen is current. One current truth per surface.

## The division of labor

- **The design tool decides the values.** It has no reach into the codebase and cannot enforce anything.
- **`tokens.json` + codegen carry the values** into every platform in the form each consumes natively.
- **The ratchets keep feature code from drifting** off the tokens.

All three are required. The tool is an input; the ratchets are the enforcement; the tokens are the bridge between them.

## Related playbook

- [02-design-system.md](../docs/playbook/02-design-system.md) — § "The design source of truth" + the four mandates
- [add-a-token.md](add-a-token.md) — the canonical token-add path (and why the default is *don't*)
- [10-screenshot-workflow.md](../docs/playbook/10-screenshot-workflow.md) — real-app visual proof
