# Recipe: Add a Token

## First, don't.

The user-level rule `feedback_no_new_tokens_without_approval` says: snap to the nearest existing token by default. Only add a new token after the design need has been validated across more than one surface.

## If you must

1. Edit `shared/tokens/tokens.json` — add the entry under the right category (color / spacing / radii / borders / typography / motion / media).
2. Run `npm run tokens:gen` to regenerate per-platform outputs.
3. Run `npm run tokens:check` to verify codegen is in sync.
4. Run the full ratchet suite — `no-undefined-tokens` will fail until you wire references; `no-bare-hex-in-{css,tsx,swift}` etc. stay green.
5. Use the new token in the surface that needed it. Don't pre-emptively use it elsewhere.

## What if it's truly off-grid (one-off pixel offset, etc.)?

Don't add a token. Use a named TypeScript/CSS/Swift constant with a Mandate-3 comment:

```ts
const TOAST_REVIEW_HOLD_MS = 6000; // Design-intent constant — explicit user-review pause (see GH #309)
```

Or in Swift:

```swift
let ctaHeight: CGFloat = 64 // Design-intent constant — minimum tap target (see GH #309)
```

The `// Design-intent constant — <reason> (see GH #<issue>)` comment shape is what the bare-literal ratchets recognize as a legitimate carve-out.

## Cross-platform parity

If the token appears in multiple platforms, all of them must consume it from the same `tokens.json` source. Codegen handles encoding per-platform (CSS var for web, hex `Color(...)` literal for Swift). The `no-bare-hex-in-codegen-output` ratchet defends against the generator emitting bare literals instead of the per-platform token references.

## Related playbook

- [02-design-system.md](../docs/playbook/02-design-system.md) — token mandate + 4-layer hierarchy
